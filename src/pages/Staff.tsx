// Employee personal area: opened from a personal link (/staff/<token>) and
// installable to the phone's home screen. Next shift, this month's shifts (done
// ones ticked, upcoming ones open), next week's availability with one submit
// button, reminders and calendar. Light, colourful look of its own.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Bell, CalendarPlus, Check, Loader2 } from "lucide-react";
import { isIos, isStandalonePwa } from "@/lib/push";
import StaffWaste from "@/components/staff/StaffWaste";
import {
  STAFF_TOKEN_KEY, STOCK_CATEGORIES, addDaysYmd, todayIL, weekStartYmd, addStaffMeal, setStaffStock, stockText, itemPack, packPlural, fetchStaffTasks, setStaffTask, halfText, groupTasks, type ShiftTask, type StockItem, type StockLevel, appealStaffEntry, dateIL, removeStaffMeal, fetchStaffMe, hoursText, submitStaffWeek, subscribeStaffPush, timeIL, type StaffMe,
} from "@/lib/staff";

/** One-tap "add this shift" link for Google Calendar. */
const googleEventUrl = (startsAt: string, endsAt: string) => {
  const t = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: "משמרת בבקתה",
    dates: `${t(startsAt)}/${t(endsAt)}`,
    location: "הבקתה, דרך ערבי נחל 21, תושיה",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
};

const readStoredToken = () => {
  try { return localStorage.getItem(STAFF_TOKEN_KEY) ?? ""; } catch { return ""; }
};

// Page palette (scoped to this page).
// Light and calm: white page, one warm card for "what now", orange only for
// the main button of each screen, green for done, red for ran out.
const C = {
  page: "bg-white text-[#2b1a12]",
  card: "bg-white rounded-[28px] p-4 border border-[#f0e6df]",
  hero: "rounded-[28px] p-5 bg-[#fff7f0] border border-[#ffe0cc]",
  muted: "text-[#9a8478]",
  accent: "text-[#e8502f]",
  line: "border-[#f3ece7]",
  grad: "bg-[#e8502f] text-white",
};
/** Progress bar (fills from the right). */
const Progress = ({ done, total }: { done: number; total: number }) => (
  <div className="h-3 rounded-full bg-[#ffe3d1] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
    <div className="h-full rounded-full bg-gradient-to-l from-[#e8502f] to-[#ff8a3d] transition-[width] duration-500" style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
  </div>
);
const REQUIRED = " (חובה לפני יציאה)";

const Staff = () => {
  const { token: urlToken } = useParams();
  const token = urlToken ?? readStoredToken();
  const [data, setData] = useState<StaffMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [sending, setSending] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [stockCat, setStockCat] = useState<string>("ירקות");
  const [stockMode, setStockMode] = useState<"missing" | "waste">("missing");
  const [stockEdit, setStockEdit] = useState<{ item: StockItem; qty: number } | null>(null);
  const [calAdded, setCalAdded] = useState(() => { try { return localStorage.getItem("habikta_staff_cal") === "1"; } catch { return false; } });
  const markCalAdded = () => { setCalAdded(true); try { localStorage.setItem("habikta_staff_cal", "1"); } catch { /* ignore */ } };
  const [tab, setTab] = useState<"home" | "shifts" | "meals" | "stock" | "tasks">("home");
  const [tasks, setTasks] = useState<{ on_shift: boolean; tasks: ShiftTask[] } | null>(null);
  const [counting, setCounting] = useState<{ task: ShiftTask; values: Record<string, number> } | null>(null);
  const [appeal, setAppeal] = useState<{ id: string; clockIn: string; time: string } | null>(null);
  const [pushState, setPushState] = useState<"idle" | "busy" | "on">(
    typeof Notification !== "undefined" && Notification.permission === "granted" ? "on" : "idle",
  );
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (urlToken) { try { localStorage.setItem(STAFF_TOKEN_KEY, urlToken); } catch { /* ignore */ } }
    document.title = "הבקתה - עובדים";
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

  const loadTasks = useCallback(async () => {
    if (!token) return;
    try { setTasks(await fetchStaffTasks(token)); } catch { /* shown as empty */ }
  }, [token]);

  useEffect(() => { load(); loadTasks(); }, [load, loadTasks]);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    const onFocus = () => { load(); loadTasks(); };
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

  const sendAppeal = async () => {
    if (!appeal) return;
    setSending(true);
    try {
      await appealStaffEntry(token, appeal.id, appeal.time);
      toast.success("הערעור נשלח לאבישי");
      setAppeal(null);
      await load();
    } catch (e) {
      const code = (e as Error).message;
      toast.error(code === "invalid_time" ? "השעה צריכה להיות לפני שעת הכניסה שנרשמה" : code === "appeal_pending" ? "כבר יש ערעור שממתין לאישור" : "לא נשלח, נסו שוב");
    } finally {
      setSending(false);
    }
  };

  const saveStock = async (level: StockLevel | null, qty?: number) => {
    if (!stockEdit) return;
    const it = stockEdit.item;
    setStockEdit(null);
    try {
      await setStaffStock(token, it.id, level, qty);
      await load();
    } catch {
      toast.error("לא נשמר, נסו שוב");
    }
  };

  const tickTask = async (t: ShiftTask, done: boolean) => {
    if (t.kind === "count" || t.kind === "supplier_count") {
      if (done) setCounting({ task: t, values: Object.fromEntries((t.items ?? []).map((i) => [i.id, 0])) });
      return;
    }
    setTasks((cur) => cur && { ...cur, tasks: cur.tasks.map((x) => (x.id === t.id ? { ...x, done } : x)) });
    try { await setStaffTask(token, t.id, done); } catch { toast.error("לא נשמר, נסו שוב"); }
    loadTasks();
  };
  const saveCount = async () => {
    if (!counting) return;
    setSending(true);
    try {
      await setStaffTask(token, counting.task.id, true, Object.entries(counting.values).map(([item_id, quantity]) => ({ item_id, quantity })));
      setCounting(null);
      await Promise.all([loadTasks(), load()]);
    } catch {
      toast.error("לא נשמר, נסו שוב");
    } finally {
      setSending(false);
    }
  };

  const addMeal = async (item: { id: string; name: string; price: number }) => {
    try {
      const logId = await addStaffMeal(token, item.id);
      // Taking a report back is possible only for a few seconds, from this toast.
      toast.success(`נרשם: ${item.name} - ${item.price} ₪`, {
        duration: 8000,
        action: logId ? { label: "ביטול", onClick: () => removeMeal(logId) } : undefined,
      });
      await load();
    } catch {
      toast.error("לא נרשם, נסו שוב");
    }
  };
  const removeMeal = async (id: string) => {
    try { await removeStaffMeal(token, id); toast.success("הדיווח בוטל"); await load(); } catch { toast.error("כבר אי אפשר לבטל את הדיווח הזה"); }
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
  const done = data.month.entries;
  const ahead = data.upcoming.filter((s) => s.mine || data.me.is_owner);
  const monthName = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", month: "long" }).format(new Date());

  const tile = "rounded-3xl bg-[#f7f3f0] active:scale-[0.97] transition-transform";
  const taskList = (tasks?.tasks ?? []).filter((t) => t.source !== "idle" || !t.done);
  const tasksDone = taskList.filter((t) => t.done).length;
  const nextTask = taskList.find((t) => !t.done);
  const onShift = !!data.open_since && !!tasks?.on_shift;
  const today = todayIL();
  const todayShift = data.upcoming.find((s) => s.date === today);
  const firstName = data.me.name.split(" ")[0];
  const todayText = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", weekday: "long", day: "numeric", month: "numeric" }).format(new Date());
  // This week Sunday to Saturday night, without Friday (closed).
  const week = Array.from({ length: 7 }, (_, i) => addDaysYmd(weekStartYmd(today), i)).filter((d) => new Date(`${d}T12:00:00Z`).getUTCDay() !== 5);
  const myDates = new Set([...ahead.map((s) => s.date), ...done.map((e) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(new Date(e.clock_in).getTime() - 4 * 3600_000)))]);
  const closedDates = new Set(nw.closed.map((d) => d.date));
  const tabs = [
    { id: "home", icon: "🏠", label: "בית" },
    { id: "shifts", icon: "📅", label: "משמרות" },
    ...(data.me.is_owner ? [] : [{ id: "meals", icon: "🍔", label: "ארוחות" }]),
    { id: "stock", icon: "📦", label: "מלאי" },
    { id: "tasks", icon: "✅", label: "משימות" },
  ] as { id: typeof tab; icon: string; label: string }[];
  const stockOpenCount = data.stock?.filter((i) => i.level).length ?? 0;
  const openTasks = tasks?.tasks.filter((t) => !t.done && t.source !== "idle").length ?? 0;

  return (
    <main dir="rtl" className={`min-h-screen ${C.page} pb-24`}>
      <header className="max-w-lg mx-auto px-5 pt-6 pb-1 flex items-baseline justify-between">
        <h1 className="text-2xl font-black">היי {firstName}</h1>
        <span className={`text-sm ${C.muted}`}>{todayText}</span>
      </header>
      {/* Tabs sit at the top: the bottom corner is covered by the hosting badge. */}
      <nav aria-label="ניווט" className="sticky top-0 z-40 bg-white/95 backdrop-blur px-3 pt-2 pb-2">
        <div className="max-w-lg mx-auto flex gap-0.5 rounded-[18px] bg-[#f7f3f0] p-1">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => { setTab(t.id); window.scrollTo(0, 0); }} aria-current={tab === t.id ? "page" : undefined}
              className={`relative flex-1 py-2 rounded-[14px] text-[13px] whitespace-nowrap transition-colors ${tab === t.id ? `bg-white ${C.accent} font-black shadow-sm` : `${C.muted} font-semibold`}`}>
              {t.label}
              {((t.id === "tasks" && openTasks > 0) || (t.id === "stock" && stockOpenCount > 0)) && (
                <span className="absolute -top-1 left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">
                  {t.id === "tasks" ? openTasks : stockOpenCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <div className="px-4 pt-4 max-w-lg mx-auto space-y-4">
        {tab === "home" && (
          <>
            {onShift ? (
              <section className={C.hero}>
                <p className="text-sm font-semibold text-[#b0705a]">במשמרת מאז {timeIL(data.open_since!)}</p>
                <h2 className="text-3xl font-black mt-1">
                  {taskList.length === 0 ? "אין משימות כרגע" : nextTask ? `נשארו ${taskList.length - tasksDone} משימות` : "כל המשימות בוצעו ✓"}
                </h2>
                {nextTask && <p className="text-[15px] text-[#7a5e50] mt-0.5">הבאה: {nextTask.title.replace(REQUIRED, "")}</p>}
                {taskList.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    <Progress done={tasksDone} total={taskList.length} />
                    <div className={`flex justify-between text-[13px] font-semibold ${C.muted}`}>
                      <span>{tasksDone} מתוך {taskList.length}</span>
                      {todayShift && <span>עד {timeIL(todayShift.ends_at)}</span>}
                    </div>
                  </div>
                )}
                <button type="button" onClick={() => { setTab("tasks"); window.scrollTo(0, 0); }} className={`mt-4 w-full h-14 rounded-full text-lg font-black ${C.grad}`}>למשימות</button>
              </section>
            ) : (
              <section className={`${C.hero} ${nextState?.late ? "ring-2 ring-red-500" : ""}`}>
                <p className="text-sm font-semibold text-[#b0705a]">{data.me.is_owner ? "המשמרת הבאה" : "המשמרת הבאה שלך"}</p>
                {next ? (
                  <>
                    <h2 className="text-3xl font-black mt-1">{next.date === today ? "היום" : next.label} {timeIL(next.starts_at)}</h2>
                    <p className={`text-[15px] mt-0.5 ${nextState?.late ? "text-red-600 font-bold" : "text-[#7a5e50]"}`}>
                      {nextState?.text ?? ""}{nextState && next.team.length > (next.mine ? 1 : 0) ? " · " : ""}
                      {next.team.filter((n) => n !== data.me.name).length > 0 && `עם ${next.team.filter((n) => n !== data.me.name).join(", ")}`}
                    </p>
                  </>
                ) : (
                  <h2 className="text-2xl font-black mt-1">עוד אין משמרת בסידור</h2>
                )}
                <div className="flex justify-between mt-4" aria-label="השבוע שלי">
                  {week.map((d) => {
                    const mine = myDates.has(d);
                    const closed = closedDates.has(d);
                    return (
                      <span key={d} className={`w-10 text-center text-[11px] font-semibold ${C.muted}`}>
                        <span className={`mx-auto mb-1 w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-black ${
                          mine ? `bg-[#e8502f] text-white ${d < today ? "opacity-50" : ""}` : closed ? "border-[1.5px] border-dashed border-[#e2d4cb] text-[#c4b5ab]" : "bg-[#f7f3f0] text-[#2b1a12]"}`}>
                          {["א", "ב", "ג", "ד", "ה", "ו", "מ"][new Date(`${d}T12:00:00Z`).getUTCDay()]}
                        </span>
                        {d === today ? "היום" : closed ? "סגור" : ""}
                      </span>
                    );
                  })}
                </div>
              </section>
            )}

            {!data.me.is_owner && !nw.published && !nw.submitted_at && (
              <section className={C.card}>
                <p className="text-sm font-semibold text-[#b0705a]">הגשת משמרות לשבוע הבא</p>
                <h2 className="text-xl font-black mt-1">עוד לא הגשת</h2>
                <button type="button" onClick={() => { setTab("shifts"); window.scrollTo(0, 0); }} className={`mt-4 w-full h-14 rounded-full text-lg font-black ${C.grad}`}>להגשה</button>
              </section>
            )}

            <div className="grid grid-cols-2 gap-3">
              {onShift && next ? (
                <div className={`${tile} p-4`}><p className={`text-sm ${C.muted}`}>המשמרת הבאה</p><p className="text-lg font-black">{next.label} {timeIL(next.starts_at)}</p></div>
              ) : (
                <div className={`${tile} p-4`}><p className={`text-sm ${C.muted}`}>שעות החודש</p><p className="text-lg font-black">{hoursText(data.month.minutes)}</p></div>
              )}
              {!data.me.is_owner && data.meals ? (
                <button type="button" onClick={() => { setTab("meals"); window.scrollTo(0, 0); }} className={`${tile} p-4 text-right`}>
                  <p className={`text-sm ${C.muted}`}>ארוחות החודש</p><p className="text-lg font-black">{data.meals.month_total} ₪</p>
                </button>
              ) : (
                <div className={`${tile} p-4`}><p className={`text-sm ${C.muted}`}>משמרות החודש</p><p className="text-lg font-black">{done.length}</p></div>
              )}
            </div>

            {/* One-time setup: shown until notifications are on and (on iPhone) the calendar was added. */}
            {(pushState !== "on" || (isIos() && (!isStandalonePwa() || (webcal && !calAdded)))) && <section className={`${C.card} space-y-3`}>
              {isIos() && !isStandalonePwa() && (
                <p className="text-sm rounded-2xl bg-[#fff1e6] p-3">
                  באייפון: כפתור השיתוף ← "הוסף למסך הבית", ואז פותחים מהאייקון. רק כך מקבלים התראות.
                </p>
              )}
              {pushKey && (
                <button type="button" onClick={enablePush} disabled={pushState !== "idle"}
                  className="w-full h-14 rounded-full bg-[#2b1a12] text-white text-base font-bold flex items-center justify-center gap-2 disabled:opacity-70">
                  <Bell size={20} />
                  {pushState === "on" ? "התראות פעילות ✓" : pushState === "busy" ? "מפעיל..." : "הפעלת התראות"}
                </button>
              )}
              {webcal && isIos() && (
                <a href={webcal} onClick={markCalAdded} className={`h-12 rounded-full border-2 ${C.line} font-bold flex items-center justify-center gap-2`}>
                  <CalendarPlus size={18} /> יומן אייפון - מתעדכן לבד
                </a>
              )}
            </section>}
            {data.me.is_owner && <a href="/admin/shifts" className={`block text-center font-bold underline ${C.accent}`}>לבניית הסידור ←</a>}
          </>
        )}

        {tab === "shifts" && (
          <>
            {!data.me.is_owner && (
              <section className={`${C.card} !p-5`}>
                <h2 className="text-xl font-black">שבוע הבא - מתי אפשר?</h2>
                <p className={`text-sm mb-4 ${C.muted}`}>
                  {nw.published ? "הסידור לשבוע הבא כבר פורסם."
                    : nw.submitted_at && !changed ? `הוגש ב-${dateIL(nw.submitted_at)}. אפשר לשנות ולהגיש שוב.`
                    : "נוגעים בימים שאפשר, ואז מגישים."}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {nw.days.map((d) => {
                    const on = current.has(d.date);
                    return (
                      <button key={d.date} type="button" disabled={nw.published || sending} onClick={() => toggle(d.date)}
                        className={`h-20 rounded-3xl border-2 text-center transition-all active:scale-[0.97] disabled:opacity-60 ${on ? "bg-[#e8502f] border-[#e8502f] text-white shadow-lg" : `bg-white ${C.line}`}`}>
                        <span className="block text-lg font-black">{on ? "✓ " : ""}{d.label}</span>
                        <span className={`block text-sm ${on ? "text-white/90" : C.muted}`}>{dateIL(d.date)} · {timeIL(d.starts_at)}</span>
                      </button>
                    );
                  })}
                  {nw.closed.map((d) => (
                    <div key={d.date} className="h-20 rounded-3xl border-2 border-dashed border-[#e5d5c8] flex flex-col items-center justify-center text-[#b9a394]">
                      <span className="font-bold">סגור</span>
                      <span className="text-xs">{dateIL(d.date)} · {d.label}</span>
                    </div>
                  ))}
                </div>
                {!nw.published && (
                  <button type="button" onClick={() => submit()} disabled={sending || (!!nw.submitted_at && !changed)}
                    className={`mt-4 w-full h-14 rounded-full text-lg font-black ${C.grad} disabled:opacity-50`}>
                    {sending ? "שולח..." : nw.submitted_at && !changed ? "הוגש ✓" : nw.submitted_at ? "הגשה מחדש" : "הגשה לאבישי"}
                  </button>
                )}
              </section>
            )}

            <section className={`${C.card} !p-5`}>
              <h2 className="text-xl font-black mb-2">המשמרות שלי ב{monthName}</h2>
              {done.length === 0 && ahead.length === 0 && <p className={C.muted}>עוד אין משמרות החודש.</p>}
              <ul>
                {ahead.map((s) => (
                  <li key={s.date} className={`flex items-center justify-between gap-2 py-3 border-b last:border-0 ${C.line}`}>
                    <span>
                      <span className="block font-black">{s.label} {dateIL(s.date)}</span>
                      <span className={`block text-sm ${C.muted}`}>
                        מתחילים ב-{timeIL(s.starts_at)}{data.me.is_owner && ` · ${s.team.length ? s.team.join(", ") : "אתה"}`}
                      </span>
                    </span>
                    {/* Only published shifts reach this list, so the button appears after publishing. */}
                    <a href={googleEventUrl(s.starts_at, s.ends_at)} target="_blank" rel="noopener noreferrer"
                      className={`shrink-0 rounded-full border-2 ${C.line} px-3 py-2 text-sm font-bold ${C.accent} flex items-center gap-1`}>
                      <CalendarPlus size={16} /> ליומן
                    </a>
                  </li>
                ))}
                {[...done].reverse().map((e) => (
                  <li key={e.clock_in} className={`py-3 border-b last:border-0 ${C.line}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-green-600 text-white flex items-center justify-center shrink-0"><Check size={16} strokeWidth={4} /></span>
                        <span>
                          <span className="block font-black">{e.label} {dateIL(e.clock_in)}</span>
                          <span className={`block text-sm ${C.muted}`}>
                            כניסה {timeIL(e.clock_in)} · {e.clock_out ? `יציאה ${timeIL(e.clock_out)} · ${hoursText(e.minutes)} שעות` : "במשמרת עכשיו"}
                            {e.late_minutes > 0 && <span className="text-red-600 font-bold"> · איחור {e.late_minutes} ד׳</span>}
                          </span>
                        </span>
                      </span>
                      {e.appeal?.status !== "pending" && (
                        <button type="button" aria-label="ערעור על שעת הכניסה"
                          onClick={() => setAppeal({ id: e.id, clockIn: e.clock_in, time: timeIL(e.clock_in) })}
                          className={`w-10 h-10 rounded-full border-2 ${C.line} flex items-center justify-center text-xl font-black leading-none shrink-0`}>
                          ⋯
                        </button>
                      )}
                    </div>
                    {e.appeal && (
                      <p className={`text-sm pr-9 ${e.appeal.status === "approved" ? "text-green-700" : e.appeal.status === "rejected" ? "text-red-600" : C.muted}`}>
                        {e.appeal.status === "pending" ? `ערעור ל-${timeIL(e.appeal.claimed_in)} ממתין לאישור`
                          : e.appeal.status === "approved" ? "הערעור התקבל - השעה עודכנה" : "הערעור נדחה"}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {tab === "meals" && data.meals && (
          <>
            <section className={`${C.card} !p-5 text-center`}>
              <p className={`text-sm ${C.muted}`}>לקחתי החודש</p>
              <p className={`text-4xl font-black ${C.accent}`}>{data.meals.month_total} ₪</p>
            </section>
            <p className={`text-sm text-center ${C.muted}`}>נוגעים במה שלקחתם וזה נרשם. ביטול רק בשניות הראשונות.</p>
            <div className="grid grid-cols-2 gap-3">
              {data.meals.items.map((i) => (
                <button key={i.id} type="button" onClick={() => addMeal(i)} className={`${tile} h-20 px-2 text-center`}>
                  <span className="block text-lg font-black">{i.name}</span>
                  <span className={`block text-sm font-bold ${C.accent}`}>{i.price} ₪</span>
                </button>
              ))}
            </div>
            {data.meals.logs.length > 0 && (
              <section className={C.card}>
                <h2 className="font-black mb-1">מה נרשם החודש</h2>
                <ul>
                  {data.meals.logs.map((l) => (
                    <li key={l.id} className={`flex items-center justify-between py-2 border-b last:border-0 ${C.line}`}>
                      <span>{l.name} <span className={`text-sm ${C.muted}`}>· {dateIL(l.at)}</span></span>
                      <b>{l.price} ₪</b>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {tab === "tasks" && (
          <section className="px-1">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-2xl font-black">הערב</h2>
              {tasks?.on_shift && taskList.length > 0 && <span className={`text-[15px] font-bold ${C.accent}`}>{tasksDone} מתוך {taskList.length}</span>}
            </div>
            {!tasks?.on_shift ? (
              <p className={C.muted}>המשימות מופיעות כאן כשאת/ה במשמרת.</p>
            ) : taskList.length === 0 ? (
              <p className={C.muted}>אין משימות כרגע.</p>
            ) : (
              <>
                <Progress done={tasksDone} total={taskList.length} />
                {groupTasks(taskList).map((g) => (
                <div key={g.section ?? "_"} className="mt-3">
                {g.section && <h3 className={`text-sm font-black mt-4 ${C.muted}`}>{g.section}</h3>}
                <ul>
                  {(g.section ? g.tasks : [...g.tasks.filter((t) => !t.done), ...g.tasks.filter((t) => t.done)]).map((t) => {
                    const isCount = t.kind === "count" || t.kind === "supplier_count";
                    const required = t.title.includes(REQUIRED);
                    return (
                      <li key={t.id} className={`border-b last:border-0 ${C.line} flex items-center gap-2`}>
                        <button type="button" onClick={() => tickTask(t, !t.done)} disabled={isCount && t.done} aria-pressed={t.done}
                          className="flex-1 flex items-center gap-3.5 py-4 text-right">
                          <span className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center transition-all duration-300 ${
                            t.done ? "bg-green-600 scale-100" : "border-[2.5px] border-[#e2d4cb]"}`} aria-hidden>
                            {t.done && <Check size={18} strokeWidth={4} className="text-white animate-in zoom-in-50 duration-300" />}
                          </span>
                          <span className={`flex-1 text-[17px] transition-colors ${t.done ? "text-[#c4b5ab]" : "font-semibold"}`}>
                            {t.title.replace(REQUIRED, "")}
                            {!t.done && t.at_opening && <span className={`text-xs ${C.muted}`}> · בפתיחה</span>}
                            {isCount && !t.done && <span className={`block text-xs font-normal ${C.muted}`}>{(t.items ?? []).map((i) => i.name).join(", ")}</span>}
                          </span>
                          {required && !t.done && <span className="shrink-0 rounded-full bg-[#fdecea] text-[#c0392b] text-xs font-bold px-2.5 py-1">חובה</span>}
                          {isCount && !t.done && !required && <span className={`shrink-0 rounded-full bg-[#fff0e6] ${C.accent} text-xs font-bold px-2.5 py-1`}>לספור</span>}
                        </button>
                        {/* "stock" / "stock:<category>": straight to that part of the stock tab. */}
                        {t.action?.startsWith("stock") && !t.done && (
                          <button type="button" onClick={() => {
                            setTab("stock"); setStockMode("missing");
                            const cat = t.action!.split(":")[1];
                            if (cat) setStockCat(cat);
                            window.scrollTo(0, 0);
                          }} className={`shrink-0 rounded-full bg-[#fff0e6] ${C.accent} text-sm font-black px-3 py-2`}>
                            {t.action.includes(":") ? "לספירה" : "למלאי"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                </div>
                ))}
              </>
            )}
          </section>
        )}

        {tab === "stock" && data.stock && (
          <div className="flex rounded-[18px] bg-[#f7f3f0] p-1" role="tablist">
            {([["missing", "מה חסר"], ["waste", "נזרק משהו"]] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={stockMode === id} onClick={() => setStockMode(id)}
                className={`flex-1 py-2.5 rounded-[14px] text-[15px] ${stockMode === id ? `bg-white ${C.accent} font-black shadow-sm` : `${C.muted} font-semibold`}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        {tab === "stock" && stockMode === "waste" && <StaffWaste token={token} />}
        {tab === "stock" && stockMode === "missing" && data.stock && (
          <>
            <p className={`text-sm ${C.muted}`}>נוגעים במוצר ומסמנים כמה נשאר, "נשאר קצת" או "נגמר".</p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
              {STOCK_CATEGORIES.map((c) => {
                const n = data.stock.filter((i) => i.category === c && i.level).length;
                return (
                  <button key={c} type="button" onClick={() => setStockCat(c)}
                    className={`shrink-0 rounded-full px-5 h-12 text-base font-black border-2 ${stockCat === c ? "bg-[#3a1d12] border-[#3a1d12] text-white" : `bg-white ${C.line}`}`}>
                    {c}{n > 0 ? ` · ${n}` : ""}
                  </button>
                );
              })}
            </div>
            {data.stock.filter((i) => i.category === stockCat).length === 0 && <p className={`text-center ${C.muted}`}>עוד אין מוצרים בקטגוריה הזו.</p>}
            <div className="grid grid-cols-2 gap-3">
              {data.stock.filter((i) => i.category === stockCat).map((i) => (
                <button key={i.id} type="button" onClick={() => setStockEdit({ item: i, qty: i.quantity != null ? Number(i.quantity) : Number(i.step) })}
                  className={`h-20 px-2 rounded-3xl text-center border-2 transition-all active:scale-[0.97] ${
                    i.level === "out" ? "bg-red-600 border-red-600 text-white shadow-lg"
                      : i.level === "low" ? "bg-[#ffd24d] border-[#ffd24d] text-[#3a1d12] shadow-lg"
                      : i.level === "count" ? "bg-[#ff8a3d] border-[#ff8a3d] text-white shadow-lg"
                      : `bg-white ${C.line}`}`}>
                  <span className="block text-base font-black leading-tight">{i.name}</span>
                  <span className={`block text-sm font-bold ${i.level ? "" : C.muted}`}>{stockText(i.level, i.quantity, i.unit, itemPack(i))}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>


      {counting && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="staff-count-title" onClick={() => !sending && setCounting(null)}>
          <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-5 space-y-3 text-[#3a1d12]" onClick={(e) => e.stopPropagation()}>
            <h2 id="staff-count-title" className="text-xl font-black text-center">{counting.task.title}</h2>
            <ul>
              {(counting.task.items ?? []).map((i) => {
                const v = counting.values[i.id] ?? 0;
                const pack = itemPack(i);
                const set = (n: number) => setCounting({ ...counting, values: { ...counting.values, [i.id]: Math.max(0, Math.min(9999, n)) } });
                return (
                  <li key={i.id} className={`py-3 border-b last:border-0 ${C.line}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black">{i.name}<span className={`block text-xs font-bold ${C.muted}`}>{i.unit}{pack ? ` · ${pack.name} = ${pack.size}` : ""}</span></span>
                      {!pack && (
                        <span className="flex items-center gap-2">
                          <button type="button" aria-label={`פחות ${i.name}`} onClick={() => set(v - Number(i.step))} className={`w-11 h-11 rounded-full border-2 ${C.line} text-2xl font-black`}>−</button>
                          <span className="w-12 text-center text-2xl font-black">{halfText(v)}</span>
                          <button type="button" aria-label={`יותר ${i.name}`} onClick={() => set(v + Number(i.step))} className={`w-11 h-11 rounded-full border-2 ${C.line} text-2xl font-black`}>+</button>
                        </span>
                      )}
                    </div>
                    {pack && (() => {
                      const packs = Math.floor(v / pack.size);
                      const rest = v - packs * pack.size;
                      const mini = (label: string, value: string, d: number) => (
                        <span className="flex items-center gap-1.5">
                          <button type="button" aria-label={`פחות ${label} ${i.name}`} onClick={() => set(v - d)} className={`w-10 h-10 rounded-full border-2 ${C.line} text-xl font-black`}>−</button>
                          <span className="w-10 text-center"><span className="block text-xl font-black leading-none">{value}</span><span className={`text-[11px] font-bold ${C.muted}`}>{label}</span></span>
                          <button type="button" aria-label={`יותר ${label} ${i.name}`} onClick={() => set(v + d)} className={`w-10 h-10 rounded-full border-2 ${C.line} text-xl font-black`}>+</button>
                        </span>
                      );
                      return (
                        <div className="flex items-center justify-around mt-2">
                          {mini(packPlural(pack.name), String(packs), pack.size)}
                          {mini(i.unit, halfText(rest), Number(i.step))}
                        </div>
                      );
                    })()}
                  </li>
                );
              })}
            </ul>
            <button type="button" onClick={saveCount} disabled={sending} className="w-full h-14 rounded-full text-lg font-black bg-green-600 text-white disabled:opacity-50">
              {sending ? "שומר…" : "שמירת הספירה"}
            </button>
            <button type="button" onClick={() => setCounting(null)} disabled={sending} className={`w-full h-12 rounded-full border-2 ${C.line} font-bold`}>ביטול</button>
          </div>
        </div>
      )}

      {stockEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="staff-stock-title" onClick={() => setStockEdit(null)}>
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-3 text-[#3a1d12]" onClick={(e) => e.stopPropagation()}>
            <h2 id="staff-stock-title" className="text-2xl font-black text-center">{stockEdit.item.name}</h2>
            {stockEdit.item.low_only ? (
              <button type="button" onClick={() => saveStock("low")} className="w-full h-16 rounded-full bg-[#ffd24d] text-[#3a1d12] text-xl font-black">נשאר קצת</button>
            ) : (
              <>
                <p className={`text-center ${C.muted}`}>כמה {stockEdit.item.unit} נשארו?</p>
                {(() => {
                  const pack = itemPack(stockEdit.item);
                  const setQty = (q: number) => setStockEdit({ ...stockEdit, qty: Math.max(0, Math.min(9999, q)) });
                  // The number itself can be typed with the keyboard too.
                  const stepper = (label: string | null, value: string, minus: () => void, plus: () => void, typed?: (n: number) => void) => (
                    <div className="flex items-center justify-center gap-5">
                      <button type="button" aria-label={`פחות${label ? ` ${label}` : ""}`} onClick={minus}
                        className={`w-14 h-14 rounded-full border-2 ${C.line} text-3xl font-black`}>−</button>
                      <span className="w-24 text-center" aria-live="polite">
                        {typed && !value.includes("½") ? (
                          <input type="number" inputMode="numeric" min={0} value={value} aria-label={label ?? "כמות"}
                            onChange={(e) => typed(Math.max(0, Math.floor(Number(e.target.value) || 0)))} onFocus={(e) => e.target.select()}
                            className={`w-24 text-center text-5xl font-black bg-transparent border-b-2 ${C.line} focus:outline-none focus:border-[#e8502f]`} />
                        ) : <span className="block text-5xl font-black">{value}</span>}
                        {label && <span className={`block text-sm font-bold ${C.muted}`}>{label}</span>}
                      </span>
                      <button type="button" aria-label={`יותר${label ? ` ${label}` : ""}`} onClick={plus}
                        className={`w-14 h-14 rounded-full border-2 ${C.line} text-3xl font-black`}>+</button>
                    </div>
                  );
                  if (pack) {
                    const packs = Math.floor(stockEdit.qty / pack.size);
                    const units = stockEdit.qty - packs * pack.size;
                    return (
                      <>
                        {stepper(`${packPlural(pack.name)} (${pack.size})`, String(packs), () => setQty(stockEdit.qty - pack.size), () => setQty(stockEdit.qty + pack.size), (n) => setQty(n * pack.size + units))}
                        {stepper(stockEdit.item.unit, halfText(units), () => setQty(stockEdit.qty - Number(stockEdit.item.step)), () => setQty(stockEdit.qty + Number(stockEdit.item.step)), (n) => setQty(packs * pack.size + n))}
                      </>
                    );
                  }
                  const step = Number(stockEdit.item.step);
                  const q = stockEdit.qty;
                  return stepper(null, Number.isInteger(q) ? String(q) : `${q >= 1 ? Math.floor(q) : ""}½`, () => setQty(q - step), () => setQty(q + step), setQty);
                })()}
                <button type="button" onClick={() => saveStock("count", stockEdit.qty)} className="w-full h-14 rounded-full text-lg font-black bg-green-600 text-white">
                  {stockEdit.qty === 0 ? "שמירה: נגמר" : `שמירה: ${stockText("count", stockEdit.qty, stockEdit.item.unit, itemPack(stockEdit.item))}`}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => saveStock("low")} className="h-14 rounded-full bg-[#ffd24d] text-[#3a1d12] text-lg font-black">נשאר קצת</button>
                  <button type="button" onClick={() => saveStock("out")} className="h-14 rounded-full bg-red-600 text-white text-lg font-black">נגמר</button>
                </div>
              </>
            )}
            {stockEdit.item.level && (
              <button type="button" onClick={() => saveStock(null)} className={`w-full h-12 rounded-full border-2 ${C.line} font-bold`}>יש מספיק - ביטול הדיווח</button>
            )}
          </div>
        </div>
      )}

      {appeal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="staff-appeal-title">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-3 text-[#3a1d12]">
            <h2 id="staff-appeal-title" className="text-xl font-black">נכנסת מאוחר בטעות?</h2>
            <p>
              ב-{dateIL(appeal.clockIn)} נרשמה כניסה ב-{timeIL(appeal.clockIn)}. באיזו שעה הגעת באמת?
            </p>
            {/* Starts at the recorded time; the employee moves it back to when they really came. */}
            <input type="time" value={appeal.time} max={timeIL(appeal.clockIn)} onChange={(ev) => setAppeal({ ...appeal, time: ev.target.value })}
              aria-label="שעת ההגעה האמיתית"
              className={`w-full h-14 rounded-2xl border-2 ${C.line} px-3 text-2xl font-black text-center bg-white`} />
            <p className={`text-sm ${C.muted}`}>השעה תתעדכן רק אחרי אישור של אבישי.</p>
            <button type="button" onClick={sendAppeal} disabled={sending || !appeal.time} className={`w-full h-14 rounded-full text-lg font-black ${C.grad} disabled:opacity-50`}>
              {sending ? "שולח..." : "שליחת ערעור לאבישי"}
            </button>
            <button type="button" onClick={() => setAppeal(null)} className={`w-full h-12 rounded-full border-2 ${C.line} font-bold`}>ביטול</button>
          </div>
        </div>
      )}

      {rulesOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="staff-rules-title">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-3 text-[#3a1d12]">
            <h2 id="staff-rules-title" className="text-xl font-black">רגע לפני ההגשה</h2>
            {ruleNotes.map((n) => <p key={n} className="font-bold">{n}</p>)}
            <button type="button" onClick={() => setRulesOpen(false)} className={`w-full h-14 rounded-full text-lg font-black ${C.grad}`}>להוסיף משמרת</button>
            <button type="button" onClick={() => submit(true)} className={`w-full h-12 rounded-full border-2 ${C.line} font-bold`}>הבנתי, להגיש בכל זאת</button>
          </div>
        </div>
      )}
    </main>
  );
};

export default Staff;
