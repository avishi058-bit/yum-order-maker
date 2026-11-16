// Calendar feed (iCal) of published shifts, subscribed once from Google or
// Apple Calendar: /functions/v1/staff-calendar?t=<personal link token>.
// An employee gets their own shifts; the owner gets every shift with the team.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const icsTime = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const weekStartOf = (ymd: string) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  if (!/^[0-9a-f]{48}$/.test(token)) return new Response("not found", { status: 404 });
  const { data: me } = await supabase
    .from("staff_members").select("id, is_owner, active").eq("token_hash", await hashToken(token)).maybeSingle();
  if (!me || !me.active) return new Response("not found", { status: 404 });

  const from = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const { data: weeks } = await supabase
    .from("staff_schedule_weeks").select("week_start").not("published_at", "is", null).gte("week_start", weekStartOf(from));
  const published = new Set((weeks ?? []).map((w) => w.week_start as string));
  const { data: shifts } = await supabase
    .from("staff_shifts")
    .select("id, shift_date, starts_at, ends_at, staff_shift_assignments(staff_id, staff_members(display_name))")
    .gte("shift_date", from).order("shift_date");

  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HaBikta//Shifts//HE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:משמרות הבקתה", "X-WR-TIMEZONE:Asia/Jerusalem", "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];
  for (const s of (shifts ?? []) as any[]) {
    if (!published.has(weekStartOf(s.shift_date))) continue;
    const team = (s.staff_shift_assignments ?? []).map((a: any) => a.staff_members?.display_name).filter(Boolean);
    const mine = (s.staff_shift_assignments ?? []).some((a: any) => a.staff_id === me.id);
    if (!me.is_owner && !mine) continue;
    const title = me.is_owner ? `משמרת: ${team.length ? team.join(", ") : "אבישי"}` : "משמרת בבקתה";
    lines.push(
      "BEGIN:VEVENT",
      `UID:shift-${s.id}-${me.id}@habikta-burger.com`,
      `DTSTAMP:${icsTime(new Date().toISOString())}`,
      `DTSTART:${icsTime(s.starts_at)}`,
      `DTEND:${icsTime(s.ends_at)}`,
      `SUMMARY:${esc(title)}`,
      "LOCATION:" + esc("הבקתה, דרך ערבי נחל 21, תושיה"),
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc("משמרת בעוד שעה - זמן להתארגן"), "TRIGGER:-PT60M", "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-cache" },
  });
});
