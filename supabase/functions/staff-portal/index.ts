// Gateway for the employee page (/staff/<token>). Employees have no database
// login: every action is gated by their personal link token, stored only as a
// SHA-256 hash in public.staff_members.token_hash.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeadersFor } from "../_shared/cors.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const TZ = "Asia/Jerusalem";

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** YYYY-MM-DD of a moment in Israel time. */
const ilDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dow = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay();
const weekStartOf = (ymd: string) => addDays(ymd, -dow(ymd));

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_body" }, 400); }
  const token = typeof body?.token === "string" ? body.token : "";
  if (!/^[0-9a-f]{48}$/.test(token)) return json({ error: "invalid_link" }, 401);

  const { data: me } = await supabase
    .from("staff_members")
    .select("id, display_name, is_owner, active")
    .eq("token_hash", await hashToken(token))
    .maybeSingle();
  if (!me || !me.active) return json({ error: "invalid_link" }, 401);

  const today = ilDate(new Date());
  const thisWeek = weekStartOf(today);
  const nextWeek = addDays(thisWeek, 7);

  const isPublished = async (weekStart: string) => {
    const { data } = await supabase.from("staff_schedule_weeks").select("published_at").eq("week_start", weekStart).maybeSingle();
    return !!data?.published_at;
  };

  const action = body.action;

  if (action === "set_request") {
    const date = String(body.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "invalid_date" }, 400);
    const ws = weekStartOf(date);
    if (ws < nextWeek || ws > addDays(nextWeek, 7)) return json({ error: "week_closed" }, 400);
    if (await isPublished(ws)) return json({ error: "week_published" }, 409);
    const { data: shift } = await supabase.from("staff_shifts").select("id").eq("shift_date", date).maybeSingle();
    if (!shift) return json({ error: "no_shift" }, 400);
    if (body.on) {
      await supabase.from("staff_shift_requests").upsert({ staff_id: me.id, shift_date: date });
    } else {
      await supabase.from("staff_shift_requests").delete().eq("staff_id", me.id).eq("shift_date", date);
    }
    return json({ ok: true });
  }

  if (action === "push_subscribe") {
    const { endpoint, p256dh, auth } = body;
    if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || typeof p256dh !== "string" || typeof auth !== "string") {
      return json({ error: "invalid_subscription" }, 400);
    }
    await supabase.from("staff_push_subscriptions").delete().eq("endpoint", endpoint);
    const { error } = await supabase.from("staff_push_subscriptions").insert({ staff_id: me.id, endpoint, p256dh, auth });
    if (error) return json({ error: "save_failed" }, 500);
    return json({ ok: true });
  }

  if (action !== "me") return json({ error: "unknown_action" }, 400);

  // Make sure this and next week's shifts exist (from the opening hours).
  await supabase.rpc("staff_ensure_week", { p_week_start: thisWeek });
  await supabase.rpc("staff_ensure_week", { p_week_start: nextWeek });

  const { data: weeks } = await supabase
    .from("staff_schedule_weeks").select("week_start, published_at").not("published_at", "is", null)
    .gte("week_start", addDays(thisWeek, -35));
  const published = new Set((weeks ?? []).map((w) => w.week_start as string));
  const weekOk = (date: string) => published.has(weekStartOf(date));

  // Next week: the days to sign up for.
  const { data: nextShifts } = await supabase
    .from("staff_shifts").select("id, shift_date, starts_at, ends_at")
    .gte("shift_date", nextWeek).lte("shift_date", addDays(nextWeek, 6)).order("shift_date");
  const { data: myReqs } = await supabase
    .from("staff_shift_requests").select("shift_date").eq("staff_id", me.id)
    .gte("shift_date", nextWeek).lte("shift_date", addDays(nextWeek, 6));
  const reqSet = new Set((myReqs ?? []).map((r) => r.shift_date as string));

  // Upcoming shifts from today (published weeks only).
  const { data: upShifts } = await supabase
    .from("staff_shifts")
    .select("id, shift_date, starts_at, ends_at, staff_shift_assignments(staff_id, staff_members(display_name))")
    .gte("shift_date", today).lte("shift_date", addDays(today, 21)).order("shift_date");
  const upcoming = (upShifts ?? [])
    .filter((s: any) => weekOk(s.shift_date))
    .map((s: any) => {
      const names = (s.staff_shift_assignments ?? []).map((a: any) => a.staff_members?.display_name).filter(Boolean);
      const mine = (s.staff_shift_assignments ?? []).some((a: any) => a.staff_id === me.id);
      return { date: s.shift_date, starts_at: s.starts_at, ends_at: s.ends_at, mine, team: names };
    })
    .filter((s) => me.is_owner || s.mine)
    .filter((s) => new Date(s.ends_at).getTime() > Date.now());

  // This month: hours and lateness.
  const monthStart = `${today.slice(0, 7)}-01`;
  const { data: entries } = await supabase
    .from("staff_time_entries")
    .select("clock_in, clock_out, auto_closed, staff_shifts(starts_at)")
    .eq("staff_id", me.id)
    .gte("clock_in", new Date(new Date(`${monthStart}T00:00:00Z`).getTime() - 3 * 3600_000).toISOString())
    .order("clock_in", { ascending: false });
  const monthEntries = (entries ?? [])
    .filter((e: any) => ilDate(new Date(e.clock_in)) >= monthStart)
    .map((e: any) => {
      const end = e.clock_out ? new Date(e.clock_out).getTime() : Date.now();
      const minutes = Math.max(0, Math.round((end - new Date(e.clock_in).getTime()) / 60000));
      const start = e.staff_shifts?.starts_at ? new Date(e.staff_shifts.starts_at).getTime() : null;
      const late = start ? Math.max(0, Math.round((new Date(e.clock_in).getTime() - start) / 60000)) : 0;
      return { clock_in: e.clock_in, clock_out: e.clock_out, minutes, late_minutes: late > 5 ? late : 0, auto_closed: e.auto_closed };
    });
  const open = monthEntries.find((e) => !e.clock_out) ?? null;

  return json({
    me: { name: me.display_name, is_owner: me.is_owner },
    calendar_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/staff-calendar?t=${token}`,
    next_week: {
      week_start: nextWeek,
      published: published.has(nextWeek),
      days: (nextShifts ?? []).map((s) => ({ date: s.shift_date, starts_at: s.starts_at, ends_at: s.ends_at, requested: reqSet.has(s.shift_date as string) })),
    },
    upcoming,
    month: {
      minutes: monthEntries.reduce((n, e) => n + e.minutes, 0),
      late_count: monthEntries.filter((e) => e.late_minutes > 0).length,
      entries: monthEntries,
    },
    open_since: open?.clock_in ?? null,
  });
});
