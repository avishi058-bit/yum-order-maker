/**
 * get-payment-status
 * Public endpoint used by the payment confirmation screen after returning
 * from the hosted checkout page. The order UUID acts as the (unguessable)
 * token. Returns only whether the payment went through plus the order number —
 * no customer PII is exposed.
 *
 * Source of truth: Z-Credit's GetSessionStatus endpoint. We ask Z-Credit
 * directly (Key + SessionId) whether the hosted page produced a successful
 * transaction, instead of relying only on the async callback. If Z-Credit
 * confirms the charge, we mark the order paid here too.
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

const STATUS_URL =
  "https://pci.zcredit.co.il/webcheckout/api/WebCheckout/GetSessionStatus";

type SessionOutcome = "paid" | "failed" | "pending" | "unknown";

/** Ask Z-Credit what happened on the hosted payment page. */
async function fetchSessionOutcome(sessionId: string): Promise<SessionOutcome> {
  const key = Deno.env.get("ZCREDIT_KEY");
  if (!key) return "unknown";

  try {
    const res = await fetch(STATUS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Key: key, SessionId: sessionId }),
    });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result) return "unknown";

    if (result.HasError === true && !result.Data) {
      console.error("GetSessionStatus error:", JSON.stringify(result).slice(0, 500));
      return "unknown";
    }

    const data = result.Data ?? result;

    // Successful transactions are reported in PaymentsDetails / Transactions.
    const txList: unknown[] =
      (Array.isArray(data.PaymentsDetails) && data.PaymentsDetails) ||
      (Array.isArray(data.Transactions) && data.Transactions) ||
      [];

    const anySuccess = txList.some((t) => {
      const tx = t as Record<string, unknown>;
      const code = tx.ReturnCode ?? tx.ResultCode ?? tx.Status;
      return code === 0 || code === "0" || tx.IsSuccess === true;
    });
    if (anySuccess) return "paid";

    const statusText = String(
      data.SessionStatus ?? data.Status ?? data.PaymentStatus ?? "",
    ).toLowerCase();

    if (["paid", "success", "successful", "completed", "closed"].includes(statusText)) {
      return "paid";
    }
    if (["failed", "declined", "error", "cancelled", "canceled", "expired"].includes(statusText)) {
      return "failed";
    }

    // Nothing happened on the page yet.
    return "pending";
  } catch (err) {
    console.error("GetSessionStatus fetch failed:", err);
    return "unknown";
  }
}

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
      .select("order_number, status, payment_method, payment_session_id")
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
      const outcome = await fetchSessionOutcome(order.payment_session_id);
      if (outcome === "paid") {
        const { data: updated } = await supabase
          .from("orders")
          .update({ status: "new", payment_method: "credit", paid_at: new Date().toISOString() })
          .eq("id", orderId)
          .select("status, payment_method")
          .maybeSingle();
        status = updated?.status ?? "new";
        paymentMethod = updated?.payment_method ?? "credit";
      } else if (outcome === "failed" && status === "pending_payment") {
        await supabase.from("orders").update({ status: "payment_failed" }).eq("id", orderId);
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
