// create-order: server-side authoritative order creation.
// - Validates input with Zod
// - Recomputes prices server-side (ignores client-supplied prices)
// - Checks restaurant_status (open + payment method enabled)
// - Inserts customer + order + order_items (rolls back order on items failure)
//
// IMPORTANT: pricing tables here MUST stay in sync with src/data/menu.ts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  MENU_ITEMS_PRICING,
  TOPPINGS_PRICING as TOPPINGS_LIST,
  MEAL_SIDES_PRICING as MEAL_SIDES_LIST,
  MEAL_DRINKS_PRICING as MEAL_DRINKS_LIST,
  DEAL_DRINKS_PRICING as DEAL_DRINKS_LIST,
  MEAL_UPGRADE_PRICE as SHARED_MEAL_UPGRADE_PRICE,
  toLookup,
} from "../_shared/menu-pricing.ts";
import { recordConsent } from "../_shared/consent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ===== Pricing data (single source of truth: supabase/functions/_shared/menu-pricing.ts) =====

interface MenuItemPricing {
  id: string;
  name: string;
  price: number;
  category: "burger" | "side" | "drink" | "deal" | "meal";
}

const MENU_ITEMS: MenuItemPricing[] = MENU_ITEMS_PRICING;
const TOPPINGS_PRICING: Record<string, { name: string; price: number }> = toLookup(TOPPINGS_LIST);
const MEAL_UPGRADE_PRICE = SHARED_MEAL_UPGRADE_PRICE;
const MEAL_SIDE_PRICING: Record<string, { name: string; price: number }> = toLookup(MEAL_SIDES_LIST);
const MEAL_DRINK_PRICING: Record<string, { name: string; price: number }> = toLookup(MEAL_DRINKS_LIST);
const DEAL_DRINK_PRICING: Record<string, { name: string; price: number }> = toLookup(DEAL_DRINKS_LIST);

const MENU_BY_ID = new Map(MENU_ITEMS.map((m) => [m.id, m]));

function getEffectivePrice(
  itemId: string,
  overrides: Record<string, { price?: number }>
): number | undefined {
  const item = MENU_BY_ID.get(itemId);
  if (!item) return undefined;
  const ov = overrides?.[itemId];
  if (ov && typeof ov.price === "number") return ov.price;
  return item.price;
}

// ===== Validation schema =====

const CartItemSchema = z.object({
  itemId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(50),
  // Optional friendly name override (e.g. "פחית — קולה") — used as item_name on
  // order_items so the kitchen sees the chosen sub-variant. Server still uses
  // the canonical menu item for pricing.
  nameOverride: z.string().trim().max(160).optional(),
  toppings: z.array(z.string().max(64)).max(20).optional(),
  removals: z.array(z.string().max(64)).max(20).optional(),
  removalNames: z.array(z.string().max(120)).max(20).optional(),
  withMeal: z.boolean().optional(),
  mealSideId: z.string().max(64).nullable().optional(),
  mealDrinkId: z.string().max(64).nullable().optional(),
  dealBurgers: z
    .array(
      z.object({
        name: z.string().max(120).optional(),
        removals: z.array(z.string().max(64)).max(20).optional(),
        removalNames: z.array(z.string().max(120)).max(20).optional(),
        // Per-burger paid toppings inside a deal (ids).
        toppings: z.array(z.string().max(64)).max(20).optional(),
      })
    )
    .max(10)
    .nullable()
    .optional(),
  dealDrinks: z
    .array(z.object({ optionId: z.string().max(64) }))
    .max(10)
    .nullable()
    .optional(),
});

const SauceSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  quantity: z.number().int().min(1).max(50),
});

const BodySchema = z.object({
  customerName: z.string().trim().min(1).max(120),
  // Phone may be empty during the temporary kiosk/no-phone flow.
  // Empty strings are normalized to a placeholder before insert.
  customerPhone: z.string().trim().max(30).optional().default(""),
  notes: z.string().max(500).optional().nullable(),
  paymentMethod: z.enum(["cash", "credit", "counter"]),
  orderSource: z.enum(["website", "kiosk", "station"]).default("website"),
  dineIn: z.boolean().nullable().optional(),
  status: z.enum(["new", "pending_payment"]).default("new"),
  // Required: legal proof that the customer accepted Terms + Privacy at order time.
  // Without this the order is rejected (no silent default).
  termsAcceptedAt: z.string().datetime({ message: "termsAcceptedAt must be ISO datetime" }),
  // Optional: customer-requested pickup time (ISO datetime). When set, order is
  // scheduled — kitchen displays it and can start preparing closer to the time.
  scheduledFor: z.string().datetime().nullable().optional(),
  // Delivery (website only). When set, order is a delivery order — customer pays
  // for the food here; delivery fee is paid directly to the courier (Bit/cash).
  deliveryRequestId: z.string().uuid().nullable().optional(),
  // Ownership proof for delivery_requests: only the client that created the
  // request (and therefore holds its client_token) may finalize it.
  deliveryRequestClientToken: z.string().uuid().nullable().optional(),
  deliveryAddress: z.string().max(500).nullable().optional(),
  deliveryFee: z.number().min(0).max(10000).nullable().optional(),
  items: z.array(CartItemSchema).min(1).max(50),
  // Optional: sauces selected at checkout (chef-summary use). Server adds the
  // extra-sauce charge (1₪ per sauce above the free quota) to the total and
  // stores them as a synthetic order_item line for the kitchen receipt.
  sauces: z.array(SauceSchema).max(20).optional().default([]),
  freeSauces: z.number().int().min(0).max(100).optional().default(0),
  // Cloudflare Turnstile anti-bot token. Required for website orders.
  turnstileToken: z.string().min(1).max(2048).optional(),
  // Set to true only after the customer explicitly confirmed they want to send
  // an identical order again (duplicate-order guard below).
  allowDuplicate: z.boolean().optional().default(false),
});

type CartItemInput = z.infer<typeof CartItemSchema>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyTurnstileToken(token: string, remoteIp: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    console.warn("TURNSTILE_SECRET_KEY not configured; skipping verification");
    return true;
  }

  try {
    const params = new URLSearchParams();
    params.append("secret", secret);
    params.append("response", token);
    if (remoteIp && remoteIp !== "unknown") params.append("remoteip", remoteIp);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: params,
    });
    const data = await res.json();
    if (!data.success) {
      console.warn("Turnstile verification failed", data);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Turnstile verification error", err);
    return false;
  }
}

function shouldRequireWebsiteTurnstile(): boolean {
  return Deno.env.get("WEBSITE_REQUIRE_TURNSTILE") === "true";
}

interface PricedLine {
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  toppingNames: string[];
  withMeal: boolean;
  mealSideName: string | null;
  mealDrinkName: string | null;
  dealDrinks: Array<{ optionId: string; name: string }> | null;
  /** Per-burger paid toppings inside a deal, resolved to Hebrew names. */
  dealBurgerToppingNames: string[][] | null;
}

function priceCart(
  items: CartItemInput[],
  overrides: Record<string, { price?: number }>,
  extraToppings: Record<string, { name: string; price: number }> = {}
): { ok: true; total: number; lines: PricedLine[] } | { ok: false; error: string } {
  const lines: PricedLine[] = [];
  let total = 0;

  for (const item of items) {
    const menuItem = MENU_BY_ID.get(item.itemId);
    if (!menuItem) return { ok: false, error: `פריט לא ידוע: ${item.itemId}` };

    const base = getEffectivePrice(item.itemId, overrides) ?? menuItem.price;
    let unit = base;
    const toppingNames: string[] = [];
    let mealSideName: string | null = null;
    let mealDrinkName: string | null = null;
    let dealDrinkNames: Array<{ optionId: string; name: string }> | null = null;

    if (item.toppings?.length) {
      const isArayesExtras =
        (menuItem.id === "arayes-special" || menuItem.id === "arayes-special-4") &&
        item.toppings.every((t) => t === "arayes-extra-quarter");
      if (menuItem.category !== "burger" && menuItem.category !== "meal" && !isArayesExtras) {
        return { ok: false, error: `תוספות לא מותרות על ${menuItem.name}` };
      }
      for (const tId of item.toppings) {
        const t = TOPPINGS_PRICING[tId] ?? extraToppings[tId];
        if (!t) return { ok: false, error: `תוספת לא ידועה: ${tId}` };
        unit += t.price;
        toppingNames.push(t.name);
      }
    }

    if (item.withMeal) {
      // אם הפריט הוא כבר ארוחה (category=meal) - מתעלמים מ-withMeal בשקט
      // (זה מצב שיכול לקרות בעריכת פריט מהעגלה)
      if (menuItem.category === "burger") {
        unit += MEAL_UPGRADE_PRICE;
      }
      // עבור meal/deal/side/drink - פשוט מתעלמים מהדגל בלי לזרוק שגיאה
    }

    const isMealContext = menuItem.category === "meal" || !!item.withMeal;
    if (item.mealSideId) {
      if (!isMealContext) return { ok: false, error: `תוספת צד לא מותרת על ${menuItem.name}` };
      const side = MEAL_SIDE_PRICING[item.mealSideId];
      if (!side) return { ok: false, error: `תוספת צד לא ידועה: ${item.mealSideId}` };
      unit += side.price;
      mealSideName = side.name;
    }
    if (item.mealDrinkId) {
      if (!isMealContext) return { ok: false, error: `שתייה לא מותרת על ${menuItem.name}` };
      const d = MEAL_DRINK_PRICING[item.mealDrinkId];
      if (!d) return { ok: false, error: `שתייה לא ידועה: ${item.mealDrinkId}` };
      unit += d.price;
      mealDrinkName = d.name;
    }

    if (item.dealDrinks?.length) {
      if (menuItem.category !== "deal") {
        return { ok: false, error: `שתיית דיל לא מותרת על ${menuItem.name}` };
      }
      dealDrinkNames = [];
      for (const dd of item.dealDrinks) {
        const d = DEAL_DRINK_PRICING[dd.optionId];
        if (!d) return { ok: false, error: `שתיית דיל לא ידועה: ${dd.optionId}` };
        unit += d.price;
        dealDrinkNames.push({ optionId: dd.optionId, name: d.name });
      }
    }

    // Per-burger paid toppings inside a deal: charge each topping and resolve
    // to Hebrew names for storage (so the kitchen receipt + fridge trigger see them).
    let dealBurgerToppingNames: string[][] | null = null;
    if (item.dealBurgers?.length) {
      if (menuItem.category !== "deal") {
        return { ok: false, error: `תוספות לדיל לא מותרות על ${menuItem.name}` };
      }
      dealBurgerToppingNames = [];
      for (const b of item.dealBurgers) {
        const namesForBurger: string[] = [];
        for (const tId of b.toppings ?? []) {
          const t = TOPPINGS_PRICING[tId] ?? extraToppings[tId];
          if (!t) return { ok: false, error: `תוספת לא ידועה בדיל: ${tId}` };
          unit += t.price;
          namesForBurger.push(t.name);
        }
        dealBurgerToppingNames.push(namesForBurger);
      }
    }

    total += unit * item.quantity;
    lines.push({
      itemId: item.itemId,
      name: item.nameOverride && item.nameOverride.length > 0 ? item.nameOverride : menuItem.name,
      unitPrice: unit,
      quantity: item.quantity,
      toppingNames,
      withMeal: !!item.withMeal,
      mealSideName,
      mealDrinkName,
      dealDrinks: dealDrinkNames,
      dealBurgerToppingNames,
    });
  }

  total = Math.round(total * 100) / 100;
  return { ok: true, total, lines };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }
  const body = parsed.data;

  // Cloudflare Turnstile verification: optional during soft launch because some
  // mobile in-app browsers leave the Cloudflare iframe blank. Set
  // WEBSITE_REQUIRE_TURNSTILE=true to enforce it again.
  // Kiosk/station are trusted local devices and skip this check.
  if (body.orderSource === "website" && shouldRequireWebsiteTurnstile()) {
    if (!body.turnstileToken) {
      return jsonResponse({ error: "חסר אימות אבטחה. נסה לרענן את הדף." }, 400);
    }
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const ok = await verifyTurnstileToken(body.turnstileToken, clientIp);
    if (!ok) {
      return jsonResponse({ error: "אימות האבטחה נכשל. נסה שוב." }, 403);
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Rate limit: prevent bots from flooding orders.
  // Website orders use the phone as key; station/kiosk orders fall back to IP.
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const rateLimitKey = (body.customerPhone && body.customerPhone.length >= 7)
    ? body.customerPhone
    : `ip:${clientIp}`;
  const rateLimitAction = (body.orderSource === "kiosk" || body.orderSource === "station")
    ? "order_create_station"
    : "order_create";
  const maxOrderAttempts = (body.orderSource === "kiosk" || body.orderSource === "station") ? 30 : 5;
  const orderWindow = "15 minutes";

  const { data: allowed, error: rateErr } = await supabase.rpc("check_rate_limit", {
    p_action: rateLimitAction,
    p_key: rateLimitKey,
    p_max_attempts: maxOrderAttempts,
    p_window: orderWindow,
  });
  if (rateErr || allowed === false) {
    console.warn("Order rate limit exceeded", { rateLimitKey, rateLimitAction, rateErr });
    return jsonResponse({ error: "יותר מדי הזמנות בזמן קצר. נסו שוב מאוחר יותר." }, 429);
  }

  // Duplicate-submit guard: block a second order from the same phone/IP within
  // a short window (10 seconds). Prevents accidental double-clicks and two
  // simultaneous orders from the same source.
  const { data: dupAllowed, error: dupErr } = await supabase.rpc("check_rate_limit", {
    p_action: "order_create_dup",
    p_key: rateLimitKey,
    p_max_attempts: 1,
    p_window: "10 seconds",
  });
  if (dupErr || dupAllowed === false) {
    console.warn("Duplicate order blocked", { rateLimitKey });
    return jsonResponse({ error: "כבר נשלחה הזמנה זהה כרגע. המתינו רגע ונסו שוב." }, 429);
  }
  await supabase.rpc("record_rate_limit_attempt", {
    p_action: "order_create_dup",
    p_key: rateLimitKey,
    p_ip_address: clientIp,
  });

  await supabase.rpc("record_rate_limit_attempt", {
    p_action: rateLimitAction,
    p_key: rateLimitKey,
    p_ip_address: clientIp,
  });

  // Restaurant status
  const { data: statusRows, error: statusErr } = await supabase
    .from("restaurant_status")
    .select("website_open, station_open, cash_enabled, credit_enabled")
    .limit(1);
  if (statusErr) {
    console.error("status fetch failed", statusErr);
    return jsonResponse({ error: "שגיאה בבדיקת סטטוס המסעדה" }, 500);
  }
  const status = statusRows?.[0];
  if (!status) return jsonResponse({ error: "סטטוס מסעדה לא מוגדר" }, 500);

  const isStationOrKiosk = body.orderSource === "kiosk" || body.orderSource === "station";
  if (isStationOrKiosk && !status.station_open) {
    return jsonResponse({ error: "התחנה סגורה כרגע" }, 403);
  }
  if (!isStationOrKiosk && !status.website_open) {
    return jsonResponse({ error: "האתר סגור כרגע להזמנות" }, 403);
  }
  if (body.paymentMethod === "cash" && !status.cash_enabled) {
    return jsonResponse({ error: "תשלום במזומן אינו זמין כרגע" }, 403);
  }
  if (body.paymentMethod === "credit" && !status.credit_enabled) {
    return jsonResponse({ error: "תשלום באשראי אינו זמין כרגע" }, 403);
  }
  // "counter" = pay-at-counter (cash or card paid physically at the location).
  // Always allowed regardless of cash/credit toggles, since payment happens
  // in-person and is not gated by online payment availability.

  // Admin price overrides
  let overrides: Record<string, { price?: number }> = {};
  const { data: settingsRows } = await supabase
    .from("site_settings")
    .select("menu_item_overrides")
    .limit(1);
  const rawOverrides = settingsRows?.[0]?.menu_item_overrides;
  if (rawOverrides && typeof rawOverrides === "object") {
    overrides = rawOverrides as Record<string, { price?: number }>;
  }

  // Availability gate
  const itemIds = Array.from(new Set(body.items.map((i) => i.itemId)));
  const { data: availRows, error: availErr } = await supabase
    .from("menu_availability")
    .select("item_id, available, item_name")
    .in("item_id", itemIds);
  if (availErr) {
    console.error("availability fetch failed", availErr);
    return jsonResponse({ error: "שגיאה בבדיקת זמינות" }, 500);
  }
  const availMap = new Map<string, { available: boolean; name: string }>();
  (availRows ?? []).forEach((r: any) => {
    availMap.set(r.item_id, { available: r.available, name: r.item_name });
  });
  for (const id of itemIds) {
    const row = availMap.get(id);
    if (row && row.available === false) {
      return jsonResponse({ error: `הפריט "${row.name}" אינו זמין כרגע` }, 409);
    }
  }

  // Server-side pricing
  // Kitchen-defined custom toppings (public.custom_toppings) are selectable in
  // the customizer — price them here too, otherwise the whole order is rejected.
  const customToppings: Record<string, { name: string; price: number }> = {};
  const { data: customToppingRows } = await supabase
    .from("custom_toppings")
    .select("item_id, name, price");
  for (const row of customToppingRows ?? []) {
    customToppings[row.item_id] = { name: row.name, price: Number(row.price) || 0 };
  }

  const pricing = priceCart(body.items, overrides, customToppings);
  if (!pricing.ok) return jsonResponse({ error: pricing.error }, 400);

  // Sauce extra-charge: premium sauces (fixed per-unit price) are always billed;
  // regular sauces are billed at 1₪ per sauce above the free quota.
  const PREMIUM_SAUCE_PRICES: Record<string, number> = {
    "aioli-garlic-mint": 2,
    "house-aioli-sauce": 2,
    "pickled-jalapeno-sauce": 3,
  };
  let regularSauceQty = 0;
  let premiumSauceCost = 0;
  for (const s of body.sauces) {
    const p = PREMIUM_SAUCE_PRICES[s.id];
    if (p) premiumSauceCost += p * s.quantity;
    else regularSauceQty += s.quantity;
  }
  // Free-sauce quota is recomputed server-side (never trust the client value):
  // 3 free sauces per burger/meal (deal burgers included), otherwise 5 per
  // "מיקס חברים" and 2 per fried side.
  const FRIED_SIDE_IDS = new Set(["fries", "sweet-potato-fries", "onion-rings", "tempura-onion"]);
  let burgerUnits = 0;
  let sideQuota = 0;
  for (const it of body.items) {
    const mi = MENU_BY_ID.get(it.itemId);
    if (!mi) continue;
    if (it.dealBurgers?.length) {
      burgerUnits += it.dealBurgers.length * it.quantity;
      continue;
    }
    if (mi.category === "burger" || mi.category === "meal") {
      burgerUnits += it.quantity;
      if (mi.category === "meal" || it.withMeal) sideQuota += 0;
      continue;
    }
    if (mi.id === "friends-mix") sideQuota += 5 * it.quantity;
    else if (FRIED_SIDE_IDS.has(mi.id)) sideQuota += 2 * it.quantity;
  }
  const allowedFreeSauces = burgerUnits > 0 ? burgerUnits * 3 : sideQuota;
  const effectiveFreeSauces = Math.min(body.freeSauces, allowedFreeSauces);
  const extraSauces = Math.max(0, regularSauceQty - effectiveFreeSauces);
  const finalTotal = Math.round((pricing.total + extraSauces + premiumSauceCost) * 100) / 100;

  // Normalize phone: kiosk no-phone flow sends "" — store a placeholder so
  // the NOT NULL column on `orders.customer_phone` stays satisfied without
  // polluting the customers table.
  const phoneForOrder = body.customerPhone && body.customerPhone.length >= 7
    ? body.customerPhone
    : "—";

  // Upsert customer only when we have a real phone number
  if (body.customerPhone && body.customerPhone.length >= 7) {
    const { error: custErr } = await supabase
      .from("customers")
      .upsert({ phone: body.customerPhone, name: body.customerName }, { onConflict: "phone" });
    if (custErr) console.warn("customer upsert non-fatal", custErr);
  }

  // ── Duplicate-order guard ────────────────────────────────────────────────
  // Customers sometimes resend the same order because they aren't sure the
  // first one went through. If an identical order (same phone + same total)
  // was created in the last 10 minutes and is still active, ask for explicit
  // confirmation instead of silently creating a second one.
  if (!body.allowDuplicate && body.customerPhone && body.customerPhone.length >= 7) {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("orders")
      .select("order_number, created_at, status")
      .eq("customer_phone", phoneForOrder)
      .eq("total", finalTotal)
      .gte("created_at", since)
      .not("status", "in", '("cancelled","completed")')
      .order("created_at", { ascending: false })
      .limit(1);
    const existing = recent?.[0];
    if (existing) {
      return jsonResponse(
        {
          duplicate: true,
          existingOrderNumber: existing.order_number,
          existingStatus: existing.status,
          error: `כבר קיימת הזמנה זהה על שמך (#${existing.order_number}) שנשלחה לפני רגע.`,
        },
        409,
      );
    }
  }

  // Insert order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      customer_name: body.customerName,
      customer_phone: phoneForOrder,
      notes: body.notes || null,
      total: finalTotal,
      status: body.status,
      payment_method: body.paymentMethod,
      order_source: body.orderSource,
      dine_in: body.dineIn ?? null,
      terms_accepted_at: body.termsAcceptedAt,
      scheduled_for: body.scheduledFor ?? null,
      delivery_request_id: body.deliveryRequestId ?? null,
      delivery_address: body.deliveryAddress ?? null,
      delivery_fee: body.deliveryFee ?? null,
    })
    .select("id, order_number, total")
    .single();
  if (orderErr || !order) {
    console.error("order insert failed", orderErr);
    return jsonResponse({ error: "שגיאה ביצירת ההזמנה" }, 500);
  }

  // Insert order_items
  const orderItemsRows = pricing.lines.map((line, idx) => {
    const original = body.items[idx];
    const removalNames =
      original.removalNames && original.removalNames.length
        ? original.removalNames
        : original.removals ?? [];
    const dealBurgers = original.dealBurgers
      ? original.dealBurgers.map((b, bi) => ({
          name: b.name,
          removals:
            b.removalNames && b.removalNames.length ? b.removalNames : b.removals ?? [],
          // Per-burger paid toppings — stored as Hebrew names so the kitchen
          // receipt prints them and the fridge trigger resolves them by name.
          toppings: line.dealBurgerToppingNames?.[bi] ?? [],
        }))
      : null;
    return {
      order_id: order.id,
      item_id: line.itemId,
      item_name: line.name,
      price: line.unitPrice,
      quantity: line.quantity,
      toppings: line.toppingNames,
      removals: removalNames,
      with_meal: line.withMeal,
      meal_side: line.mealSideName,
      meal_drink: line.mealDrinkName,
      deal_burgers: dealBurgers,
      deal_drinks: line.dealDrinks,
    };
  });

  // Synthetic "רטבים" line — only used so the kitchen receipt builder can show
  // sauces in the chef summary. price=0 (charge already on the order total).
  // toppings carry "name × qty" so the receipt prints them as a sub-line.
  if (body.sauces.length > 0) {
    const sauceLabels = body.sauces.map((s) =>
      s.quantity > 1 ? `${s.name} × ${s.quantity}` : s.name
    );
    orderItemsRows.push({
      order_id: order.id,
      item_name: "רטבים",
      price: Math.round((extraSauces + premiumSauceCost) * 100) / 100, // matches the order total
      quantity: 1,
      toppings: sauceLabels,
      removals: [],
      with_meal: false,
      meal_side: null,
      meal_drink: null,
      deal_burgers: null,
      deal_drinks: null,
    });
  }

  const { error: itemsErr } = await supabase.from("order_items").insert(orderItemsRows);
  if (itemsErr) {
    console.error("order_items insert failed — rolling back order", itemsErr);
    await supabase.from("orders").delete().eq("id", order.id);
    return jsonResponse({ error: "שגיאה ביצירת פריטי ההזמנה" }, 500);
  }

  // ===== Legal consent proof (clickwrap "digital signature") =====
  // Persist exactly what the customer approved, with IP + user-agent, so the
  // business has evidence if a claim is ever raised.
  const userAgent = req.headers.get("user-agent") || null;
  const consentBase = {
    supabase,
    phone: phoneForOrder,
    customerName: body.customerName,
    orderId: order.id,
    source: body.orderSource,
    ip: clientIp,
    userAgent,
  };

  await recordConsent({ ...consentBase, kind: "terms", createdAt: body.termsAcceptedAt });

  // Gluten-free disclaimer — recorded per dish that used a gluten-free bun.
  const glutenItems = body.items
    .filter((it) => (it.toppings ?? []).includes("gluten-free-bun"))
    .map((it) => it.nameOverride || MENU_BY_ID.get(it.itemId)?.name || it.itemId);
  for (const itemRef of glutenItems) {
    await recordConsent({ ...consentBase, kind: "gluten_free", itemRef });
  }


  // Finalize the delivery request server-side, verifying the client_token.
  // Without a matching token the update is refused — no client can mark
  // another customer's pending request as completed.
  if (body.deliveryRequestId && body.deliveryRequestClientToken) {
    await supabase
      .from("delivery_requests")
      .update({ status: "completed", order_id: order.id })
      .eq("id", body.deliveryRequestId)
      .eq("client_token", body.deliveryRequestClientToken);
  }

  return jsonResponse({
    orderId: order.id,
    orderNumber: order.order_number,
    total: order.total,
  });
});
