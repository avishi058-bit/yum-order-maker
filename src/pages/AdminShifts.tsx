// Admin: build and publish the weekly shift schedule, manage staff and their
// personal links, and see hours and lateness per month.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Copy, Link2, Loader2, Plus, Send } from "lucide-react";
import {
  addDaysYmd, dateIL, dayNameIL, hoursText, staffDb, timeIL, todayIL, weekStartYmd,
} from "@/lib/staff";

interface Member { id: string; display_name: string; is_owner: boolean; active: boolean; sort_order: number }
interface Shift { id: string; shift_date: string; starts_at: string; ends_at: string }
interface Entry { id: string; staff_id: string; clock_in: string; clock_out: string | null; auto_closed: boolean; staff_shifts: { starts_at: string } | null }

// Light, warm look for the shifts pages (overrides the site's dark tokens here only).
const LIGHT_THEME = {
  "--background": "24 100% 97%", "--foreground": "16 53% 15%", "--card": "0 0% 100%", "--border": "24 100% 91%",
  "--primary": "11 80% 55%", "--primary-foreground": "0 0% 100%", "--muted-foreground": "18 21% 50%",
} as React.CSSProperties;

const SITE = typeof window !== "undefined" ? window.location.origin : "https://habikta-burger.com";

/** Israel wall-clock "HH:MM" on a given date -> ISO instant. */
const ilToIso = (ymd: string, hhmm: string, nextDay = false) => {
  const day = nextDay ? addDaysYmd(ymd, 1) : ymd;
  // Find the offset of Israel time on that day (2 or 3 hours).
  const probe = new Date(`${day}T12:00:00Z`);
  const ilHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", hour12: false }).format(probe));
  const offset = ilHour - 12;
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), h - offset, m)).toISOString();
};

const AdminShifts = () => {
  const [weekStart, setWeekStart] = useState(() => addDaysYmd(weekStartYmd(todayIL()), 7));
  const [members, setMembers] = useState<Member[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [requests, setRequests] = useState<{ staff_id: string; shift_date: string }[]>([]);
  const [assign, setAssign] = useState<{ shift_id: string; staff_id: string }[]>([]);
  const [week, setWeek] = useState<{ published_at: string | null; notified_at: string | null } | null>(null);
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [meals, setMeals] = useState<{ staff_id: string; item_name: string; price: number; created_at: string }[]>([]);
  const [appeals, setAppeals] = useState<{ id: string; staff_id: string; claimed_in: string; staff_time_entries: { clock_in: string } | null }[]>([]);
  const [closedDays, setClosedDays] = useState<{ day: string; label: string | null }[]>([]);
  const [month, setMonth] = useState(() => todayIL().slice(0, 7));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [openPerson, setOpenPerson] = useState<string | null>(null);

  const workers = members.filter((m) => m.active && !m.is_owner);
  const owner = members.find((m) => m.is_owner && m.active);

  const loadWeek = useCallback(async () => {
    setLoading(true);
    await staffDb.rpc("staff_ensure_week", { p_week_start: weekStart });
    const end = addDaysYmd(weekStart, 6);
    const [m, s, r, w, sub, cl] = await Promise.all([
      staffDb.from("staff_members").select("id, display_name, is_owner, active, sort_order").order("sort_order").order("display_name"),
      staffDb.from("staff_shifts").select("id, shift_date, starts_at, ends_at").gte("shift_date", weekStart).lte("shift_date", end).order("shift_date"),
      staffDb.from("staff_shift_requests").select("staff_id, shift_date").gte("shift_date", weekStart).lte("shift_date", end),
      staffDb.from("staff_schedule_weeks").select("published_at, notified_at").eq("week_start", weekStart).maybeSingle(),
      staffDb.from("staff_week_submissions").select("staff_id").eq("week_start", weekStart),
      staffDb.from("staff_special_days").select("day, label").eq("closed", true).gte("day", weekStart).lte("day", end).order("day"),
    ]);
    setSubmitted((sub.data ?? []).map((x: { staff_id: string }) => x.staff_id));
    setClosedDays(cl.data ?? []);
    setMembers(m.data ?? []);
    setShifts(s.data ?? []);
    setRequests(r.data ?? []);
    setWeek(w.data ?? null);
    const ids = (s.data ?? []).map((x: Shift) => x.id);
    const a = ids.length ? await staffDb.from("staff_shift_assignments").select("shift_id, staff_id").in("shift_id", ids) : { data: [] };
    setAssign(a.data ?? []);
    setLoading(false);
  }, [weekStart]);

  const loadMonth = useCallback(async () => {
    const from = new Date(`${month}-01T00:00:00Z`);
    const to = new Date(from); to.setUTCMonth(to.getUTCMonth() + 1);
    const { data } = await staffDb
      .from("staff_time_entries")
      .select("id, staff_id, clock_in, clock_out, auto_closed, staff_shifts(starts_at)")
      .gte("clock_in", new Date(from.getTime() - 3 * 3600_000).toISOString())
      .lt("clock_in", new Date(to.getTime() - 2 * 3600_000).toISOString())
      .order("clock_in", { ascending: false });
    setEntries((data ?? []).filter((e: Entry) => todayFromIso(e.clock_in).startsWith(month)));
    const ml = await staffDb.from("staff_meal_logs").select("staff_id, item_name, price, created_at")
      .gte("created_at", new Date(from.getTime() - 3 * 3600_000).toISOString())
      .lt("created_at", new Date(to.getTime() - 2 * 3600_000).toISOString()).order("created_at", { ascending: false });
    setMeals((ml.data ?? []).filter((x: { created_at: string }) => todayFromIso(x.created_at).startsWith(month)));
  }, [month]);

  const loadAppeals = useCallback(async () => {
    const { data } = await staffDb.from("staff_entry_appeals")
      .select("id, staff_id, claimed_in, staff_time_entries(clock_in)").eq("status", "pending").order("created_at");
    setAppeals(data ?? []);
  }, []);
  const decideAppeal = async (id: string, approve: boolean) => {
    const { error } = await staffDb.rpc("staff_decide_appeal", { p_appeal_id: id, p_approve: approve });
    if (error) { toast.error("לא נשמר"); return; }
    toast.success(approve ? "אושר - שעת הכניסה עודכנה" : "הערעור נדחה");
    loadAppeals(); loadMonth();
  };

  useEffect(() => { document.title = "סידור עבודה - הבקתה"; }, []);
  useEffect(() => { loadAppeals(); }, [loadAppeals]);
  useEffect(() => { loadWeek(); }, [loadWeek]);
  useEffect(() => { loadMonth(); }, [loadMonth]);

  const toggleAssign = async (shiftId: string, staffId: string) => {
    const has = assign.some((a) => a.shift_id === shiftId && a.staff_id === staffId);
    setAssign(has ? assign.filter((a) => !(a.shift_id === shiftId && a.staff_id === staffId)) : [...assign, { shift_id: shiftId, staff_id: staffId }]);
    const q = has
      ? staffDb.from("staff_shift_assignments").delete().eq("shift_id", shiftId).eq("staff_id", staffId)
      : staffDb.from("staff_shift_assignments").insert({ shift_id: shiftId, staff_id: staffId });
    const { error } = await q;
    if (error) { toast.error("לא נשמר"); loadWeek(); }
  };

  const saveTimes = async (s: Shift, from: string, to: string) => {
    const starts = ilToIso(s.shift_date, from);
    const ends = ilToIso(s.shift_date, to, to <= from);
    const { error } = await staffDb.from("staff_shifts").update({ starts_at: starts, ends_at: ends }).eq("id", s.id);
    if (error) toast.error("לא נשמר"); else { toast.success("השעות עודכנו"); loadWeek(); }
  };

  const setDayClosed = async (day: string, closed: boolean) => {
    if (closed && !window.confirm("לסגור את היום הזה? השיבוצים שלו יימחקו.")) return;
    const { error } = await staffDb.rpc("staff_set_day_closed", { p_day: day, p_closed: closed });
    if (error) toast.error("לא נשמר"); else loadWeek();
  };

  const publish = async () => {
    const { error } = await staffDb.from("staff_schedule_weeks")
      .upsert({ week_start: weekStart, published_at: new Date().toISOString(), notified_at: null });
    if (error) toast.error("לא פורסם"); else { toast.success("הסידור פורסם - כל עובד מקבל את המשמרות שלו"); loadWeek(); }
  };

  const addMember = async () => {
    const name = newName.trim();
    if (!name) return;
    const { error } = await staffDb.from("staff_members").insert({ display_name: name, sort_order: members.length });
    if (error) toast.error("לא נשמר"); else { setNewName(""); loadWeek(); }
  };

  const setActive = async (m: Member, active: boolean) => {
    await staffDb.from("staff_members").update({ active }).eq("id", m.id);
    loadWeek();
  };

  const issueLink = async (m: Member) => {
    if (links[m.id] === undefined && !window.confirm(`ליצור קישור אישי ל${m.display_name}? קישור קודם שלו/ה יפסיק לעבוד.`)) return;
    const { data, error } = await staffDb.rpc("staff_issue_link", { p_staff_id: m.id });
    if (error || !data) { toast.error("לא נוצר קישור"); return; }
    setLinks({ ...links, [m.id]: `${SITE}/staff/${data}` });
  };

  const byPerson = useMemo(() => {
    const map = new Map<string, { minutes: number; late: number; list: (Entry & { minutes: number; lateMin: number })[] }>();
    for (const e of entries) {
      const minutes = Math.max(0, Math.round(((e.clock_out ? new Date(e.clock_out).getTime() : Date.now()) - new Date(e.clock_in).getTime()) / 60000));
      const start = e.staff_shifts?.starts_at ? new Date(e.staff_shifts.starts_at).getTime() : null;
      const lateRaw = start ? Math.round((new Date(e.clock_in).getTime() - start) / 60000) : 0;
      const lateMin = lateRaw > 5 ? lateRaw : 0;
      const cur = map.get(e.staff_id) ?? { minutes: 0, late: 0, list: [] };
      cur.minutes += minutes; if (lateMin) cur.late++;
      cur.list.push({ ...e, minutes, lateMin });
      map.set(e.staff_id, cur);
    }
    return map;
  }, [entries]);

  const changed = !!week?.published_at;
  const weekLabel = `${dateIL(weekStart)} - ${dateIL(addDaysYmd(weekStart, 6))}`;

  return (
    <main dir="rtl" className="min-h-screen bg-background text-foreground pb-20" style={LIGHT_THEME}>
      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-black">סידור עבודה</h1>
          <Link to="/kitchen" className="text-sm text-primary underline">למסך המטבח</Link>
        </header>

        {appeals.length > 0 && (
          <section className="rounded-2xl bg-card border-2 border-primary p-4 space-y-3">
            <h2 className="text-lg font-black">ערעורים על שעת כניסה</h2>
            {appeals.map((a) => {
              const who = members.find((m) => m.id === a.staff_id)?.display_name ?? "";
              const rec = a.staff_time_entries?.clock_in;
              return (
                <div key={a.id} className="flex items-center justify-between gap-2 flex-wrap border-t border-border pt-3">
                  <p className="text-sm">
                    <b>{who}</b>{rec ? ` · ${dayNameIL(rec)} ${dateIL(rec)}` : ""}
                    <br />נרשם {rec ? timeIL(rec) : "-"} · מבקש/ת לתקן ל-<b>{timeIL(a.claimed_in)}</b>
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => decideAppeal(a.id, true)} className="px-4 py-2 rounded-full bg-green-600 text-white font-bold text-sm">אישור</button>
                    <button type="button" onClick={() => decideAppeal(a.id, false)} className="px-4 py-2 rounded-full border border-border font-bold text-sm">דחייה</button>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Week picker */}
        <div className="flex items-center justify-between rounded-2xl bg-card border border-border p-3">
          <button type="button" aria-label="שבוע קודם" onClick={() => setWeekStart(addDaysYmd(weekStart, -7))} className="p-2"><ChevronRight /></button>
          <div className="text-center">
            <p className="font-black">שבוע {weekLabel}</p>
            <p className={`text-xs ${week?.published_at ? "text-green-500" : "text-muted-foreground"}`}>
              {week?.published_at ? `פורסם ${dateIL(week.published_at)} ${timeIL(week.published_at)}` : "טיוטה - העובדים עוד לא רואים"}
            </p>
          </div>
          <button type="button" aria-label="שבוע הבא" onClick={() => setWeekStart(addDaysYmd(weekStart, 7))} className="p-2"><ChevronLeft /></button>
        </div>

        {/* Days */}
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
        ) : (
          <section className="space-y-3">
            {workers.length > 0 && (
              <p className="text-sm">
                הגישו משמרות:{" "}
                {workers.map((w, i) => (
                  <span key={w.id} className={submitted.includes(w.id) ? "text-green-600 font-bold" : "text-muted-foreground"}>
                    {i > 0 && " · "}{w.display_name} {submitted.includes(w.id) ? "✓" : "- עוד לא"}
                  </span>
                ))}
              </p>
            )}
            {shifts.length === 0 && <p className="text-muted-foreground">אין ימי פתיחה בשבוע הזה.</p>}
            {shifts.map((s) => {
              const assigned = workers.filter((w) => assign.some((a) => a.shift_id === s.id && a.staff_id === w.id));
              return (
                <div key={s.id} className="rounded-2xl bg-card border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-black text-lg">
                      {dayNameIL(s.shift_date)} {dateIL(s.shift_date)}
                      <span className="text-sm font-bold text-primary"> · מתחילים ב-{timeIL(s.starts_at)}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <ShiftTimes shift={s} onSave={saveTimes} />
                      <button type="button" onClick={() => setDayClosed(s.shift_date, true)} className="text-xs underline text-muted-foreground">סגירת יום</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {workers.map((w) => {
                      const on = assigned.some((a) => a.id === w.id);
                      const asked = requests.some((r) => r.staff_id === w.id && r.shift_date === s.shift_date);
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => toggleAssign(s.id, w.id)}
                          className={`px-4 py-2 rounded-full border-2 font-bold text-sm transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : asked ? "border-green-600 text-foreground" : "border-border text-muted-foreground"}`}
                        >
                          {w.display_name}{asked && !on ? " ✓ ביקש/ה" : ""}
                        </button>
                      );
                    })}
                  </div>
                  {assigned.length === 0 && <p className="text-sm text-muted-foreground">אין עובד משובץ - {owner?.display_name ?? "אתה"} במשמרת</p>}
                </div>
              );
            })}
            {closedDays.map((d) => (
              <div key={d.day} className="rounded-2xl border border-dashed border-border p-4 flex items-center justify-between text-muted-foreground">
                <span>{dayNameIL(d.day)} {dateIL(d.day)} · סגור{d.label ? ` - ${d.label}` : ""}</span>
                <button type="button" onClick={() => setDayClosed(d.day, false)} className="text-sm underline">פתיחת היום</button>
              </div>
            ))}
            {shifts.length > 0 && (
              <button type="button" onClick={publish} className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black text-lg flex items-center justify-center gap-2">
                <Send size={18} /> {changed ? "פרסום מחדש (העובדים יקבלו עדכון)" : "פרסום הסידור לעובדים"}
              </button>
            )}
            <p className="text-xs text-muted-foreground">✓ ביקש/ה = העובד סימן שהוא יכול לעבוד ביום הזה. לחיצה על שם משבצת או מורידה.</p>
          </section>
        )}

        {/* Hours */}
        <section className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">שעות ואיחורים</h2>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="bg-background border border-border rounded-lg px-2 py-1" />
          </div>
          {members.filter((m) => m.active).map((m) => {
            const p = byPerson.get(m.id);
            const myMeals = meals.filter((x) => x.staff_id === m.id);
            const mealsTotal = myMeals.reduce((n, x) => n + Number(x.price), 0);
            return (
              <div key={m.id} className="border-t border-border pt-2">
                <button type="button" onClick={() => setOpenPerson(openPerson === m.id ? null : m.id)} className="w-full flex items-center justify-between py-1">
                  <span className="font-bold">{m.display_name}</span>
                  <span className="text-sm">
                    {hoursText(p?.minutes ?? 0)} ש׳ · {p?.list.length ?? 0} משמרות
                    {p?.late ? <span className="text-destructive font-bold"> · {p.late} איחורים</span> : null}
                    {mealsTotal > 0 && <span className="text-primary font-bold"> · ארוחות {mealsTotal} ₪</span>}
                  </span>
                </button>
                {openPerson === m.id && myMeals.length > 0 && (
                  <p className="text-sm text-muted-foreground pb-2">
                    ארוחות ושתייה: {myMeals.map((x) => `${x.item_name} ${Number(x.price)} ₪ (${dateIL(x.created_at)})`).join(" · ")}
                  </p>
                )}
                {openPerson === m.id && p && (
                  <ul className="text-sm text-muted-foreground space-y-1 pb-2">
                    {p.list.map((e) => (
                      <li key={e.id} className="flex justify-between">
                        <span>{dayNameIL(e.clock_in)} {dateIL(e.clock_in)}</span>
                        <span>
                          {timeIL(e.clock_in)} - {e.clock_out ? timeIL(e.clock_out) : "במשמרת"} · {hoursText(e.minutes)}
                          {e.lateMin > 0 && <span className="text-destructive"> · איחור {e.lateMin} ד׳</span>}
                          {e.auto_closed && " · יציאה לא נרשמה"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>

        {/* Staff and links */}
        <section className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <h2 className="text-lg font-black">עובדים וקישורים אישיים</h2>
          {members.map((m) => (
            <div key={m.id} className="border-t border-border pt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className={`font-bold ${m.active ? "" : "line-through text-muted-foreground"}`}>
                  {m.display_name}{m.is_owner ? " (בעלים)" : ""}
                </span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => issueLink(m)} className="text-sm px-3 py-1.5 rounded-lg border border-border flex items-center gap-1">
                    <Link2 size={14} /> קישור אישי
                  </button>
                  {!m.is_owner && (
                    <button type="button" onClick={() => setActive(m, !m.active)} className="text-sm px-3 py-1.5 rounded-lg border border-border">
                      {m.active ? "השבתה" : "החזרה"}
                    </button>
                  )}
                </div>
              </div>
              {links[m.id] && (
                <div className="rounded-xl bg-background p-3 space-y-2">
                  <p className="text-xs break-all">{links[m.id]}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { navigator.clipboard.writeText(links[m.id]); toast.success("הקישור הועתק"); }}
                      className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground flex items-center gap-1"><Copy size={14} /> העתקה</button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(`הקישור האישי שלך למשמרות בבקתה (שמור אותו ותוסיף למסך הבית): ${links[m.id]}`)}`}
                      target="_blank" rel="noopener noreferrer" className="text-sm px-3 py-1.5 rounded-lg bg-green-600 text-white">שליחה בוואטסאפ</a>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="flex gap-2 border-t border-border pt-3">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="שם עובד חדש"
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2" />
            <button type="button" onClick={addMember} className="px-4 rounded-lg bg-primary text-primary-foreground font-bold flex items-center gap-1"><Plus size={16} /> הוספה</button>
          </div>
        </section>
      </div>
    </main>
  );
};

const todayFromIso = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(iso));

const ShiftTimes = ({ shift, onSave }: { shift: Shift; onSave: (s: Shift, from: string, to: string) => void }) => {
  const [from, setFrom] = useState(timeIL(shift.starts_at));
  const [to, setTo] = useState(timeIL(shift.ends_at));
  const dirty = from !== timeIL(shift.starts_at) || to !== timeIL(shift.ends_at);
  return (
    <div className="flex items-center gap-1 text-sm">
      <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-background border border-border rounded-lg px-1 py-1" aria-label="התחלה" />
      <span>-</span>
      <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className="bg-background border border-border rounded-lg px-1 py-1" aria-label="סיום" />
      {dirty && <button type="button" onClick={() => onSave(shift, from, to)} className="px-2 py-1 rounded-lg bg-primary text-primary-foreground font-bold">שמירה</button>}
    </div>
  );
};

export default AdminShifts;
