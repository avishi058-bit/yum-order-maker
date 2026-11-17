// Kitchen header: clock-in / clock-out for tonight's team (from the published
// schedule; the owner when nobody is assigned), with a confirmation each time.
// Also tonight's task list: the closing checklist, this weekday's cleaning,
// a short stock count, and quiet-time tasks (shown only while no order is open).
// Clocking out with tasks left lists them; leaving anyway moves them to the
// next shift. No dates or worked hours are shown here.
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { staffDb } from "@/lib/staff";

interface Person { id: string; name: string; open_since: string | null }
interface Task { id: string; title: string; kind: string; source: string; at_opening: boolean; done: boolean }
interface CountItem { id: string; name: string; unit: string; step: number }

const half = (q: number) => (Number.isInteger(q) ? String(q) : `${q >= 1 ? Math.floor(q) : ""}½`);

const KitchenStaffClock = ({ busy: kitchenBusy = false }: { busy?: boolean }) => {
  const [people, setPeople] = useState<Person[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [countItems, setCountItems] = useState<CountItem[]>([]);
  const [confirm, setConfirm] = useState<Person | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [counting, setCounting] = useState<{ runId: string; values: Record<string, number> } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [p, t] = await Promise.all([staffDb.rpc("kitchen_staff_today"), staffDb.rpc("kitchen_tasks_today")]);
    if (!p.error && p.data) setPeople((p.data.people ?? []) as Person[]);
    if (!t.error && t.data) {
      setTasks((t.data.tasks ?? []) as Task[]);
      setCountItems((t.data.count_items ?? []) as CountItem[]);
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  const someoneIn = people.some((p) => p.open_since);
  const open = tasks.filter((t) => !t.done);
  const idleTask = open.find((t) => t.source === "idle");

  const setDone = async (t: Task, done: boolean) => {
    if (done && t.kind === "count") {
      setCounting({ runId: t.id, values: Object.fromEntries(countItems.map((i) => [i.id, 0])) });
      return;
    }
    setTasks((all) => all.map((x) => (x.id === t.id ? { ...x, done } : x)));
    const { error } = await staffDb.rpc("kitchen_task_set", { p_run_id: t.id, p_done: done });
    if (error) { toast.error("לא נשמר"); load(); }
  };

  const saveCount = async () => {
    if (!counting) return;
    setSaving(true);
    const counts = Object.entries(counting.values).map(([item_id, quantity]) => ({ item_id, quantity }));
    const r1 = await staffDb.rpc("kitchen_stock_count", { p_counts: counts });
    const r2 = await staffDb.rpc("kitchen_task_set", { p_run_id: counting.runId, p_done: true });
    setSaving(false);
    if (r1.error || r2.error) { toast.error("לא נשמר"); return; }
    setCounting(null);
    toast.success("הספירה נשמרה");
    load();
  };

  const toggleClock = async () => {
    if (!confirm) return;
    const p = confirm;
    setSaving(true);
    const { data, error } = await staffDb.rpc("kitchen_staff_toggle", { p_staff_id: p.id });
    setSaving(false);
    setConfirm(null);
    if (error) { toast.error("הפעולה נכשלה"); return; }
    toast.success(data?.state === "in" ? `${p.name} - נכנס/ה למשמרת` : `${p.name} - יצא/ה מהמשמרת`);
    load();
  };

  if (people.length === 0) return null;

  const taskRow = (t: Task) => (
    <li key={t.id}>
      <label className="flex items-center gap-3 py-3 cursor-pointer">
        <input type="checkbox" checked={t.done} onChange={(e) => setDone(t, e.target.checked)} className="w-7 h-7 accent-emerald-500 shrink-0" />
        <span className={`text-base ${t.done ? "line-through text-muted-foreground" : "font-bold"}`}>
          {t.title}
          {t.source === "carry" && <span className="text-xs text-amber-400 font-bold"> · מאתמול</span>}
          {t.source === "idle" && <span className="text-xs text-sky-400 font-bold"> · זמן שקט</span>}
          {t.at_opening && <span className="text-xs text-muted-foreground"> · בפתיחה</span>}
          {t.kind === "count" && !t.done && <span className="text-xs text-muted-foreground"> · {countItems.map((i) => i.name).join(", ")}</span>}
        </span>
      </label>
    </li>
  );

  const leaving = confirm?.open_since ? confirm : null;

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
      {someoneIn && tasks.length > 0 && (
        <button type="button" onClick={() => setListOpen(true)}
          className={`px-3 py-2 rounded-lg text-xs font-bold ${open.length ? "bg-amber-500/20 text-amber-300" : "bg-muted text-muted-foreground"}`}>
          ✓ משימות{open.length ? ` (${open.length})` : ""}
        </button>
      )}

      {/* Quiet-time task: only while no order is waiting or being made. */}
      {someoneIn && idleTask && !kitchenBusy && !listOpen && !confirm && !counting && createPortal(
        <div className="fixed bottom-4 inset-x-4 z-40 mx-auto max-w-md rounded-2xl bg-sky-600 text-white shadow-2xl p-4 flex items-center gap-3" role="status">
          <span className="text-2xl" aria-hidden>🧹</span>
          <span className="flex-1">
            <span className="block text-xs opacity-90">רגע שקט? משימה:</span>
            <span className="block font-black">{idleTask.title}</span>
          </span>
          <button type="button" onClick={() => setDone(idleTask, true)} className="rounded-xl bg-white text-sky-700 font-black px-4 py-2">בוצע ✓</button>
        </div>, document.body)}

      {listOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setListOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="tasks-title" className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-card border border-border p-5 mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 id="tasks-title" className="text-xl font-black mb-1">המשימות של היום</h2>
            <ul className="divide-y divide-border">{tasks.map(taskRow)}</ul>
            <button type="button" onClick={() => setListOpen(false)} className="mt-3 w-full rounded-lg bg-primary py-3 font-bold text-primary-foreground">סגור</button>
          </div>
        </div>, document.body)}

      {confirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => !saving && setConfirm(null)}>
          <div role="dialog" aria-modal="true" className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-card border border-border p-6 text-center shadow-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-bold mb-1">{confirm.name}</p>
            {leaving && open.length > 0 ? (
              <>
                <p className="text-amber-300 font-bold mb-2">לא סיימת את המשימות של היום:</p>
                <ul className="divide-y divide-border text-right mb-4">{open.map(taskRow)}</ul>
                <div className="flex flex-col gap-2">
                  <button type="button" disabled className="rounded-lg px-8 py-3 font-bold bg-muted text-muted-foreground">אישור יציאה (אחרי שמסמנים הכל)</button>
                  <button type="button" onClick={toggleClock} disabled={saving} className="rounded-lg px-6 py-3 font-bold bg-red-500/20 text-red-300">
                    {saving ? "רגע…" : "יציאה בכל זאת - המשימות יעברו למחר"}
                  </button>
                  <button type="button" onClick={() => setConfirm(null)} disabled={saving} className="rounded-lg px-6 py-3 font-bold bg-muted text-muted-foreground">ביטול</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-5">
                  {confirm.open_since ? "בטוח שאתה רוצה לצאת מהמשמרת?" : "בטוח שאתה רוצה להיכנס למשמרת?"}
                </p>
                <div className="flex gap-3 justify-center">
                  <button type="button" onClick={toggleClock} disabled={saving}
                    className={`rounded-lg px-8 py-3 font-bold text-white ${confirm.open_since ? "bg-red-500" : "bg-emerald-500"}`}>
                    {saving ? "רגע…" : confirm.open_since ? "אישור יציאה" : "אישור כניסה"}
                  </button>
                  <button type="button" onClick={() => setConfirm(null)} disabled={saving} className="rounded-lg px-6 py-3 font-bold bg-muted text-muted-foreground">ביטול</button>
                </div>
              </>
            )}
          </div>
        </div>, document.body)}

      {counting && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={() => !saving && setCounting(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="count-title" className="w-full max-w-md rounded-2xl bg-card border border-border p-5 mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 id="count-title" className="text-xl font-black mb-3">ספירת מלאי קצרה</h2>
            <ul className="divide-y divide-border">
              {countItems.map((i) => {
                const v = counting.values[i.id] ?? 0;
                const set = (n: number) => setCounting({ ...counting, values: { ...counting.values, [i.id]: Math.max(0, Math.min(999, n)) } });
                return (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-3">
                    <span className="font-bold">{i.name} <span className="text-xs text-muted-foreground">({i.unit})</span></span>
                    <span className="flex items-center gap-2">
                      <button type="button" aria-label="פחות" onClick={() => set(v - Number(i.step))} className="w-11 h-11 rounded-full bg-muted text-2xl font-black">−</button>
                      <span className="w-12 text-center text-2xl font-black">{half(v)}</span>
                      <button type="button" aria-label="יותר" onClick={() => set(v + Number(i.step))} className="w-11 h-11 rounded-full bg-muted text-2xl font-black">+</button>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={saveCount} disabled={saving} className="flex-1 rounded-lg bg-emerald-500 py-3 font-bold text-white">{saving ? "רגע…" : "שמירה"}</button>
              <button type="button" onClick={() => setCounting(null)} disabled={saving} className="rounded-lg px-6 py-3 font-bold bg-muted text-muted-foreground">ביטול</button>
            </div>
          </div>
        </div>, document.body)}
    </>
  );
};

export default KitchenStaffClock;
