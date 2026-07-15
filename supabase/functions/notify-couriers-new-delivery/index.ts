// Fires web push to all approved couriers when a new delivery_request is created.
// INTERNAL-ONLY: invoked by a pg_net webhook from a DB trigger. No browser calls.
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Only the site's DB trigger can invoke this.
    const provided = req.headers.get("x-internal-secret");
    const { data: expected } = await supabase.rpc("get_webhook_secret");
    if (!provided || !expected || provided !== expected) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { request_id } = await req.json();
    if (!request_id) {
      return new Response(JSON.stringify({ error: "request_id required" }), { status: 400, headers: corsHeaders });
    }

    const { data: reqRow } = await supabase
      .from("delivery_requests")
      .select("id, address, zone_name, price, payout, customer_name, status")
      .eq("id", request_id)
      .maybeSingle();

    if (!reqRow || reqRow.status !== "pending") {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: corsHeaders });
    }

    // Approved couriers only
    const { data: couriers } = await supabase
      .from("couriers")
      .select("id")
      .eq("status", "approved");
    const ids = (couriers ?? []).map((c: any) => c.id);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: corsHeaders });
    }

    const { data: subs } = await supabase
      .from("courier_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("courier_id", ids);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: corsHeaders });
    }

    const payoutTxt = reqRow.payout ?? reqRow.price;
    const payload = JSON.stringify({
      title: "🛵 משלוח חדש זמין",
      body: `${reqRow.address}\n💰 ${payoutTxt}₪ · ${reqRow.zone_name ?? ""}`,
      tag: `courier-delivery-${reqRow.id}`,
      url: `/courier?open=${reqRow.id}`,
      requireInteraction: true,
      actions: [{ action: "open", title: "אני לוקח" }],
    });

    let sent = 0;
    const expired: string[] = [];
    await Promise.all(
      subs.map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sent++;
        } catch (err: any) {
          const status = err?.statusCode;
          if (status === 404 || status === 410) expired.push(s.id);
          else console.error("[courier-push]", status, err?.body || err?.message);
        }
      }),
    );
    if (expired.length) {
      await supabase.from("courier_push_subscriptions").delete().in("id", expired);
    }
    return new Response(JSON.stringify({ ok: true, sent, removed_expired: expired.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[notify-couriers]", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
