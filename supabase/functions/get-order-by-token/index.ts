/**
 * get-order-by-token
 * Public endpoint for guest order tracking. Returns an order ONLY when the
 * caller proves ownership via { order_number, phone } match.
 *
 * No auth required (guest-friendly), but information disclosure is limited
 * by requiring the customer's phone — the same number they entered at checkout.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  order_number?: number;
  phone?: string;
}

function normalizePhone(p: string): string {
  // Keep only digits — handles users typing spaces/dashes/+972 variants.
  return p.replace(/\D/g, "").replace(/^972/, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_number, phone } = (await req.json()) as Body;

    if (!order_number || !phone || typeof phone !== "string") {
      return new Response(
        JSON.stringify({ error: "missing_params" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, status, total, estimated_ready_at, updated_at, created_at, customer_phone",
      )
      .eq("order_number", order_number)
      .maybeSingle();

    if (error || !order) {
      return new Response(
        JSON.stringify({ error: "not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Ownership check — phone must match (normalized)
    if (normalizePhone(order.customer_phone) !== normalizePhone(phone)) {
      return new Response(
        JSON.stringify({ error: "not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Strip the phone from the response — caller already knows it
    const { customer_phone: _omit, ...safe } = order;

    return new Response(
      JSON.stringify({ order: safe }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("get-order-by-token error:", err);
    return new Response(
      JSON.stringify({ error: "server_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
