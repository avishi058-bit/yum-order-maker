/**
 * get-payment-status
 * Public endpoint used by the payment confirmation screen after returning
 * from the hosted checkout page. The order UUID acts as the (unguessable)
 * token. Returns only whether the payment went through plus the order number -
 * no customer PII is exposed.
 *
 * Source of truth: Z-Credit's GetSessionStatus endpoint. We ask Z-Credit
 * directly (Key + SessionId) whether the hosted page produced a successful
 * transaction, instead of relying only on the async callback. If Z-Credit
 * confirms the charge, we mark the order paid here too.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { fetchSessionStatus, amountMatches } from "../_shared/zcreditSession.ts";

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
      .select("order_number, status, payment_method, payment_session_id, total")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return json({ error: "not_found" }, 404);

    const failedStatuses = ["cancelled", "payment_failed", "declined", "refunded"];
    let status = order.status as string;
    let paymentMethod = order.payment_method as string | null;

    // Verify with Z-Credit whenever the DB doesn't already show a confirmed
    // credit charge and we have a session to ask about.
    const alreadyPaid =
      !failedStatuses.includes(status) &&
      status !== "pending_payment" &&
      paymentMethod === "credit";

    if (!alreadyPaid && order.payment_session_id) {
      const { outcome, amount } = await fetchSessionStatus(order.payment_session_id);
      // Only a pending order can become paid, and only for the exact total -
      // never resurrect a cancelled/refunded/failed order.
      if (outcome === "paid" && status === "pending_payment" && amountMatches(amount, order.total)) {
        const { data: updated } = await supabase
          .from("orders")
          .update({ status: "new", payment_method: "credit", paid_at: new Date().toISOString() })
          .eq("id", orderId)
          .eq("status", "pending_payment")
          .select("status, payment_method")
          .maybeSingle();
        if (updated) {
          status = updated.status;
          paymentMethod = updated.payment_method;
        } else {
          const { data: fresh } = await supabase.from("orders").select("status, payment_method").eq("id", orderId).maybeSingle();
          status = fresh?.status ?? status;
          paymentMethod = fresh?.payment_method ?? paymentMethod;
        }
      } else if (outcome === "paid" && status === "pending_payment") {
        console.error(`get-payment-status: amount not confirmed order=${orderId} expected=${order.total} got=${amount}`);
      } else if (outcome === "failed" && status === "pending_payment") {
        await supabase.from("orders").update({ status: "payment_failed" }).eq("id", orderId).eq("status", "pending_payment");
        status = "payment_failed";
      }
    }

    const failed = failedStatuses.includes(status);
    const paid = !failed && status !== "pending_payment" && paymentMethod === "credit";

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
