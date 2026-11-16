// Kitchen screen strip: tonight's team as name buttons. Tap a name to clock in;
// tap twice to clock out. Shows hours this month and who is late.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { hoursText, staffDb, timeIL } from "@/lib/staff";

interface Person { id: string; name: string; is_owner: boolean; open_since: string | null; month_minutes: number }
interface Today { shift: { id: string; date: string; starts_at: string; ends_at: string } | null; people: Person[] }

const KitchenStaffClock = () => {
  const [today, setToday] = useState<Today | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const armTimer = useRef<number>();

  const load = useCallback(async () => {
    const { data, error } = await staffDb.rpc("kitchen_staff_today");
    if (!error && data) setToday(data as Today);
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(() => { load(); setNow(Date.now()); }, 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  const tap = async (p: Person) => {
    if (busy) return;
    if (p.open_since && armed !== p.id) {
      setArmed(p.id);
      window.clearTimeout(armTimer.current);
      armTimer.current = window.setTimeout(() => setArmed(null), 4000);
      return;
    }
    setArmed(null);
    setBusy(p.id);
    const { data, error } = await staffDb.rpc("kitchen_staff_toggle", { p_staff_id: p.id });
    setBusy(null);
    if (error) { toast.error("לא נרשם, נסו שוב"); return; }
    const t = timeIL(new Date().toISOString());
    toast.success(data?.state === "in" ? `${p.name} נכנס/ה למשמרת ב-${t}` : `${p.name} יצא/ה מהמשמרת ב-${t}`);
    load();
  };

  if (!today || today.people.length === 0) return null;
  const startMs = today.shift ? new Date(today.shift.starts_at).getTime() : null;

  return (
    <div className="bg-card border-b border-border px-4 py-2 flex items-center gap-2 overflow-x-auto" aria-label="כניסה ויציאה ממשמרת">
      <span className="text-sm font-bold text-muted-foreground shrink-0">
        משמרת{today.shift ? ` ${timeIL(today.shift.starts_at)}` : ""}:
      </span>
      {today.people.map((p) => {
        const late = !p.open_since && !p.is_owner && startMs !== null && now > startMs + 5 * 60_000;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => tap(p)}
            disabled={busy === p.id}
            className={`shrink-0 rounded-xl border-2 px-3 py-1.5 text-right transition-colors disabled:opacity-60 ${
              armed === p.id ? "border-destructive bg-destructive/15"
                : p.open_since ? "border-green-600 bg-green-600/15"
                : late ? "border-destructive" : "border-border"
            }`}
          >
            <span className="block font-black text-sm">
              {p.open_since ? "🟢 " : ""}{p.name}
            </span>
            <span className={`block text-xs ${late ? "text-destructive font-bold" : "text-muted-foreground"}`}>
              {armed === p.id ? "לחצו שוב ליציאה"
                : p.open_since ? `מאז ${timeIL(p.open_since)} · ${hoursText(p.month_minutes)} ש׳ החודש`
                : late ? "מאחר/ת - לחצו לכניסה"
                : `לחצו לכניסה · ${hoursText(p.month_minutes)} ש׳ החודש`}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default KitchenStaffClock;
