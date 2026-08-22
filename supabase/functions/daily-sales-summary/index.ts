// Sends a Web Push notification with today's total sales to every kitchen device.
// INTERNAL-ONLY: invoked by a pg_net webhook when the restaurant closes (website
// + kiosk both off) after 22:00 Jerusalem time.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";
import { internalCorsHeaders as corsHeaders } from "../_shared/cors.ts";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Test customers — excluded from the totals (mirrors src/lib/testCustomers.ts)
const EXCLUDED_NAME_PATTERNS = ["טסט", "test", "בדיקה", "בדקה", "אבישי שלזינגר"];
const EXCLUDED_PHONES = ["0539311200", "0501234567"];
const normalize = (v?: string | null) =>
  (v || "").toString().trim().toLowerCase().replace(/[\u200f\u200e]/g, "");
const isTestCustomer = (name?: string | null, phone?: string | null): boolean => {
  const n = normalize(name);
  if (n && EXCLUDED_NAME_PATTERNS.some((p) => n.includes(normalize(p)))) return true;
  const p = normalize(phone).replace(/[^0-9]/g, "");
  if (p && EXCLUDED_PHONES.some((x) => p.endsWith(x.replace(/^0/, "")))) return true;
  return false;
};

/** Fallback start of the current Jerusalem day, as a UTC ISO string. */
const jerusalemDayStartIso = (): string => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const offsetMs =
    Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second")) -
    Math.floor(now.getTime() / 1000) * 1000;
  const localMidnightUtc = Date.UTC(get("year"), get("month") - 1, get("day"), 0, 0, 0) - offsetMs;
  return new Date(localMidnightUtc).toISOString();
};

const parseBusinessDayStart = (body: unknown): string | null => {
  try {
    if (!body || typeof body !== "object") return null;
    const raw = (body as Record<string, unknown>).businessDayStart;
    if (!raw) return null;
    const d = new Date(raw as string);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const provided = req.headers.get("x-internal-secret");
    const { data: expected } = await supabase.rpc("get_webhook_secret");
    if (!provided || !expected || provided !== expected) {
      console.warn("[daily-sales-summary] unauthorized call");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as unknown;
    const since = parseBusinessDayStart(body) ?? jerusalemDayStartIso();

    const { data: orders, error: ordErr } = await supabase
      .from("orders")
      .select("total, status, customer_name, customer_phone")
      .gte("created_at", since);

    if (ordErr) {
      return new Response(JSON.stringify({ error: ordErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const counted = (orders ?? []).filter(
      (o) => o.status !== "cancelled" && !isTestCustomer(o.customer_name, o.customer_phone),
    );
    const total = counted.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
    const totalStr = Number.isInteger(total) ? String(total) : total.toFixed(2);

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("is_kitchen", true);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, total }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title: "📊 סיכום יום",
      body: `סך כל מכירות להיום ${totalStr} שקלים • ${counted.length} הזמנות`,
      tag: `daily-summary-${since.slice(0, 10)}`,
      url: "/kitchen",
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
          if (status === 404 || status === 410) expiredIds.push(s.id);
          else console.error("[daily-summary push] failed", status, err?.body || err?.message);
        }
      }),
    );

    if (expiredIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expiredIds);
    }

    return new Response(JSON.stringify({ ok: true, sent, total }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[daily-sales-summary] error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
