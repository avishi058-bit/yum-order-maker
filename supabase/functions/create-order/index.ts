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
  status: z.enum(["new", "pending_payment"]).default("new"),
  // Required: legal proof that the customer accepted Terms + Privacy at order time.
  // Without this the order is rejected (no silent default).
  termsAcceptedAt: z.string().datetime({ message: "termsAcceptedAt must be ISO datetime" }),
  items: z.array(CartItemSchema).min(1).max(50),
  // Optional: sauces selected at checkout (chef-summary use). Server adds the
  // extra-sauce charge (1₪ per sauce above the free quota) to the total and
  // stores them as a synthetic order_item line for the kitchen receipt.
  sauces: z.array(SauceSchema).max(20).optional().default([]),
  freeSauces: z.number().int().min(0).max(100).optional().default(0),
});

type CartItemInput = z.infer<typeof CartItemSchema>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
}

function priceCart(
  items: CartItemInput[],
  overrides: Record<string, { price?: number }>
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
      if (menuItem.category !== "burger" && menuItem.category !== "meal") {
        return { ok: false, error: `תוספות לא מותרות על ${menuItem.name}` };
      }
      for (const tId of item.toppings) {
        const t = TOPPINGS_PRICING[tId];
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

    total += unit * item.quantity;
    lines.push({
      itemId: item.itemId,
      name: menuItem.name,
      unitPrice: unit,
      quantity: item.quantity,
      toppingNames,
      withMeal: !!item.withMeal,
      mealSideName,
      mealDrinkName,
      dealDrinks: dealDrinkNames,
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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

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
  const pricing = priceCart(body.items, overrides);
  if (!pricing.ok) return jsonResponse({ error: pricing.error }, 400);

  // Sauce extra-charge: 1₪ per sauce above the free quota (kept generous: free
  // quota is whatever the client said, so worst case server overcharges = 0).
  const totalSauceQty = body.sauces.reduce((s, x) => s + x.quantity, 0);
  const extraSauces = Math.max(0, totalSauceQty - body.freeSauces);
  const finalTotal = Math.round((pricing.total + extraSauces) * 100) / 100;

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
      terms_accepted_at: body.termsAcceptedAt,
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
      ? original.dealBurgers.map((b) => ({
          name: b.name,
          removals:
            b.removalNames && b.removalNames.length ? b.removalNames : b.removals ?? [],
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
      price: extraSauces, // 0 if all within free quota
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

  return jsonResponse({
    orderId: order.id,
    orderNumber: order.order_number,
    total: order.total,
  });
});
