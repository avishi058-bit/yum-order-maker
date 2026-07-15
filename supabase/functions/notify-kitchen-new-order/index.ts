// Sends a Web Push notification to every device that subscribed as a "kitchen"
// device, whenever a new order is created. Triggered by a DB trigger on INSERT
// into public.orders.
// INTERNAL-ONLY: invoked by a pg_net webhook. No browser calls.
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
    // Verify caller is the site's own DB trigger (or admin) via shared secret.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const provided = req.headers.get("x-internal-secret");
    const { data: expected } = await supabase.rpc("get_webhook_secret");
    if (!provided || !expected || provided !== expected) {
      console.warn("[notify-kitchen] unauthorized call");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id } = await req.json();
    if (!order_id || typeof order_id !== "string") {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, total, order_source")
      .eq("id", order_id)
      .maybeSingle();

    if (!order) {
      return new Response(JSON.stringify({ error: "order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subsRaw, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("is_kitchen", true);

    if (subsErr) {
      return new Response(JSON.stringify({ error: subsErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!subsRaw || subsRaw.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceLabel = order.order_source === "kiosk" ? "בקיוסק" : "באתר";
    const customerName = (order.customer_name ?? "").trim() || "לקוח";
    const payload = JSON.stringify({
      title: `🔔 יש לך הזמנה חדשה ${sourceLabel}!`,
      body: `מ${customerName} • הזמנה #${order.order_number} • ₪${order.total ?? ""}`,
      tag: `kitchen-new-${order.order_number}`,
      url: "/kitchen",
      order_number: order.order_number,
    });

    let sent = 0;
    const expiredIds: string[] = [];

    await Promise.all(
      subsRaw.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sent++;
        } catch (err: any) {
          const status = err?.statusCode;
          if (status === 404 || status === 410) {
            expiredIds.push(s.id);
          } else {
            console.error("[kitchen push] send failed", status, err?.body || err?.message);
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
    console.error("[notify-kitchen-new-order] error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
