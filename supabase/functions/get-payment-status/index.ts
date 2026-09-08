/**
 * get-payment-status
 * Public endpoint used by the payment confirmation screen after returning
 * from the hosted checkout page. The order UUID acts as the (unguessable)
 * token. Returns only whether the payment went through plus the order number —
 * no customer PII is exposed.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { orderId } = (await req.json()) as { orderId?: string };
    if (!orderId || !UUID_RE.test(orderId)) return json({ error: "bad_request" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order } = await supabase
      .from("orders")
      .select("order_number, status, payment_method")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return json({ error: "not_found" }, 404);

    const failedStatuses = ["cancelled", "payment_failed", "declined", "refunded"];
    const failed = failedStatuses.includes(order.status);
    // Only a fully confirmed credit charge counts as paid: the callback flipped
    // the order out of pending_payment AND stamped payment_method = 'credit'.
    const paid = !failed && order.status !== "pending_payment" && order.payment_method === "credit";

    return json({
      paid,
      cancelled: failed,
      pending: !paid && !failed,
      orderNumber: paid ? order.order_number : null,
    });
  } catch (err) {
    console.error("get-payment-status error:", err);
    return json({ error: "server_error" }, 500);
  }
});
