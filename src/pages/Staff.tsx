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
  STAFF_TOKEN_KEY, STOCK_CATEGORIES, addStaffMeal, setStaffStock, stockText, type StockItem, type StockLevel, appealStaffEntry, dateIL, removeStaffMeal, fetchStaffMe, hoursText, submitStaffWeek, subscribeStaffPush, timeIL, type StaffMe,
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
  const [stockCat, setStockCat] = useState<string>("ירקות");
  const [stockEdit, setStockEdit] = useState<{ item: StockItem; qty: number } | null>(null);
  const [tab, setTab] = useState<"home" | "shifts" | "meals" | "stock">("home");
  const [appeal, setAppeal] = useState<{ id: string; clockIn: string; time: string } | null>(null);
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
      toast.success(level ? `${it.name}: ${stockText(level === "count" && qty === 0 ? "out" : level, qty ?? null)}` : `${it.name}: יש מספיק`);
      await load();
    } catch {
      toast.error("לא נשמר, נסו שוב");
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

  const tile = "rounded-3xl bg-white shadow-[0_4px_14px_rgba(232,80,47,0.10)] active:scale-[0.97] transition-transform";
  const tabs = [
    { id: "home", icon: "🏠", label: "בית" },
    { id: "shifts", icon: "📅", label: "משמרות" },
    ...(data.me.is_owner ? [] : [{ id: "meals", icon: "🍔", label: "ארוחות" }]),
    { id: "stock", icon: "📦", label: "מלאי" },
  ] as { id: typeof tab; icon: string; label: string }[];
  const stockOpenCount = data.stock?.filter((i) => i.level).length ?? 0;

  return (
    <main dir="rtl" className={`min-h-screen ${C.page} pb-24`}>
      <header className={`${C.grad} px-5 pt-6 pb-4`}>
        <h1 className="text-2xl font-black">שלום, {data.me.name.split(" ")[0]} 👋</h1>
      </header>
      {/* Tabs sit at the top: the bottom corner is covered by the hosting badge. */}
      <nav aria-label="ניווט" className="sticky top-0 z-40 bg-white shadow-[0_4px_14px_rgba(232,80,47,0.12)] rounded-b-3xl">
        <div className="max-w-lg mx-auto flex">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => { setTab(t.id); window.scrollTo(0, 0); }} aria-current={tab === t.id ? "page" : undefined}
              className={`relative flex-1 pt-2.5 pb-2 flex flex-col items-center gap-0.5 border-b-4 ${tab === t.id ? `${C.accent} border-[#e8502f]` : `${C.muted} border-transparent`}`}>
              <span className="text-2xl leading-none" aria-hidden>{t.icon}</span>
              <span className={`text-sm ${tab === t.id ? "font-black" : "font-bold"}`}>{t.label}</span>
              {t.id === "stock" && stockOpenCount > 0 && (
                <span className="absolute top-1 right-1/2 -mr-7 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-black flex items-center justify-center">{stockOpenCount}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <div className="px-4 pt-4 max-w-lg mx-auto space-y-4">
        {tab === "home" && (
          <>
            <section className={`${C.card} !p-5 ${nextState?.late ? "ring-2 ring-red-500" : ""}`}>
              <p className={`text-sm ${C.muted}`}>{data.me.is_owner ? "המשמרת הבאה" : "המשמרת הבאה שלך"}</p>
              {next ? (
                <>
                  <p className={`text-3xl font-black ${C.accent}`}>{next.label} {dateIL(next.date)}</p>
                  <p className="text-lg font-bold">מתחילים ב-{timeIL(next.starts_at)}</p>
                  {data.me.is_owner && <p className={C.muted}>{next.team.length ? next.team.join(", ") : "אתה (אין עובד משובץ)"}</p>}
                  {nextState && <p className={`mt-2 font-bold ${nextState.late ? "text-red-600" : "text-green-700"}`}>{nextState.text}</p>}
                </>
              ) : (
                <p className="text-xl font-black">עוד אין משמרת בסידור</p>
              )}
            </section>

            {!data.me.is_owner && !nw.published && !nw.submitted_at && (
              <button type="button" onClick={() => setTab("shifts")} className={`w-full h-16 rounded-3xl text-lg font-black ${C.grad} shadow-lg`}>
                להגיש משמרות לשבוע הבא ←
              </button>
            )}

            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { v: hoursText(data.month.minutes), l: "שעות החודש" },
                { v: String(done.length), l: "משמרות" },
                { v: String(data.month.late_count), l: "איחורים" },
              ].map((x) => (
                <div key={x.l} className={`${tile} py-4`}>
                  <p className={`text-2xl font-black ${C.accent}`}>{x.v}</p>
                  <p className={`text-xs ${C.muted}`}>{x.l}</p>
                </div>
              ))}
            </div>

            <section className={`${C.card} space-y-3`}>
              <h2 className="text-lg font-black">תזכורות</h2>
              {isIos() && !isStandalonePwa() && (
                <p className="text-sm rounded-2xl bg-[#fff1e6] p-3">
                  באייפון: כפתור השיתוף ← "הוסף למסך הבית", ואז פותחים מהאייקון. רק כך מקבלים התראות.
                </p>
              )}
              {pushKey && (
                <button type="button" onClick={enablePush} disabled={pushState !== "idle"}
                  className="w-full h-14 rounded-full bg-[#3a1d12] text-white text-base font-bold flex items-center justify-center gap-2 disabled:opacity-70">
                  <Bell size={20} />
                  {pushState === "on" ? "התראות פעילות ✓" : pushState === "busy" ? "מפעיל..." : "הפעלת התראות"}
                </button>
              )}
              {webcal && isIos() && (
                <a href={webcal} className={`h-12 rounded-full border-2 ${C.line} font-bold flex items-center justify-center gap-2`}>
                  <CalendarPlus size={18} /> יומן אייפון - מתעדכן לבד
                </a>
              )}
              {data.me.is_owner && <a href="/admin/shifts" className={`block text-center font-bold underline ${C.accent}`}>לבניית הסידור ←</a>}
            </section>
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
                            כניסה {timeIL(e.clock_in)} · {e.clock_out ? `${hoursText(e.minutes)} שעות` : "במשמרת עכשיו"}
                            {e.late_minutes > 0 && <span className="text-red-600 font-bold"> · איחור {e.late_minutes} ד׳</span>}
                          </span>
                        </span>
                      </span>
                      {e.appeal?.status !== "pending" && (
                        <button type="button" aria-label="ערעור על שעת הכניסה"
                          onClick={() => setAppeal({ id: e.id, clockIn: e.clock_in, time: "19:00" })}
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

        {tab === "stock" && data.stock && (
          <>
            <section className={`${C.card} !p-5`}>
              <h2 className="text-xl font-black">מה חסר?</h2>
              <p className={`text-sm ${C.muted}`}>נוגעים במוצר ומסמנים כמה נשאר, "נשאר קצת" או "נגמר".</p>
            </section>
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
                <button key={i.id} type="button" onClick={() => setStockEdit({ item: i, qty: i.quantity ?? 1 })}
                  className={`h-20 px-2 rounded-3xl text-center border-2 transition-all active:scale-[0.97] ${
                    i.level === "out" ? "bg-red-600 border-red-600 text-white shadow-lg"
                      : i.level === "low" ? "bg-[#ffd24d] border-[#ffd24d] text-[#3a1d12] shadow-lg"
                      : i.level === "count" ? "bg-[#ff8a3d] border-[#ff8a3d] text-white shadow-lg"
                      : `bg-white ${C.line}`}`}>
                  <span className="block text-base font-black leading-tight">{i.name}</span>
                  <span className={`block text-sm font-bold ${i.level ? "" : C.muted}`}>{stockText(i.level, i.quantity)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>


      {stockEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="staff-stock-title" onClick={() => setStockEdit(null)}>
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-3 text-[#3a1d12]" onClick={(e) => e.stopPropagation()}>
            <h2 id="staff-stock-title" className="text-2xl font-black text-center">{stockEdit.item.name}</h2>
            <p className={`text-center ${C.muted}`}>כמה נשאר?</p>
            <div className="flex items-center justify-center gap-5">
              <button type="button" aria-label="פחות" onClick={() => setStockEdit({ ...stockEdit, qty: Math.max(0, stockEdit.qty - 1) })}
                className={`w-14 h-14 rounded-full border-2 ${C.line} text-3xl font-black`}>−</button>
              <span className="text-5xl font-black w-20 text-center" aria-live="polite">{stockEdit.qty}</span>
              <button type="button" aria-label="יותר" onClick={() => setStockEdit({ ...stockEdit, qty: Math.min(999, stockEdit.qty + 1) })}
                className={`w-14 h-14 rounded-full border-2 ${C.line} text-3xl font-black`}>+</button>
            </div>
            <button type="button" onClick={() => saveStock("count", stockEdit.qty)} className={`w-full h-14 rounded-full text-lg font-black ${C.grad}`}>
              {stockEdit.qty === 0 ? "שמירה: נגמר" : `שמירה: נשארו ${stockEdit.qty}`}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => saveStock("low")} className="h-14 rounded-full bg-[#ffd24d] text-[#3a1d12] text-lg font-black">נשאר קצת</button>
              <button type="button" onClick={() => saveStock("out")} className="h-14 rounded-full bg-red-600 text-white text-lg font-black">נגמר</button>
            </div>
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
            <input type="time" value={appeal.time} onChange={(ev) => setAppeal({ ...appeal, time: ev.target.value })}
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
