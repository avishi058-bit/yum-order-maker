// Kitchen header: clock-in / clock-out buttons for tonight's team (from the
// published schedule; the owner when nobody is assigned). Each tap asks for
// confirmation. No dates or hours are shown here.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { staffDb } from "@/lib/staff";

interface Person { id: string; name: string; open_since: string | null }

const KitchenStaffClock = () => {
  const [people, setPeople] = useState<Person[]>([]);
  const [confirm, setConfirm] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await staffDb.rpc("kitchen_staff_today");
    if (!error && data) setPeople((data.people ?? []) as Person[]);
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  const toggle = async () => {
    if (!confirm) return;
    const p = confirm;
    setBusy(true);
    const { data, error } = await staffDb.rpc("kitchen_staff_toggle", { p_staff_id: p.id });
    setBusy(false);
    setConfirm(null);
    if (error) { toast.error("הפעולה נכשלה"); return; }
    toast.success(data?.state === "in" ? `${p.name} - נכנס/ה למשמרת` : `${p.name} - יצא/ה מהמשמרת`);
    load();
  };

  if (people.length === 0) return null;

  return (
    <>
      {people.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => setConfirm(p)}
          className={`px-3 py-2 rounded-lg text-xs font-bold ${p.open_since ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}
        >
          {p.open_since ? `יציאה · ${p.name}` : `כניסה · ${p.name}`}
        </button>
      ))}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => !busy && setConfirm(null)}>
          <div role="dialog" aria-modal="true" className="rounded-2xl bg-card border border-border p-6 text-center shadow-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-bold mb-1">{confirm.name}</p>
            <p className="text-muted-foreground mb-5">
              {confirm.open_since ? "בטוח שאתה רוצה לצאת מהמשמרת?" : "בטוח שאתה רוצה להיכנס למשמרת?"}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={toggle}
                disabled={busy}
                className={`rounded-lg px-8 py-3 font-bold text-white ${confirm.open_since ? "bg-red-500" : "bg-emerald-500"}`}
              >
                {busy ? "רגע…" : confirm.open_since ? "אישור יציאה" : "אישור כניסה"}
              </button>
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={busy}
                className="rounded-lg px-6 py-3 font-bold bg-muted text-muted-foreground"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KitchenStaffClock;
