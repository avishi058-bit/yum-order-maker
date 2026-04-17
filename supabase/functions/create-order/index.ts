// create-order: server-side authoritative order creation.
// - Validates input with Zod
// - Recomputes prices server-side (ignores client-supplied prices)
// - Checks restaurant_status (open + payment method enabled)
// - Inserts customer + order + order_items (rolls back order on items failure)
//
// IMPORTANT: pricing tables here MUST stay in sync with src/data/menu.ts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ===== Pricing data (sync with src/data/menu.ts) =====

interface MenuItemPricing {
  id: string;
  name: string;
  price: number;
  category: "burger" | "side" | "drink" | "deal" | "meal";
}

const MENU_ITEMS: MenuItemPricing[] = [
  { id: "classic", name: "קלאסי", price: 52, category: "burger" },
  { id: "smash-moshavnikim", name: "סמאש של מושבניקים", price: 58, category: "burger" },
  { id: "avishai", name: "אבישי שחוט לי פרה!", price: 78, category: "burger" },
  { id: "double", name: "כפולה", price: 76, category: "burger" },
  { id: "crazy-smash", name: "קרייזי סמאש", price: 64, category: "burger" },
  { id: "smash-double-cheese", name: "סמאש דאבל צ׳יז", price: 66, category: "burger" },
  { id: "special-hadegel", name: "ספיישל הדגל", price: 73, category: "burger" },
  { id: "haf-mifsha", name: "חף מפשע", price: 55, category: "burger" },
  { id: "meal-classic", name: "ארוחת קלאסי", price: 75, category: "meal" },
  { id: "meal-smash-moshavnikim", name: "ארוחת סמאש של מושבניקים", price: 81, category: "meal" },
  { id: "meal-avishai", name: "ארוחת אבישי שחוט לי פרה!", price: 101, category: "meal" },
  { id: "meal-double", name: "ארוחת כפולה", price: 99, category: "meal" },
  { id: "meal-crazy-smash", name: "ארוחת קרייזי סמאש", price: 87, category: "meal" },
  { id: "meal-smash-double-cheese", name: "ארוחת סמאש דאבל צ׳יז", price: 89, category: "meal" },
  { id: "meal-special-hadegel", name: "ארוחת ספיישל הדגל", price: 96, category: "meal" },
  { id: "meal-haf-mifsha", name: "ארוחת חף מפשע", price: 78, category: "meal" },
  { id: "fries", name: "צ׳יפס", price: 20, category: "side" },
  { id: "waffle-fries", name: "וופל צ׳יפס", price: 25, category: "side" },
  { id: "onion-rings", name: "טבעות בצל", price: 24, category: "side" },
  { id: "tempura-onion", name: "טבעות בצל ביתיות בטמפורה", price: 32, category: "side" },
  { id: "friends-mix", name: "מיקס חברים", price: 59, category: "side" },
  { id: "can", name: "פחית", price: 10, category: "drink" },
  { id: "bottle", name: "בקבוק", price: 12, category: "drink" },
  { id: "beer-regular", name: "בירה", price: 18, category: "drink" },
  { id: "beer-premium", name: "בירה פרימיום", price: 23, category: "drink" },
  { id: "beer-weiss", name: "ויינשטפאן (חצי)", price: 25, category: "drink" },
  { id: "family-deal", name: "דיל משפחתי", price: 300, category: "deal" },
  { id: "friends-deal", name: "דיל חברים", price: 216, category: "deal" },
];

const TOPPINGS_PRICING: Record<string, { name: string; price: number }> = {
  "onion-jam": { name: "ריבת בצל של סבתא דינה", price: 9 },
  "peanut-butter": { name: "חמאת בוטנים", price: 8 },
  "fried-onion": { name: "בצל מטוגן", price: 7 },
  "garlic-confit": { name: "קונפי שום", price: 7 },
  "egg": { name: "ביצת עין", price: 8 },
  "vegan-cheddar": { name: "צ׳דר טבעוני", price: 7 },
  "roastbeef": { name: "רצועות רוסטביף", price: 20 },
  "extra-patty": { name: "אקסטרה קציצה (220 גרם)", price: 25 },
  "hot-pepper-jam": { name: "ריבת פלפלים חריפים", price: 9 },
  "onion-rings-topping": { name: "שלוש טבעות בצל ביתיות", price: 8 },
  "maple": { name: "מייפל", price: 5 },
};

const MEAL_UPGRADE_PRICE = 23;

const MEAL_SIDE_PRICING: Record<string, { name: string; price: number }> = {
  "side-fries": { name: "צ׳יפס רגיל", price: 0 },
  "side-waffle": { name: "וופל צ׳יפס", price: 5 },
  "side-onion-rings": { name: "טבעות בצל", price: 4 },
  "side-tempura": { name: "טבעות בצל ביתיות בטמפורה", price: 13 },
};

const MEAL_DRINK_PRICING: Record<string, { name: string; price: number }> = {
  "drink-cola": { name: "קולה", price: 0 },
  "drink-zero": { name: "זירו", price: 0 },
  "drink-fanta": { name: "פאנטה", price: 0 },
  "drink-fanta-grape": { name: "פאנטה ענבים", price: 0 },
  "drink-fanta-exotic": { name: "פאנטה אקזוטי", price: 0 },
  "drink-sprite": { name: "ספרייט", price: 0 },
  "drink-sprite-zero": { name: "ספרייט זירו", price: 0 },
  "drink-blu": { name: "בלו", price: 0 },
  "drink-blu-mojito": { name: "בלו מוחיטו", price: 0 },
  "drink-blu-day": { name: "בלו דיי", price: 0 },
  "drink-goldstar": { name: "גולדסטאר", price: 8 },
  "drink-heineken": { name: "הייניקן", price: 8 },
  "drink-corona": { name: "קורונה", price: 8 },
  "drink-carlsberg": { name: "קאלסברג", price: 8 },
  "drink-laffe": { name: "לאפ בראון", price: 12 },
  "drink-unfiltered": { name: "גולדסטאר אנפילטר", price: 12 },
  "drink-guinness": { name: "גינס", price: 12 },
};

const DEAL_DRINK_PRICING: Record<string, { name: string; price: number }> = {
  "deal-cola": { name: "קולה", price: 0 },
  "deal-zero": { name: "זירו", price: 0 },
  "deal-fanta": { name: "פאנטה", price: 0 },
  "deal-fanta-grape": { name: "פאנטה ענבים", price: 0 },
  "deal-fanta-exotic": { name: "פאנטה אקזוטי", price: 0 },
  "deal-sprite": { name: "ספרייט", price: 0 },
  "deal-sprite-zero": { name: "ספרייט זירו", price: 0 },
  "deal-blu": { name: "בלו", price: 0 },
  "deal-blu-mojito": { name: "בלו מוחיטו", price: 0 },
  "deal-blu-day": { name: "בלו דיי", price: 0 },
  "deal-grapes": { name: "ענבים (בקבוק)", price: 2 },
  "deal-oranges": { name: "תפוזים (בקבוק)", price: 2 },
  "deal-flavored-water": { name: "מים בטעמים (בקבוק)", price: 2 },
  "deal-goldstar": { name: "גולדסטאר", price: 8 },
  "deal-heineken": { name: "הייניקן", price: 8 },
  "deal-corona": { name: "קורונה", price: 8 },
  "deal-carlsberg": { name: "קאלסברג", price: 8 },
  "deal-laffe": { name: "לאפ בראון", price: 12 },
  "deal-unfiltered": { name: "גולדסטאר אנפילטר", price: 12 },
  "deal-guinness": { name: "גינס", price: 12 },
  "fam-cola": { name: "קולה", price: 0 },
  "fam-zero": { name: "זירו", price: 0 },
  "fam-fanta": { name: "פאנטה", price: 0 },
  "fam-sprite": { name: "ספרייט", price: 0 },
  "fam-blu": { name: "בלו", price: 0 },
  "fam-grapes": { name: "ענבים", price: 0 },
  "fam-apples": { name: "תפוחים", price: 0 },
  "fam-goldstar": { name: "גולדסטאר", price: 8 },
  "fam-heineken": { name: "הייניקן", price: 8 },
  "fam-corona": { name: "קורונה", price: 8 },
  "fam-carlsberg": { name: "קאלסברג", price: 8 },
  "fam-laffe": { name: "לאפ בראון", price: 12 },
  "fam-unfiltered": { name: "גולדסטאר אנפילטר", price: 12 },
  "fam-guinness": { name: "גינס", price: 12 },
};

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

const BodySchema = z.object({
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().min(7).max(30),
  notes: z.string().max(500).optional().nullable(),
  paymentMethod: z.enum(["cash", "credit"]),
  orderSource: z.enum(["website", "kiosk", "station"]).default("website"),
  status: z.enum(["new", "pending_payment"]).default("new"),
  items: z.array(CartItemSchema).min(1).max(50),
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
      if (menuItem.category !== "burger") {
        return { ok: false, error: `שדרוג לארוחה רק על המבורגר (${menuItem.name})` };
      }
      unit += MEAL_UPGRADE_PRICE;
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

  // Upsert customer (best-effort)
  const { error: custErr } = await supabase
    .from("customers")
    .upsert({ phone: body.customerPhone, name: body.customerName }, { onConflict: "phone" });
  if (custErr) console.warn("customer upsert non-fatal", custErr);

  // Insert order
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
