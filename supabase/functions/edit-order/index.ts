// Edit an existing order: swap items, change quantities, add/remove items.
// Restores fridge inventory for removed items and pulls fridge for new ones
// via DB triggers. Returns requires_reprint=true if any non-drink item changed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface EditItem {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
  toppings?: string[];
  removals?: string[];
  with_meal?: boolean;
  meal_side?: string | null;
  meal_drink?: string | null;
  deal_burgers?: any;
  deal_drinks?: any;
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

    const body = await req.json();
    const orderId: string = body.order_id;
    const newItems: EditItem[] = body.items ?? [];
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

    // Insert new order_items (trigger will pull fridge automatically)
    const rowsToInsert = newItems.map((it) => ({
      order_id: orderId,
      item_id: it.item_id,
      item_name: it.item_name,
      price: it.price,
      quantity: it.quantity,
      toppings: it.toppings ?? [],
      removals: it.removals ?? [],
      with_meal: it.with_meal ?? false,
      meal_side: it.meal_side ?? null,
      meal_drink: it.meal_drink ?? null,
      deal_burgers: it.deal_burgers ?? null,
      deal_drinks: it.deal_drinks ?? null,
    }));
    const { error: insErr } = await admin.from("order_items").insert(rowsToInsert);
    if (insErr) throw insErr;

    // Update orders.total
    const newTotal = newItems.reduce((s, it) => s + Number(it.price) * Number(it.quantity), 0);
    await admin.from("orders").update({ total: newTotal, updated_at: new Date().toISOString() }).eq("id", orderId);

    return new Response(JSON.stringify({ ok: true, requires_reprint: requiresReprint, total: newTotal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[edit-order] error", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
