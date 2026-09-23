import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const SHIFT_EMPLOYEE = "אליה בירן";

const getBusinessDayStart = () => {
  const d = new Date();
  if (d.getHours() < 6) d.setDate(d.getDate() - 1);
  d.setHours(6, 0, 0, 0);
  return d;
};

const fmt = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};

/** Clock-in/out for the employee. Shows hours only — never wages. */
export default function ShiftClock() {
  const [open, setOpen] = useState<{ id: string; clock_in: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const load = async () => {
    const { data } = await (supabase as any).from("work_shifts").select("id, clock_in")
      .eq("employee_name", SHIFT_EMPLOYEE).is("clock_out", null).order("clock_in", { ascending: false }).limit(1).maybeSingle();
    setOpen(data || null);
  };
  useEffect(() => { load(); }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      if (!open) {
        const { error } = await (supabase as any).from("work_shifts").insert({ employee_name: SHIFT_EMPLOYEE });
        if (error) throw error;
        toast.success(`${SHIFT_EMPLOYEE} — נכנס למשמרת`);
      } else {
        const { error } = await (supabase as any).from("work_shifts").update({ clock_out: new Date().toISOString() }).eq("id", open.id);
        if (error) throw error;
        const dayStart = getBusinessDayStart();
        const { data } = await (supabase as any).from("work_shifts").select("clock_in, clock_out")
          .eq("employee_name", SHIFT_EMPLOYEE).gte("clock_in", dayStart.toISOString());
        const total = (data || []).reduce((s: number, r: any) =>
          s + (new Date(r.clock_out || Date.now()).getTime() - new Date(r.clock_in).getTime()), 0);
        setSummary(fmt(total));
      }
      await load();
    } catch {
      toast.error("הפעולה נכשלה");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={toggle}
        disabled={busy}
        className={`px-3 py-2 rounded-lg text-xs font-bold ${open ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}
      >
        {open ? `יציאה · ${SHIFT_EMPLOYEE}` : `כניסה · ${SHIFT_EMPLOYEE}`}
      </button>
      {summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSummary(null)}>
          <div className="rounded-2xl bg-card border border-border p-8 text-center shadow-2xl">
            <p className="text-lg text-muted-foreground">{SHIFT_EMPLOYEE}, עבדת היום</p>
            <p className="text-5xl font-black text-primary my-3">{summary}</p>
            <p className="text-sm text-muted-foreground mb-4">שעות</p>
            <button onClick={() => setSummary(null)} className="rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground">סגור</button>
          </div>
        </div>
      )}
    </>
  );
}
