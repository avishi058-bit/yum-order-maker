/**
 * get-order-by-token
 * Public endpoint for guest order tracking. Returns an order ONLY when the
 * caller proves ownership via { order_number, phone } match.
 *
 * SECURITY:
 * - Rate limited per IP (10 attempts / 15 minutes) to prevent brute-force
 *   enumeration of order_number × phone combinations.
 * - Wrong phone or missing order returns the SAME "not_found" response so an
 *   attacker cannot distinguish between the two.
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
  return p.replace(/\D/g, "").replace(/^972/, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Rate limit by IP ────────────────────────────────────────────────
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      p_action: "order_lookup",
      p_key: ip,
      p_max_attempts: 10,
      p_window: "15 minutes",
    });
    if (allowed === false) {
      return new Response(
        JSON.stringify({ error: "rate_limited", message: "יותר מדי ניסיונות. נסו שוב בעוד 15 דקות." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // NOTE: attempts are recorded ONLY for failed lookups (below). Successful
    // lookups must not consume the budget — the tracking page polls every 8s
    // and would otherwise rate-limit a legitimate customer within ~80 seconds.
    const recordFailure = () =>
      supabase.rpc("record_rate_limit_attempt", {
        p_action: "order_lookup",
        p_key: ip,
        p_ip_address: ip,
      });

    const { order_number, phone } = (await req.json()) as Body;

    if (!order_number || !phone || typeof phone !== "string") {
      await recordFailure();
      return new Response(
        JSON.stringify({ error: "missing_params" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: order } = await supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, status, total, estimated_ready_at, updated_at, created_at, customer_phone",
      )
      .eq("order_number", order_number)
      .maybeSingle();

    if (!order || normalizePhone(order.customer_phone) !== normalizePhone(phone)) {
      await recordFailure();
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
