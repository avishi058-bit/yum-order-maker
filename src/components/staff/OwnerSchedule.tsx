// The owner's schedule builder inside his staff app: for each day, who asked
// for it (in their colour); tap a name to give them the shift. Rule warnings
// per employee, publish, and add everyone's shifts to his own calendar.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { addDaysYmd, dateIL, staffDb, timeIL, todayIL, weekStartYmd } from "@/lib/staff";

export interface OwnerWeek {
  week_start: string;
  published: boolean;
  owner: { id: string; name: string; color: string };
  members: { id: string; name: string; color: string; submitted_at: string | null; requests: number; weekend: boolean }[];
  closed: { date: string; label: string }[];
  days: { id: string; date: string; label: string; starts_at: string; ends_at: string; requested: string[]; assigned: string[] }[];
}

export const fetchOwnerWeek = async (token: string, weekStart: string): Promise<OwnerWeek | null> => {
  const { data, error } = await staffDb.rpc("staff_owner_week", { p_token: token, p_week_start: weekStart });
  return error ? null : (data as OwnerWeek);
};

const first = (name: string) => name.split(" ")[0];

const OwnerSchedule = ({ token, calendarUrl }: { token: string; calendarUrl: string | null }) => {
  const thisWeek = weekStartYmd(todayIL());
  const [weekStart, setWeekStart] = useState(addDaysYmd(thisWeek, 7));
  const [week, setWeek] = useState<OwnerWeek | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const w = await fetchOwnerWeek(token, weekStart);
    if (!w) toast.error("לא נטען, נסו שוב");
    setWeek(w);
  }, [token, weekStart]);
  useEffect(() => { setWeek(null); load(); }, [load]);

  const toggle = async (dayId: string, staffId: string, on: boolean) => {
    // Show the change right away, then save.
    setWeek((w) => w && { ...w, days: w.days.map((d) => d.id !== dayId ? d : { ...d, assigned: on ? [...d.assigned, staffId] : d.assigned.filter((x) => x !== staffId) }) });
    const { error } = await staffDb.rpc("staff_owner_assign", { p_token: token, p_shift_id: dayId, p_staff_id: staffId, p_on: on });
    if (error) { toast.error("לא נשמר"); load(); }
  };

  const publish = async () => {
    setBusy(true);
    const { error } = await staffDb.rpc("staff_owner_publish", { p_token: token, p_week_start: weekStart });
    setBusy(false);
    if (error) { toast.error("לא פורסם, נסו שוב"); return; }
    toast.success("הסידור פורסם - כל עובד מקבל את המשמרות שלו");
    load();
  };

  const isIphone = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const calLink = calendarUrl
    ? (isIphone ? calendarUrl.replace(/^https:/, "webcal:") : `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(calendarUrl.replace(/^https:/, "webcal:"))}`)
    : null;

  const weekLabel = weekStart === thisWeek ? "השבוע" : weekStart === addDaysYmd(thisWeek, 7) ? "שבוע הבא" : `${dateIL(weekStart)}`;

  return (
    <div className="space-y-4">
      <div className="flex rounded-[18px] bg-[#f7f3f0] p-1">
        {[thisWeek, addDaysYmd(thisWeek, 7), addDaysYmd(thisWeek, 14)].map((ws, i) => (
          <button key={ws} type="button" onClick={() => setWeekStart(ws)}
            className={`flex-1 py-2.5 rounded-[14px] text-[15px] ${weekStart === ws ? "bg-white text-[#e8502f] font-black shadow-sm" : "text-[#9a8478] font-semibold"}`}>
            {["השבוע", "שבוע הבא", "בעוד שבועיים"][i]}
          </button>
        ))}
      </div>

      {!week ? <p className="text-center text-[#9a8478]">טוען…</p> : (
        <>
          {/* Who submitted, and rule warnings */}
          <section className="rounded-[28px] p-4 border border-[#f0e6df] space-y-2">
            <h2 className="font-black">הגשות {weekLabel}</h2>
            {week.members.map((m) => {
              const warn: string[] = [];
              if (!m.submitted_at) warn.push("עוד לא הגיש");
              else {
                if (m.requests < 3) warn.push(`רק ${m.requests} משמרות`);
                if (!m.weekend) warn.push("בלי חמישי או מוצ״ש");
              }
              return (
                <p key={m.id} className="flex items-center gap-2 text-[15px]">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: m.color }} aria-hidden />
                  <b>{first(m.name)}</b>
                  {warn.length ? <span className="text-red-600 font-bold">· {warn.join(" · ")}</span>
                    : <span className="text-green-700 font-bold">· {m.requests} משמרות ✓</span>}
                </p>
              );
            })}
          </section>

          <p className="text-sm text-[#9a8478]">נוגעים בשם כדי לתת לו את המשמרת. יום בלי אף אחד - אתה עובד.</p>

          {/* Days */}
          <ul className="space-y-3">
            {week.days.map((d) => {
              const others = week.members.filter((m) => !d.requested.includes(m.id) && !d.assigned.includes(m.id));
              const askers = week.members.filter((m) => d.requested.includes(m.id) || d.assigned.includes(m.id));
              const mine = d.assigned.length === 0;
              return (
                <li key={d.id} className="rounded-[24px] border border-[#f0e6df] p-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className="text-lg font-black">{d.label} <span className="text-sm font-semibold text-[#9a8478]">{dateIL(d.date)} · {timeIL(d.starts_at)}</span></h3>
                    {mine && <span className="text-sm font-black" style={{ color: week.owner.color }}>אתה עובד</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {askers.length === 0 && <span className="text-sm text-[#9a8478]">אף אחד לא הגיש</span>}
                    {askers.map((m) => {
                      const on = d.assigned.includes(m.id);
                      return (
                        <button key={m.id} type="button" onClick={() => toggle(d.id, m.id, !on)} aria-pressed={on}
                          className="h-11 px-4 rounded-full border-2 font-black text-[15px] transition-colors"
                          style={on ? { background: m.color, borderColor: m.color, color: "#fff" } : { borderColor: m.color, color: m.color, background: "#fff" }}>
                          {on ? "✓ " : ""}{first(m.name)}
                          {!d.requested.includes(m.id) && <span className="text-xs font-semibold opacity-80"> (לא הגיש)</span>}
                        </button>
                      );
                    })}
                    {others.length > 0 && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-[#9a8478] h-11 flex items-center">+ מישהו אחר</summary>
                        <div className="flex gap-2 mt-1">
                          {others.map((m) => (
                            <button key={m.id} type="button" onClick={() => toggle(d.id, m.id, true)}
                              className="h-9 px-3 rounded-full border-2 font-bold" style={{ borderColor: m.color, color: m.color }}>{first(m.name)}</button>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
            {week.closed.map((c) => (
              <li key={c.date} className="rounded-[24px] border border-dashed border-[#e2d4cb] p-4 text-[#c4b5ab] font-bold">{c.label} {dateIL(c.date)} · סגור</li>
            ))}
          </ul>

          <button type="button" onClick={publish} disabled={busy}
            className="w-full h-14 rounded-full text-lg font-black bg-[#e8502f] text-white disabled:opacity-50">
            {busy ? "מפרסם…" : week.published ? "עדכון הסידור לעובדים" : "פרסום הסידור"}
          </button>
          {calLink && (
            <a href={calLink} target={isIphone ? undefined : "_blank"} rel="noopener noreferrer"
              className="w-full h-12 rounded-full border-2 border-[#f0e6df] font-bold flex items-center justify-center gap-2">
              <CalendarPlus size={18} /> הוספת כל המשמרות ליומן שלי
            </a>
          )}
          <p className="text-xs text-center text-[#9a8478]">ביומן כל משמרת נקראת בשם מי שעובד בה, ומתעדכנת לבד אחרי כל פרסום.</p>
        </>
      )}
    </div>
  );
};

export default OwnerSchedule;
