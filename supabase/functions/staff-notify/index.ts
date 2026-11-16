// Sends the shift reminders queued by public.staff_notify_tick() (cron, every
// minute) as Web Push to each staff member's devices.
// INTERNAL-ONLY: called by pg_net with the shared webhook secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";
import { internalCorsHeaders as corsHeaders } from "../_shared/cors.ts";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@example.com";
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

type Msg = { staff_id: string; title: string; body: string; tag: string; url?: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const provided = req.headers.get("x-internal-secret");
  const { data: expected } = await supabase.rpc("get_webhook_secret");
  if (!provided || !expected || provided !== expected) return json({ error: "unauthorized" }, 401);

  let messages: Msg[] = [];
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  if (!messages.length) return json({ ok: true, sent: 0 });

  const ids = [...new Set(messages.map((m) => m.staff_id).filter((x) => typeof x === "string"))];
  const { data: subs } = await supabase
    .from("staff_push_subscriptions")
    .select("id, staff_id, endpoint, p256dh, auth")
    .in("staff_id", ids);

  let sent = 0;
  const expired: string[] = [];
  await Promise.all(
    messages.flatMap((m) =>
      (subs ?? []).filter((s) => s.staff_id === m.staff_id).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: m.title, body: m.body, tag: m.tag, url: m.url || "/staff" }),
          );
          sent++;
        } catch (err: any) {
          const status = err?.statusCode;
          if (status === 404 || status === 410) expired.push(s.id);
          else console.error("[staff-notify] send failed", status);
        }
      })
    ),
  );
  if (expired.length) await supabase.from("staff_push_subscriptions").delete().in("id", expired);
  return json({ ok: true, sent, removed_expired: expired.length });
});
