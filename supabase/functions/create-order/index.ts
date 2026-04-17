// create-order: server-side authoritative order creation.
// - Validates input with Zod
// - Recomputes prices from shared menu-pricing (ignores client-supplied prices)
// - Checks restaurant_status (open + payment method enabled)
// - Inserts customer + order + order_items atomically (best-effort)
//
// Auth: public (no JWT) — verify_jwt = false in supabase/config.toml below.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  computeCartPricing,
  type ServerCartItem,
} from "../_shared/menu-pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

const BodySchema = z.object({
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().min(7).max(30),
  notes: z.string().max(500).optional().nullable(),
  paymentMethod: z.enum(["cash", "credit"]),
  orderSource: z.enum(["website", "kiosk", "station"]).default("website"),
  status: z.enum(["new", "pending_payment"]).default("new"),
  items: z.array(CartItemSchema).min(1).max(50),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

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

  // 1. Restaurant status checks
  const { data: statusRows, error: statusErr } = await supabase
    .from("restaurant_status")
    .select("website_open, station_open, cash_enabled, credit_enabled")
    .limit(1);
  if (statusErr) {
    console.error("status fetch failed", statusErr);
    return jsonResponse({ error: "Could not verify restaurant status" }, 500);
  }
  const status = statusRows?.[0];
  if (!status) {
    return jsonResponse({ error: "Restaurant status not configured" }, 500);
  }

  const isStationOrKiosk =
    body.orderSource === "kiosk" || body.orderSource === "station";
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

  // 2. Load admin price overrides from site_settings
  let overrides: Record<string, { price?: number }> = {};
  const { data: settingsRows } = await supabase
    .from("site_settings")
    .select("menu_item_overrides")
    .limit(1);
  const rawOverrides = settingsRows?.[0]?.menu_item_overrides;
  if (rawOverrides && typeof rawOverrides === "object") {
    overrides = rawOverrides as Record<string, { price?: number }>;
  }

  // 3. Availability check (server-side gate)
  const itemIds = Array.from(new Set(body.items.map((i) => i.itemId)));
  const { data: availRows, error: availErr } = await supabase
    .from("menu_availability")
    .select("item_id, available")
    .in("item_id", itemIds);
  if (availErr) {
    console.error("availability fetch failed", availErr);
    return jsonResponse({ error: "Could not verify availability" }, 500);
  }
  const availMap = new Map<string, boolean>(
    (availRows ?? []).map((r) => [r.item_id as string, r.available as boolean])
  );
  for (const id of itemIds) {
    if (availMap.get(id) === false) {
      return jsonResponse(
        { error: `הפריט "${id}" אינו זמין כרגע` },
        409
      );
    }
  }

  // 4. Server-side price computation (authoritative)
  const serverItems: ServerCartItem[] = body.items.map((i) => ({
    itemId: i.itemId,
    quantity: i.quantity,
    toppings: i.toppings,
    removals: i.removals,
    withMeal: i.withMeal,
    mealSideId: i.mealSideId ?? null,
    mealDrinkId: i.mealDrinkId ?? null,
    dealBurgers: i.dealBurgers ?? null,
    dealDrinks: i.dealDrinks ?? null,
  }));
  const pricing = computeCartPricing(serverItems, overrides);
  if (!pricing.ok) {
    return jsonResponse({ error: pricing.error }, 400);
  }

  // 5. Upsert customer (best-effort, non-fatal)
  const { error: custErr } = await supabase
    .from("customers")
    .upsert(
      { phone: body.customerPhone, name: body.customerName },
      { onConflict: "phone" }
    );
  if (custErr) {
    console.warn("customer upsert non-fatal error", custErr);
  }

  // 6. Insert order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      customer_name: body.customerName,
      customer_phone: body.customerPhone,
      notes: body.notes || null,
      total: pricing.total,
      status: body.status,
      payment_method: body.paymentMethod,
      order_source: body.orderSource,
    })
    .select("id, order_number, total")
    .single();
  if (orderErr || !order) {
    console.error("order insert failed", orderErr);
    return jsonResponse({ error: "שגיאה ביצירת ההזמנה" }, 500);
  }

  // 7. Insert order_items — prefer client-supplied removal/burger names (Hebrew),
  //    fall back to ids. Prices come from server.
  const orderItemsRows = pricing.lines.map((line, idx) => {
    const original = body.items[idx];
    const removalNames =
      original.removalNames && original.removalNames.length
        ? original.removalNames
        : original.removals ?? [];
    const dealBurgers = original.dealBurgers
      ? original.dealBurgers.map((b) => ({
          name: b.name,
          removals: b.removalNames && b.removalNames.length ? b.removalNames : b.removals ?? [],
        }))
      : null;
    return {
      order_id: order.id,
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

  const { error: itemsErr } = await supabase
    .from("order_items")
    .insert(orderItemsRows);
  if (itemsErr) {
    console.error("order_items insert failed — rolling back order", itemsErr);
    // Best-effort rollback
    await supabase.from("orders").delete().eq("id", order.id);
    return jsonResponse({ error: "שגיאה ביצירת פריטי ההזמנה" }, 500);
  }

  return jsonResponse({
    orderId: order.id,
    orderNumber: order.order_number,
    total: order.total,
  });
});
