// Employee page: opened from a personal link (/staff/<token>) and installable to
// the phone's home screen. Shows the next shift, next week's sign-up, the
// published schedule, this month's hours and lateness, push reminders and a
// calendar subscription.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Bell, CalendarPlus, Check, Clock, Loader2 } from "lucide-react";
import logo from "@/assets/logo.webp";
import { isIos, isStandalonePwa } from "@/lib/push";
import {
  STAFF_TOKEN_KEY, callStaffPortal, dateIL, dayNameIL, hoursText, subscribeStaffPush, timeIL, type StaffMe,
} from "@/lib/staff";

const readStoredToken = () => {
  try { return localStorage.getItem(STAFF_TOKEN_KEY) ?? ""; } catch { return ""; }
};

const Staff = () => {
  const { token: urlToken } = useParams();
  const token = urlToken ?? readStoredToken();
  const [data, setData] = useState<StaffMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyDate, setBusyDate] = useState<string | null>(null);
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
      setData(await callStaffPortal<StaffMe>(token, "me"));
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

  // Re-register the push subscription quietly when permission is already granted.
  useEffect(() => {
    if (token && pushState === "on") subscribeStaffPush(token).catch(() => {});
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = data?.upcoming.find((s) => s.mine || data.me.is_owner) ?? null;
  const nextState = useMemo(() => {
    if (!next) return null;
    const start = new Date(next.starts_at).getTime();
    if (data?.open_since) return { tone: "ok", text: `במשמרת מאז ${timeIL(data.open_since)}` };
    if (now > start + 5 * 60_000 && next.mine) return { tone: "late", text: "את/ה מאחר/ת - לחצו על השם שלכם במסך המטבח כשמגיעים" };
    const mins = Math.round((start - now) / 60_000);
    if (mins <= 0) return { tone: "soon", text: "המשמרת מתחילה עכשיו" };
    if (mins <= 90) return { tone: "soon", text: `מתחילה בעוד ${mins} דקות - זמן להתארגן` };
    return null;
  }, [next, data?.open_since, now]);

  const toggleDay = async (date: string, on: boolean) => {
    if (!data) return;
    setBusyDate(date);
    setData({ ...data, next_week: { ...data.next_week, days: data.next_week.days.map((d) => d.date === date ? { ...d, requested: on } : d) } });
    try {
      await callStaffPortal(token, "set_request", { date, on });
    } catch (e) {
      toast.error((e as Error).message === "week_published" ? "הסידור לשבוע הזה כבר פורסם" : "לא נשמר, נסו שוב");
      await load();
    } finally {
      setBusyDate(null);
    }
  };

  const enablePush = async () => {
    setPushState("busy");
    const r = await subscribeStaffPush(token);
    if (r.ok) { setPushState("on"); toast.success("התראות הופעלו"); return; }
    setPushState("idle");
    if (r.reason === "ios_needs_install") toast.error("באייפון צריך קודם להוסיף את הדף למסך הבית (שיתוף ← הוסף למסך הבית) ולפתוח משם");
    else if (r.reason === "denied") toast.error("ההתראות חסומות בהגדרות הדפדפן");
    else toast.error("לא הצלחנו להפעיל התראות במכשיר הזה");
  };

  if (error) {
    return (
      <main dir="rtl" className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <img src={logo} alt="הבקתה" className="w-20 h-20 mx-auto rounded-full" />
          <h1 className="text-xl font-black">הקישור לא תקין</h1>
          <p className="text-muted-foreground">בקשו מאבישי קישור אישי חדש לדף המשמרות.</p>
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </main>
    );
  }

  const webcal = data.calendar_url.replace(/^https:/, "webcal:");
  const googleCal = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  const nw = data.next_week;

  return (
    <main dir="rtl" className="min-h-screen bg-background text-foreground pb-16">
      <header className="flex items-center gap-3 px-4 pt-5 pb-3 max-w-lg mx-auto">
        <img src={logo} alt="הבקתה" className="w-12 h-12 rounded-full" />
        <div>
          <h1 className="text-xl font-black">שלום, {data.me.name}</h1>
          <p className="text-sm text-muted-foreground">משמרות הבקתה</p>
        </div>
      </header>

      <div className="px-4 max-w-lg mx-auto space-y-4">
        {/* Next shift */}
        <section className={`rounded-2xl p-5 border ${nextState?.tone === "late" ? "border-destructive bg-destructive/10" : "border-primary/40 bg-card"}`}>
          <p className="text-sm text-muted-foreground mb-1">{data.me.is_owner ? "המשמרת הבאה" : "המשמרת הבאה שלך"}</p>
          {next ? (
            <>
              <p className="text-2xl font-black">{dayNameIL(next.date)} {dateIL(next.date)}</p>
              <p className="text-lg font-bold text-primary">{timeIL(next.starts_at)} - {timeIL(next.ends_at)}</p>
              {data.me.is_owner && <p className="text-sm text-muted-foreground mt-1">{next.team.length ? next.team.join(", ") : "אתה (אין עובד משובץ)"}</p>}
              {nextState && (
                <p className={`mt-3 font-bold ${nextState.tone === "late" ? "text-destructive" : nextState.tone === "ok" ? "text-green-500" : "text-primary"}`}>
                  {nextState.text}
                </p>
              )}
            </>
          ) : (
            <p className="text-lg font-bold">אין משמרת בסידור שפורסם</p>
          )}
        </section>

        {/* Next week sign-up */}
        {!data.me.is_owner && (
          <section className="rounded-2xl p-5 bg-card border border-border">
            <h2 className="text-lg font-black">השבוע הבא - מתי אתם יכולים לעבוד?</h2>
            <p className="text-sm text-muted-foreground mb-3">
              {nw.published ? "הסידור לשבוע הבא כבר פורסם." : "סמנו את הימים, עד שישי. אבישי בונה את הסידור ומפרסם."}
            </p>
            <div className="space-y-2">
              {nw.days.length === 0 && <p className="text-muted-foreground">אין ימי פתיחה בשבוע הבא.</p>}
              {nw.days.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  disabled={nw.published || busyDate === d.date}
                  onClick={() => toggleDay(d.date, !d.requested)}
                  className={`w-full flex items-center justify-between rounded-xl px-4 py-3 border-2 transition-colors disabled:opacity-60 ${d.requested ? "border-primary bg-primary/15" : "border-border bg-background"}`}
                >
                  <span className="font-bold">{dayNameIL(d.date)} {dateIL(d.date)}</span>
                  <span className="flex items-center gap-2 text-sm">
                    {timeIL(d.starts_at)} - {timeIL(d.ends_at)}
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center ${d.requested ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                      {d.requested && <Check size={16} />}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Published schedule */}
        <section className="rounded-2xl p-5 bg-card border border-border">
          <h2 className="text-lg font-black mb-3">{data.me.is_owner ? "הסידור" : "המשמרות שלי"}</h2>
          {data.upcoming.length === 0 ? (
            <p className="text-muted-foreground">עוד אין משמרות בסידור שפורסם.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.upcoming.map((s) => (
                <li key={s.date} className="py-2 flex items-center justify-between">
                  <span className="font-bold">{dayNameIL(s.date)} {dateIL(s.date)}</span>
                  <span className="text-sm text-muted-foreground">
                    {timeIL(s.starts_at)} - {timeIL(s.ends_at)}
                    {data.me.is_owner && ` · ${s.team.length ? s.team.join(", ") : "אתה"}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {data.me.is_owner && (
            <a href="/admin/shifts" className="mt-3 inline-block text-primary font-bold underline underline-offset-4">לבניית הסידור ←</a>
          )}
        </section>

        {/* This month */}
        <section className="rounded-2xl p-5 bg-card border border-border">
          <h2 className="text-lg font-black mb-3 flex items-center gap-2"><Clock size={18} /> החודש</h2>
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div className="rounded-xl bg-background py-3"><p className="text-2xl font-black">{hoursText(data.month.minutes)}</p><p className="text-xs text-muted-foreground">שעות</p></div>
            <div className="rounded-xl bg-background py-3"><p className="text-2xl font-black">{data.month.entries.length}</p><p className="text-xs text-muted-foreground">משמרות</p></div>
            <div className="rounded-xl bg-background py-3"><p className={`text-2xl font-black ${data.month.late_count ? "text-destructive" : ""}`}>{data.month.late_count}</p><p className="text-xs text-muted-foreground">איחורים</p></div>
          </div>
          {data.month.entries.length > 0 && (
            <ul className="text-sm divide-y divide-border">
              {data.month.entries.map((e) => (
                <li key={e.clock_in} className="py-2 flex items-center justify-between gap-2">
                  <span>{dayNameIL(e.clock_in)} {dateIL(e.clock_in)}</span>
                  <span className="text-muted-foreground">
                    {timeIL(e.clock_in)} - {e.clock_out ? timeIL(e.clock_out) : "עכשיו"} · {hoursText(e.minutes)}
                    {e.late_minutes > 0 && <span className="text-destructive font-bold"> · איחור {e.late_minutes} ד׳</span>}
                    {e.auto_closed && <span> · יציאה לא נרשמה</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Reminders and calendar */}
        <section className="rounded-2xl p-5 bg-card border border-border space-y-3">
          <h2 className="text-lg font-black">תזכורות ויומן</h2>
          {isIos() && !isStandalonePwa() && (
            <p className="text-sm rounded-xl bg-primary/10 p-3">
              באייפון: לחצו על כפתור השיתוף ובחרו "הוסף למסך הבית", ופתחו את הדף מהאייקון. רק כך אפשר לקבל התראות.
            </p>
          )}
          <button
            type="button"
            onClick={enablePush}
            disabled={pushState !== "idle"}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-70"
          >
            <Bell size={18} />
            {pushState === "on" ? "התראות פעילות" : pushState === "busy" ? "מפעיל..." : "הפעלת התראות"}
          </button>
          <p className="text-xs text-muted-foreground">
            {data.me.is_owner
              ? "תקבל התראה כשעובד מאחר יותר מ-5 דקות."
              : "תזכורת בשישי לשלוח משמרות, שעה לפני כל משמרת, ואם לא נכנסתם 5 דקות אחרי ההתחלה."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <a href={googleCal} target="_blank" rel="noopener noreferrer" className="h-12 rounded-xl border-2 border-border font-bold flex items-center justify-center gap-2">
              <CalendarPlus size={18} /> יומן גוגל
            </a>
            <a href={webcal} className="h-12 rounded-xl border-2 border-border font-bold flex items-center justify-center gap-2">
              <CalendarPlus size={18} /> יומן אייפון
            </a>
          </div>
          <p className="text-xs text-muted-foreground">מוסיפים פעם אחת, והמשמרות מתעדכנות ביומן לבד (בגוגל זה יכול לקחת כמה שעות).</p>
        </section>
      </div>
    </main>
  );
};

export default Staff;
