// get-customer-orders: returns the authenticated customer's order history
// (validated by their device token from customer-auth).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(p: string): string {
  return p.replace(/\D/g, "").replace(/^972/, "0");
}

/** All plausible stored representations of a phone number, so an old
 *  order saved as "+972..." still matches a "05..." lookup. */
function phoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  const local = digits.replace(/^972/, "0"); // 0501234567
  const noZero = local.startsWith("0") ? local.slice(1) : local; // 501234567
  const intl = "972" + noZero; // 972501234567
  const plusIntl = "+" + intl; // +972501234567
  return Array.from(new Set([phone, local, intl, plusIntl, digits]));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { deviceToken } = await req.json();
    if (!deviceToken || typeof deviceToken !== "string" || deviceToken.length < 32) {
      return new Response(JSON.stringify({ error: "missing_token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: customer } = await supabase
      .from("customers")
      .select("phone")
      .eq("device_token", deviceToken)
      .maybeSingle();

    if (!customer) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneDigits = normalizePhone(customer.phone);
    const variants = phoneVariants(customer.phone);

    // Filter by phone in the SQL query itself, then keep the in-function
    // normalized-match as a safety net for exotic stored formats.
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, order_number, status, total, created_at, payment_method, notes, customer_phone")
      .in("customer_phone", variants)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: "server_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ownedOrders = (orders ?? []).filter(
      (o) => normalizePhone(o.customer_phone) === phoneDigits,
    );

    if (ownedOrders.length === 0) {
      return new Response(JSON.stringify({ orders: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderIds = ownedOrders.map((o) => o.id);
    const { data: items } = await supabase
      .from("order_items")
      .select("order_id, item_id, item_name, price, quantity, toppings, removals, with_meal, meal_side, meal_drink, deal_burgers, deal_drinks")
      .in("order_id", orderIds);

    const itemsByOrder = new Map<string, any[]>();
    (items ?? []).forEach((it: any) => {
      const arr = itemsByOrder.get(it.order_id) ?? [];
      arr.push(it);
      itemsByOrder.set(it.order_id, arr);
    });

    const result = ownedOrders.map((o) => ({
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      total: o.total,
      created_at: o.created_at,
      payment_method: o.payment_method,
      notes: o.notes,
      items: itemsByOrder.get(o.id) ?? [],
    }));

    return new Response(JSON.stringify({ orders: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("get-customer-orders error:", err);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
