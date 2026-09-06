// Sends Web Push notifications to all subscribers of a given order.
// Triggered by DB triggers when an order transitions status. Not called from
// the browser — the Kitchen UI updates the order row and the trigger fires this.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";
import { internalCorsHeaders as corsHeaders } from "../_shared/cors.ts";

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Only the site's DB trigger / kitchen UI (via edge invoke) can call this.
    const provided = req.headers.get("x-internal-secret");
    const { data: expected } = await supabase.rpc("get_webhook_secret");
    if (!provided || !expected || provided !== expected) {
      console.warn("[send-order-ready-push] unauthorized call");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id, type } = await req.json();
    if (!order_id || typeof order_id !== "string") {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const notifType: "ready" | "preparing" | "almost_ready" | "ten_minutes" =
      type === "preparing" || type === "almost_ready" || type === "ten_minutes" ? type : "ready";

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, customer_phone, estimated_ready_at")
      .eq("id", order_id)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute minutes left until estimated ready time (best-effort static value;
    // web push notifications cannot tick live like native iOS Live Activities).
    let minutesLeft: number | null = null;
    if (order.estimated_ready_at) {
      const diffMs = new Date(order.estimated_ready_at).getTime() - Date.now();
      minutesLeft = Math.max(0, Math.round(diffMs / 60000));
    }
    const etaSuffix = minutesLeft !== null && minutesLeft > 0
      ? ` · מוכן בעוד ~${minutesLeft} דק׳ ⏱️`
      : "";

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
    const wazeUrl = "https://waze.com/ul?q=דרך%20ערבי%20נחל%2023%20תושיה";

    const cta = "👇 לצפייה בטיימר בזמן אמת לחצו";

    const titles = {
      ready: "ההזמנה שלך מוכנה לאיסוף ✅🥳",
      preparing: "ההזמנה שלך התקבלה במטבח 👨‍🍳",
      ten_minutes: "ההזמנה שלך — עוד כ־10 דק׳ ומוכנה ⏰",
      almost_ready: "ההזמנה שלך — עוד כ־5 דק׳ ומוכנה 🔥",
    } as const;
    const bodies = {
      ready: `👇 לניווט למסעדה לחץ`,
      preparing: `נעדכן אותך ברגע שתהיה מוכנה${etaSuffix}\n${cta}`,
      ten_minutes: `כדאי להתחיל להתקדם 😋\n${cta}`,
      almost_ready: `המבורגר חם מחכה לך 🍔\n${cta}`,
    } as const;

    const payload = JSON.stringify({
      title: titles[notifType],
      body: bodies[notifType],
      tag: `order-${notifType}-${order.order_number}`,
      url: notifType === "ready" ? wazeUrl : trackUrl,
      waze_url: wazeUrl,
      track_url: trackUrl,
      order_number: order.order_number,
      on_way_url: `${trackUrl}&onway=1`,
      actions: notifType === "ready"
        ? [
            { action: "on_way", title: "🚗 ראיתי, אני בדרך" },
            { action: "waze", title: "🧭 נווט בוויז" },
          ]
        : [{ action: "track", title: "⏱ פתח טיימר" }],
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
