// Employee personal area: opened from a personal link (/staff/<token>) and
// installable to the phone's home screen. Next shift, this month's shifts (done
// ones ticked, upcoming ones open), next week's availability with one submit
// button, reminders and calendar. Light, colourful look of its own.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Bell, CalendarPlus, Check, Loader2 } from "lucide-react";
import { isIos, isStandalonePwa } from "@/lib/push";
import {
  STAFF_TOKEN_KEY, dateIL, fetchStaffMe, hoursText, submitStaffWeek, subscribeStaffPush, timeIL, type StaffMe,
} from "@/lib/staff";

const readStoredToken = () => {
  try { return localStorage.getItem(STAFF_TOKEN_KEY) ?? ""; } catch { return ""; }
};

// Page palette (scoped to this page).
const C = {
  page: "bg-[#fff7f0] text-[#3a1d12]",
  card: "bg-white rounded-3xl p-4 shadow-[0_6px_18px_rgba(232,80,47,0.12)]",
  muted: "text-[#9a7565]",
  accent: "text-[#e8502f]",
  line: "border-[#ffe3d1]",
  grad: "bg-gradient-to-l from-[#ff8a3d] to-[#e8502f] text-white",
};

const Staff = () => {
  const { token: urlToken } = useParams();
  const token = urlToken ?? readStoredToken();
  const [data, setData] = useState<StaffMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [sending, setSending] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [pushState, setPushState] = useState<"idle" | "busy" | "on">(
    typeof Notification !== "undefined" && Notification.permission === "granted" ? "on" : "idle",
  );
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (urlToken) { try { localStorage.setItem(STAFF_TOKEN_KEY, urlToken); } catch { /* ignore */ } }
    document.title = "משמרות - הבקתה";
  }, [urlToken]);

  const load = useCallback(async () => {
    if (!token) { setError("invalid_link"); return; }
    try {
      setData(await fetchStaffMe(token));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [load]);

  const pushKey = data?.push_key ?? null;
  useEffect(() => {
    if (token && pushKey && pushState === "on") subscribeStaffPush(token, pushKey).catch(() => {});
  }, [token, pushKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = data?.upcoming.find((s) => s.mine || data.me.is_owner) ?? null;
  const nextState = useMemo(() => {
    if (!next) return null;
    const start = new Date(next.starts_at).getTime();
    if (data?.open_since) return { late: false, text: `במשמרת מאז ${timeIL(data.open_since)}` };
    if (now > start + 5 * 60_000 && next.mine) return { late: true, text: "את/ה מאחר/ת - כשמגיעים לוחצים על השם במסך של המסעדה" };
    const mins = Math.round((start - now) / 60_000);
    if (mins <= 0) return { late: false, text: "המשמרת מתחילה עכשיו" };
    if (mins <= 90) return { late: false, text: `עוד ${mins} דקות - זמן להתארגן` };
    return null;
  }, [next, data?.open_since, now]);

  const nw = data?.next_week;
  const saved = useMemo(() => new Set((nw?.days ?? []).filter((d) => d.requested).map((d) => d.date)), [nw]);
  const current = picked ?? saved;
  const changed = picked !== null && (picked.size !== saved.size || [...picked].some((d) => !saved.has(d)));

  const toggle = (date: string) => {
    const s = new Set(current);
    if (s.has(date)) s.delete(date); else s.add(date);
    setPicked(s);
  };

  // House rules for a week's availability: at least one weekend shift (Thursday
  // or Saturday night) and at least 3 shifts - as far as the week has them.
  const ruleNotes = useMemo(() => {
    if (!nw) return [];
    const dow = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay();
    const isWeekend = (ymd: string) => dow(ymd) === 4 || dow(ymd) === 6;
    const notes: string[] = [];
    if (nw.days.some((d) => isWeekend(d.date)) && ![...current].some(isWeekend)) {
      notes.push("יש להגיש משמרת סופ״ש לפחות - חמישי או מוצ״ש.");
    }
    const min = Math.min(3, nw.days.length);
    if (current.size < min) notes.push(`יש להגיש לפחות ${min} משמרות. סימנת ${current.size}.`);
    return notes;
  }, [nw, current]);

  const submit = async (force = false) => {
    if (!nw) return;
    if (!force && ruleNotes.length > 0) { setRulesOpen(true); return; }
    setRulesOpen(false);
    setSending(true);
    try {
      await submitStaffWeek(token, nw.week_start, [...current]);
      toast.success("המשמרות הוגשו לאבישי");
      setPicked(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message === "week_published" ? "הסידור לשבוע הזה כבר פורסם" : "לא נשלח, נסו שוב");
    } finally {
      setSending(false);
    }
  };

  const enablePush = async () => {
    if (!pushKey) return;
    setPushState("busy");
    const r = await subscribeStaffPush(token, pushKey);
    if (r.ok) { setPushState("on"); toast.success("התראות הופעלו"); return; }
    setPushState("idle");
    if (r.reason === "ios_needs_install") toast.error("באייפון צריך קודם להוסיף את הדף למסך הבית (שיתוף ← הוסף למסך הבית) ולפתוח משם");
    else if (r.reason === "denied") toast.error("ההתראות חסומות בהגדרות הדפדפן");
    else toast.error("לא הצלחנו להפעיל התראות במכשיר הזה");
  };

  if (error) {
    return (
      <main dir="rtl" className={`min-h-screen ${C.page} flex items-center justify-center p-6 text-center`}>
        <div className="space-y-2">
          <h1 className="text-xl font-black">הקישור לא תקין</h1>
          <p className={C.muted}>בקשו מאבישי קישור אישי חדש.</p>
        </div>
      </main>
    );
  }
  if (!data || !nw) {
    return (
      <main className={`min-h-screen ${C.page} flex items-center justify-center`}>
        <Loader2 className="animate-spin text-[#e8502f]" size={32} />
      </main>
    );
  }

  const webcal = data.calendar_url ? data.calendar_url.replace(/^https:/, "webcal:") : null;
  const googleCal = webcal ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` : null;
  const done = data.month.entries;
  const ahead = data.upcoming.filter((s) => s.mine || data.me.is_owner);
  const monthName = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", month: "long" }).format(new Date());

  return (
    <main dir="rtl" className={`min-h-screen ${C.page} pb-12`}>
      <header className={`${C.grad} rounded-b-[30px] px-5 pt-7 pb-8`}>
        <h1 className="text-2xl font-black">שלום, {data.me.name.split(" ")[0]} 👋</h1>
        <p className="text-sm opacity-90">האזור האישי שלך בבקתה</p>
      </header>

      <div className="px-4 -mt-4 max-w-lg mx-auto space-y-3">
        {/* Next shift */}
        <section className={`${C.card} ${nextState?.late ? "ring-2 ring-red-500" : ""}`}>
          <p className={`text-xs ${C.muted}`}>{data.me.is_owner ? "המשמרת הבאה" : "המשמרת הבאה שלך"}</p>
          {next ? (
            <>
              <p className={`text-2xl font-black ${C.accent}`}>{next.label} {dateIL(next.date)}</p>
              <p className="font-bold">מתחילים ב-{timeIL(next.starts_at)}</p>
              {data.me.is_owner && <p className={`text-sm ${C.muted}`}>{next.team.length ? next.team.join(", ") : "אתה (אין עובד משובץ)"}</p>}
              {nextState && <p className={`mt-2 font-bold ${nextState.late ? "text-red-600" : "text-green-700"}`}>{nextState.text}</p>}
            </>
          ) : (
            <p className="text-lg font-bold">עוד אין משמרת בסידור שפורסם</p>
          )}
        </section>

        {/* Month totals */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { v: hoursText(data.month.minutes), l: "שעות החודש" },
            { v: String(done.length), l: "משמרות" },
            { v: String(data.month.late_count), l: "איחורים" },
          ].map((s) => (
            <div key={s.l} className="bg-white rounded-3xl py-3 shadow-[0_6px_18px_rgba(232,80,47,0.12)]">
              <p className={`text-xl font-black ${C.accent}`}>{s.v}</p>
              <p className={`text-[11px] ${C.muted}`}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* This month: done (ticked) and still ahead */}
        <section className={C.card}>
          <h2 className="font-black mb-1">המשמרות שלי ב{monthName}</h2>
          {done.length === 0 && ahead.length === 0 && <p className={`text-sm ${C.muted}`}>עוד אין משמרות החודש.</p>}
          <ul>
            {done.map((e) => (
              <li key={e.clock_in} className={`flex items-center justify-between py-2 border-b last:border-0 ${C.line} text-sm`}>
                <span className="flex items-center gap-2 font-bold">
                  <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center"><Check size={13} strokeWidth={4} /></span>
                  {e.label} {dateIL(e.clock_in)}
                </span>
                <span className={C.muted}>
                  {timeIL(e.clock_in)} · {e.clock_out ? `${hoursText(e.minutes)} שעות` : "במשמרת עכשיו"}
                  {e.late_minutes > 0 && <span className="text-red-600 font-bold"> · איחור {e.late_minutes} ד׳</span>}
                </span>
              </li>
            ))}
            {ahead.map((s) => (
              <li key={s.date} className={`flex items-center justify-between py-2 border-b last:border-0 ${C.line} text-sm`}>
                <span className="flex items-center gap-2 font-bold">
                  <span className={`w-5 h-5 rounded-full border-2 ${C.line}`} />
                  {s.label} {dateIL(s.date)}
                </span>
                <span className={C.muted}>
                  מתחילים ב-{timeIL(s.starts_at)}
                  {data.me.is_owner && ` · ${s.team.length ? s.team.join(", ") : "אתה"}`}
                </span>
              </li>
            ))}
          </ul>
          {data.me.is_owner && <a href="/admin/shifts" className={`mt-2 inline-block font-bold underline ${C.accent}`}>לבניית הסידור ←</a>}
        </section>

        {/* Next week availability */}
        {!data.me.is_owner && (
          <section className={C.card}>
            <h2 className="font-black">שבוע הבא - מתי אפשר?</h2>
            <p className={`text-xs mb-3 ${C.muted}`}>
              {nw.published ? "הסידור לשבוע הבא כבר פורסם."
                : nw.submitted_at && !changed ? `הוגש ב-${dateIL(nw.submitted_at)} ${timeIL(nw.submitted_at)}. אפשר לשנות ולהגיש שוב עד שאבישי מפרסם.`
                : "מסמנים ימים ולוחצים על הגשה. אבישי מאשר ושולח את הסידור."}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {nw.days.map((d) => {
                const on = current.has(d.date);
                return (
                  <button
                    key={d.date}
                    type="button"
                    disabled={nw.published || sending}
                    onClick={() => toggle(d.date)}
                    className={`rounded-2xl py-2 border-2 text-center font-bold text-sm transition-colors disabled:opacity-60 ${on ? "bg-[#e8502f] border-[#e8502f] text-white" : `bg-white ${C.line}`}`}
                  >
                    {d.label}
                    <span className={`block text-[11px] font-medium ${on ? "text-white/85" : C.muted}`}>{dateIL(d.date)} · {timeIL(d.starts_at)}</span>
                  </button>
                );
              })}
              {nw.closed.map((d) => (
                <div key={d.date} className="rounded-2xl py-2 border-2 border-dashed border-[#e5d5c8] text-center text-sm text-[#b9a394]">
                  סגור
                  <span className="block text-[11px]">{dateIL(d.date)} · {d.label}</span>
                </div>
              ))}
            </div>
            {!nw.published && (
              <button
                type="button"
                onClick={() => submit()}
                disabled={sending || (!!nw.submitted_at && !changed)}
                className={`mt-3 w-full h-12 rounded-full font-black ${C.grad} disabled:opacity-50`}
              >
                {sending ? "שולח..." : nw.submitted_at && !changed ? "הוגש ✓" : nw.submitted_at ? "הגשה מחדש לאבישי" : "הגשת משמרות לאבישי"}
              </button>
            )}
          </section>
        )}

        {/* Reminders and calendar */}
        <section className={`${C.card} space-y-3`}>
          <h2 className="font-black">תזכורות ויומן</h2>
          {isIos() && !isStandalonePwa() && (
            <p className="text-sm rounded-2xl bg-[#fff1e6] p-3">
              באייפון: לוחצים על כפתור השיתוף, בוחרים "הוסף למסך הבית" ופותחים מהאייקון. רק כך מקבלים התראות.
            </p>
          )}
          {pushKey && (
            <button
              type="button"
              onClick={enablePush}
              disabled={pushState !== "idle"}
              className="w-full h-12 rounded-full bg-[#3a1d12] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <Bell size={18} />
              {pushState === "on" ? "התראות פעילות" : pushState === "busy" ? "מפעיל..." : "הפעלת התראות"}
            </button>
          )}
          <p className={`text-xs ${C.muted}`}>
            {data.me.is_owner
              ? "תקבל התראה כשעובד מאחר יותר מ-5 דקות."
              : "תזכורת בשישי להגיש משמרות, שעה לפני כל משמרת, ואם לא נכנסתם 5 דקות אחרי ההתחלה."}
          </p>
          {webcal && googleCal && (
            <div className="grid grid-cols-2 gap-2">
              <a href={googleCal} target="_blank" rel="noopener noreferrer" className={`h-11 rounded-full border-2 ${C.line} font-bold flex items-center justify-center gap-2 text-sm`}>
                <CalendarPlus size={16} /> יומן גוגל
              </a>
              <a href={webcal} className={`h-11 rounded-full border-2 ${C.line} font-bold flex items-center justify-center gap-2 text-sm`}>
                <CalendarPlus size={16} /> יומן אייפון
              </a>
            </div>
          )}
        </section>
      </div>

      {rulesOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="staff-rules-title">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-3 text-[#3a1d12]">
            <h2 id="staff-rules-title" className="text-lg font-black">רגע לפני ההגשה</h2>
            {ruleNotes.map((n) => <p key={n} className="font-bold">{n}</p>)}
            <button type="button" onClick={() => setRulesOpen(false)} className={`w-full h-12 rounded-full font-black ${C.grad}`}>
              להוסיף משמרת
            </button>
            <button type="button" onClick={() => submit(true)} className={`w-full h-11 rounded-full border-2 ${C.line} font-bold text-sm`}>
              הבנתי, להגיש בכל זאת
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

export default Staff;
