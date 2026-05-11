// Sends Web Push notifications to all subscribers of a given order.
// Triggered by the Kitchen UI when an order's status changes to "ready".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, type } = await req.json();
    if (!order_id || typeof order_id !== "string") {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const notifType: "ready" | "preparing" | "almost_ready" =
      type === "preparing" || type === "almost_ready" ? type : "ready";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, customer_phone")
      .eq("id", order_id)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find subscriptions tied to this order OR matching the customer's phone
    // (covers customers who subscribed before the order existed, e.g. installed PWA earlier).
    const orFilter = order.customer_phone
      ? `order_id.eq.${order_id},customer_phone.eq.${order.customer_phone}`
      : `order_id.eq.${order_id}`;

    const { data: subsRaw, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .or(orFilter);

    if (subsErr) {
      return new Response(JSON.stringify({ error: subsErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedupe by endpoint (a phone may have multiple rows from different orders)
    const seen = new Set<string>();
    const subs = (subsRaw ?? []).filter((s) => {
      if (seen.has(s.endpoint)) return false;
      seen.add(s.endpoint);
      return true;
    });

    if (subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trackUrl = `/track?order=${order.order_number}&phone=${encodeURIComponent(order.customer_phone)}`;
    const payload = JSON.stringify({
      title: "ההזמנה שלך מוכנה! 🎉",
      body: `הזמנה #${order.order_number} מוכנה לאיסוף`,
      tag: `order-ready-${order.order_number}`,
      url: trackUrl,
      order_number: order.order_number,
    });

    let sent = 0;
    const expiredIds: string[] = [];

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sent++;
        } catch (err: any) {
          const status = err?.statusCode;
          // 404/410 = subscription expired or unsubscribed
          if (status === 404 || status === 410) {
            expiredIds.push(s.id);
          } else {
            console.error("[push] send failed", status, err?.body || err?.message);
          }
        }
      }),
    );

    if (expiredIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expiredIds);
    }

    return new Response(
      JSON.stringify({ ok: true, sent, removed_expired: expiredIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[send-order-ready-push] error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
