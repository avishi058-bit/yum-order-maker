// Edit an existing order: swap items, change quantities, add/remove items.
// Restores fridge inventory for removed items and pulls fridge for new ones
// via DB triggers. Returns requires_reprint=true if any non-drink item changed.
//
// SECURITY: prices are ALWAYS recomputed server-side from the shared
// menu-pricing module — client-supplied `price` values are ignored. An
// optional `discount` field is allowed but must be non-negative, capped
// at the recomputed total, and is only accepted from admin callers.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  MENU_ITEMS_PRICING,
  TOPPINGS_PRICING,
  MEAL_SIDES_PRICING,
  MEAL_DRINKS_PRICING,
  DEAL_DRINKS_PRICING,
  MEAL_UPGRADE_PRICE,
} from "../_shared/menu-pricing.ts";

interface EditItem {
  item_id: string;
  item_name: string;
  price?: number; // IGNORED — server always recomputes.
  quantity: number;
  toppings?: string[]; // stored as Hebrew names on existing order_items
  removals?: string[];
  with_meal?: boolean;
  meal_side?: string | null; // Hebrew name
  meal_drink?: string | null; // Hebrew name
  deal_burgers?: any;
  deal_drinks?: any; // array of { name?: string; optionId?: string }
}

// Name → price lookups for names stored on order_items (they went in as
// resolved Hebrew names by create-order).
const MENU_BY_ID = new Map(MENU_ITEMS_PRICING.map((m) => [m.id, m]));
const TOPPING_BY_NAME = new Map(TOPPINGS_PRICING.map((t) => [t.name, t]));
const MEAL_SIDE_BY_NAME = new Map(MEAL_SIDES_PRICING.map((s) => [s.name, s]));
const MEAL_DRINK_BY_NAME = new Map(MEAL_DRINKS_PRICING.map((d) => [d.name, d]));
const DEAL_DRINK_BY_ID = new Map(DEAL_DRINKS_PRICING.map((d) => [d.id, d]));
const DEAL_DRINK_BY_NAME = new Map(DEAL_DRINKS_PRICING.map((d) => [d.name, d]));

// Kitchen-defined custom toppings, loaded per-request (name → price).
let CUSTOM_TOPPING_BY_NAME = new Map<string, { name: string; price: number }>();

function priceLine(it: EditItem): { unit: number; error?: string } {
  const menu = MENU_BY_ID.get(it.item_id);
  if (!menu) return { unit: 0, error: `unknown item: ${it.item_id}` };
  let unit = menu.price;

  // Toppings (paid burger add-ons) — stored as Hebrew names on order_items.
  for (const t of it.toppings ?? []) {
    const found = TOPPING_BY_NAME.get(t) ?? CUSTOM_TOPPING_BY_NAME.get(t);
    if (found) unit += found.price;
    // Unknown names (custom toppings, sauce lines, etc.) count as 0 —
    // never treat unknowns as free-price overrides from the client.
  }

  // Meal upgrade — only when the base is a plain burger.
  if (it.with_meal && menu.category === "burger") {
    unit += MEAL_UPGRADE_PRICE;
  }

  // Meal side / meal drink — stored as Hebrew names.
  if (it.meal_side) {
    const s = MEAL_SIDE_BY_NAME.get(it.meal_side);
    if (s) unit += s.price;
  }
  if (it.meal_drink) {
    const d = MEAL_DRINK_BY_NAME.get(it.meal_drink);
    if (d) unit += d.price;
  }

  // Deal drinks — support both id and name, since older rows use either.
  if (Array.isArray(it.deal_drinks)) {
    for (const dd of it.deal_drinks) {
      const key = (dd && (dd.optionId || dd.id || dd.name)) as string | undefined;
      if (!key) continue;
      const found = DEAL_DRINK_BY_ID.get(key) ?? DEAL_DRINK_BY_NAME.get(key);
      if (found) unit += found.price;
    }
  }

  // Deal burgers — extra paid toppings inside a deal (stored as Hebrew names).
  if (Array.isArray(it.deal_burgers)) {
    for (const b of it.deal_burgers) {
      if (Array.isArray(b?.toppings)) {
        for (const t of b.toppings) {
          const found = TOPPING_BY_NAME.get(t) ?? CUSTOM_TOPPING_BY_NAME.get(t);
          if (found) unit += found.price;
        }
      }
    }
  }

  return { unit };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate caller identity + role
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r) => r.role);
    if (!roles.includes("admin") && !roles.includes("kitchen")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const isAdmin = roles.includes("admin");

    const body = await req.json();
    const orderId: string = body.order_id;
    const newItems: EditItem[] = body.items ?? [];
    // Optional manual discount (₪), admin-only, non-negative, capped at total.
    const rawDiscount = Number(body.discount);
    const requestedDiscount = Number.isFinite(rawDiscount) && rawDiscount > 0 ? rawDiscount : 0;
    if (requestedDiscount > 0 && !isAdmin) {
      return new Response(JSON.stringify({ error: "Only admins can apply discounts" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!orderId || !Array.isArray(newItems) || newItems.length === 0) {
      return new Response(JSON.stringify({ error: "Missing order_id or items" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load order
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id,status,order_items(*)")
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["new", "preparing"].includes(order.status)) {
      return new Response(JSON.stringify({ error: "Order is no longer editable" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const oldItems: any[] = order.order_items ?? [];
    // Synthetic lines without a menu id (e.g. the "רטבים" sauce-charge line)
    // are not editable — preserve them as-is so their charge is not lost.
    const preservedItems: any[] = oldItems.filter((oi) => !oi.item_id);

    const { data: customToppingRows } = await admin
      .from("custom_toppings")
      .select("name, price");
    CUSTOM_TOPPING_BY_NAME = new Map(
      (customToppingRows ?? []).map((r: any) => [r.name, { name: r.name, price: Number(r.price) || 0 }])
    );

    // ---- Server-side re-price. Reject unknown menu ids upfront. ----
    const priced: Array<{ item: EditItem; unit: number }> = [];
    for (const it of newItems) {
      const p = priceLine(it);
      if (p.error) {
        return new Response(JSON.stringify({ error: p.error }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      priced.push({ item: it, unit: p.unit });
    }

    // Compute requires_reprint: any added/removed/changed item that's not pure drink-swap
    const drinkPrefixes = ["drink-", "can", "bottle", "water", "flavored-water", "soda", "beer-"];
    const isDrinkId = (id: string) =>
      drinkPrefixes.some((p) => id === p || id.startsWith(p));
    const signature = (it: any) =>
      `${it.item_id}|${it.quantity}|${(it.toppings ?? []).slice().sort().join(",")}|${(it.removals ?? []).slice().sort().join(",")}|${it.with_meal ? 1 : 0}|${it.meal_side ?? ""}|${it.meal_drink ?? ""}`;
    const oldSigs = new Set(oldItems.map(signature));
    const newSigs = new Set(newItems.map(signature));
    let requiresReprint = false;
    for (const it of newItems) {
      if (!oldSigs.has(signature(it)) && !isDrinkId(it.item_id)) requiresReprint = true;
    }
    for (const it of oldItems) {
      if (!newSigs.has(signature(it)) && !isDrinkId(it.item_id)) requiresReprint = true;
    }

    // Restore fridge for all old items
    for (const oi of oldItems) {
      const { error: restoreErr } = await admin.rpc("restore_fridge_for_order_item", {
        p_order_id: orderId,
        p_row: {
          item_id: oi.item_id,
          item_name: oi.item_name,
          quantity: oi.quantity,
          toppings: oi.toppings,
          with_meal: oi.with_meal,
          meal_side: oi.meal_side,
          meal_drink: oi.meal_drink,
          deal_burgers: oi.deal_burgers,
          deal_drinks: oi.deal_drinks,
        },
      });
      if (restoreErr) console.warn("[edit-order] restore failed", restoreErr);
    }

    // Delete old order_items
    const { error: delErr } = await admin
      .from("order_items")
      .delete()
      .eq("order_id", orderId);
    if (delErr) throw delErr;

    // Insert new order_items with server-computed prices.
    const rowsToInsert = priced.map(({ item: it, unit }) => ({
      order_id: orderId,
      item_id: it.item_id,
      item_name: it.item_name,
      price: unit, // server-computed, NOT client-supplied
      quantity: it.quantity,
      toppings: it.toppings ?? [],
      removals: it.removals ?? [],
      with_meal: it.with_meal ?? false,
      meal_side: it.meal_side ?? null,
      meal_drink: it.meal_drink ?? null,
      deal_burgers: it.deal_burgers ?? null,
      deal_drinks: it.deal_drinks ?? null,
    }));
    for (const oi of preservedItems) {
      rowsToInsert.push({
        order_id: orderId,
        item_id: null,
        item_name: oi.item_name,
        price: Number(oi.price || 0),
        quantity: Number(oi.quantity || 1),
        toppings: oi.toppings ?? [],
        removals: oi.removals ?? [],
        with_meal: false,
        meal_side: null,
        meal_drink: null,
        deal_burgers: null,
        deal_drinks: null,
      });
    }
    const { error: insErr } = await admin.from("order_items").insert(rowsToInsert);
    if (insErr) throw insErr;

    // Server-computed total, minus a bounded admin discount.
    const preservedGross = preservedItems.reduce(
      (s, oi) => s + Number(oi.price || 0) * Number(oi.quantity || 1),
      0
    );
    const gross =
      priced.reduce((s, { unit, item }) => s + unit * Number(item.quantity), 0) + preservedGross;
    const discount = Math.min(requestedDiscount, gross);
    const newTotal = Math.round((gross - discount) * 100) / 100;

    await admin
      .from("orders")
      .update({ total: newTotal, updated_at: new Date().toISOString() })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({
        ok: true,
        requires_reprint: requiresReprint,
        total: newTotal,
        gross,
        discount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[edit-order] error", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
