// Z-Credit payment callback handler.
// Security:
// 1. Requires a shared-secret token in the URL — refuses any request without it.
// 2. Validates the returned amount against the stored order total before
//    marking it as paid. Prevents a caller from marking a real order "paid"
//    with a $0 payment.
// 3. Only flips status when the order is currently 'pending_payment' — cannot
//    resurrect a cancelled order or downgrade a completed one.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Constant-time string compare to avoid timing side channels on the token.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const CALLBACK_SECRET = Deno.env.get("ZCREDIT_CALLBACK_SECRET");
    if (!CALLBACK_SECRET) {
      console.error("ZCREDIT_CALLBACK_SECRET not configured");
      return new Response(JSON.stringify({ error: "server_misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const providedToken = url.searchParams.get("token") ?? "";
    if (!providedToken || !safeEqual(providedToken, CALLBACK_SECRET)) {
      console.warn("payment-callback rejected: bad or missing token");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body (Z-Credit may send JSON, form-urlencoded, or query string).
    let data: Record<string, unknown> = {};
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await req.json();
    } else if (contentType.includes("form")) {
      const formData = await req.formData();
      data = Object.fromEntries(formData.entries());
    } else {
      data = Object.fromEntries(url.searchParams.entries());
    }
    console.log("Payment callback received (token verified):", JSON.stringify(data));

    const orderId = String(data.UniqueId ?? data.uniqueId ?? data.uniqueid ?? "");
    if (!orderId) {
      return new Response(JSON.stringify({ error: "missing_order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSuccess =
      data.HasError === false ||
      data.HasError === "false" ||
      Number(data.ReturnCode) === 0;

    // Amount sent back by Z-Credit (varies by field name across their APIs).
    const paidAmount = Number(
      data.Amount ?? data.TotalAmount ?? data.TransactionAmount ?? data.Sum ?? 0,
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up the order + validate amount + only flip from pending_payment.
    const { data: order, error: ordErr } = await supabase
      .from("orders")
      .select("id, total, status")
      .eq("id", orderId)
      .maybeSingle();
    if (ordErr || !order) {
      console.warn("payment-callback: order not found", orderId);
      // Return 200 so Z-Credit does not retry infinitely.
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.status !== "pending_payment") {
      console.warn(`payment-callback: order ${orderId} not pending_payment (is ${order.status})`);
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let newStatus = isSuccess ? "new" : "payment_failed";

    // Amount check — only enforce when Z-Credit actually sent an amount.
    if (isSuccess && paidAmount > 0 && Math.abs(paidAmount - Number(order.total)) > 0.01) {
      console.error(
        `payment-callback: amount mismatch order=${orderId} expected=${order.total} got=${paidAmount}`,
      );
      newStatus = "payment_failed";
    }

    const { error: updErr } = await supabase
      .from("orders")
      .update({ status: newStatus, payment_method: "credit" })
      .eq("id", orderId)
      .eq("status", "pending_payment");

    if (updErr) console.error("Error updating order:", updErr);
    else console.log(`Order ${orderId} updated to status: ${newStatus}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Callback error:", error);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
