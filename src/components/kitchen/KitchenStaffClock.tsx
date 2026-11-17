// Kitchen header: clock-in / clock-out for tonight's team (from the published
// schedule; the owner when nobody is assigned), with a confirmation each time.
// Also tonight's task list: the closing checklist, this weekday's cleaning,
// a short stock count, and quiet-time tasks (shown only while no order is open).
// Clocking out with tasks left lists them; leaving anyway moves them to the
// next shift. No dates or worked hours are shown here. Clocking in more than
// 10 minutes early waits for the owner's approval; after 22:00 on a quiet
// night a banner says to start closing.
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { groupTasks, halfText, itemPack, packPlural, staffDb, stockText, type CountItem } from "@/lib/staff";

interface Person { id: string; name: string; open_since: string | null; pending_early?: boolean }
interface Task { id: string; title: string; kind: string; source: string; at_opening: boolean; done: boolean; items?: CountItem[] | null; section?: string | null }
const isCount = (t: Task) => t.kind === "count" || t.kind === "supplier_count";

const KitchenStaffClock = ({ busy: kitchenBusy = false }: { busy?: boolean }) => {
  const [people, setPeople] = useState<Person[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [countItems, setCountItems] = useState<CountItem[]>([]);
  const [confirm, setConfirm] = useState<Person | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [counting, setCounting] = useState<{ runId: string; title: string; items: CountItem[]; values: Record<string, number>; leaving?: Person } | null>(null);
  const [saving, setSaving] = useState(false);
  const [closingNudge, setClosingNudge] = useState(false);

  const load = useCallback(async () => {
    const [p, t] = await Promise.all([staffDb.rpc("kitchen_staff_today"), staffDb.rpc("kitchen_tasks_today")]);
    if (!p.error && p.data) setPeople((p.data.people ?? []) as Person[]);
    if (!t.error && t.data) {
      setTasks((t.data.tasks ?? []) as Task[]);
      setCountItems((t.data.count_items ?? []) as CountItem[]);
      setClosingNudge(!!t.data.closing_nudge);
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
  // After 22:00 on a quiet night: the closing tasks one by one, in order.
  const nextClosing = open.find((t) => t.section === "קידום סגירה" || t.section === "סדר סגירה");
  const showClosing = someoneIn && closingNudge && !kitchenBusy && !!nextClosing;

  const setDone = async (t: Task, done: boolean) => {
    if (isCount(t)) {
      if (done) startCount(t);
      return;
    }
    setTasks((all) => all.map((x) => (x.id === t.id ? { ...x, done } : x)));
    const { error } = await staffDb.rpc("kitchen_task_set", { p_run_id: t.id, p_done: done });
    if (error) { toast.error("לא נשמר"); load(); }
  };

  const startCount = (t: Task, leaving?: Person) => {
    const items = t.items ?? countItems;
    setCounting({ runId: t.id, title: t.title, items, values: Object.fromEntries(items.map((i) => [i.id, 0])), leaving });
  };

  const saveCount = async () => {
    if (!counting) return;
    setSaving(true);
    const counts = Object.entries(counting.values).map(([item_id, quantity]) => ({ item_id, quantity }));
    const { error } = await staffDb.rpc("kitchen_task_count", { p_run_id: counting.runId, p_counts: counts });
    setSaving(false);
    if (error) { toast.error("לא נשמר"); return; }
    const leaving = counting.leaving;
    setCounting(null);
    toast.success(leaving ? "הספירה נשמרה - אפשר לצאת" : "הספירה נשמרה");
    if (leaving) setConfirm(leaving);
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
    if (data?.state === "need_count") {
      const t = tasks.find((x) => x.id === data.run_id);
      toast.error("לפני היציאה צריך לספור לספק");
      if (t) startCount(t, p); else load();
      return;
    }
    if (data?.state === "pending") {
      toast.info(`${p.name} - עוד מוקדם לכניסה. נשלחה בקשה לאבישי, הכניסה תירשם כשהוא יאשר.`, { duration: 8000 });
      load();
      return;
    }
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
          {t.source === "idle" && <span className="text-xs text-sky-400 font-bold"> · זמן שקט</span>}
          {t.at_opening && <span className="text-xs text-muted-foreground"> · בפתיחה</span>}
          {isCount(t) && !t.done && <span className="text-xs text-muted-foreground"> · {(t.items ?? countItems).map((i) => i.name).join(", ")}</span>}
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
          onClick={() => (p.pending_early && !p.open_since ? toast.info("ממתין לאישור של אבישי") : setConfirm(p))}
          className={`px-3 py-2 rounded-lg text-xs font-bold ${p.open_since ? "bg-red-500/20 text-red-300" : p.pending_early ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"}`}
        >
          {p.open_since ? `יציאה · ${p.name}` : p.pending_early ? `ממתין לאישור · ${p.name}` : `כניסה · ${p.name}`}
        </button>
      ))}
      {someoneIn && tasks.length > 0 && (
        <button type="button" onClick={() => setListOpen(true)}
          className={`px-3 py-2 rounded-lg text-xs font-bold ${open.length ? "bg-amber-500/20 text-amber-300" : "bg-muted text-muted-foreground"}`}>
          ✓ משימות{open.length ? ` (${open.length})` : ""}
        </button>
      )}

      {/* Quiet-time task: only while no order is waiting or being made. */}
      {/* After 22:00 with no new orders for 15 minutes: start closing. */}
      {showClosing && !listOpen && !confirm && !counting && createPortal(
        <div className="fixed bottom-4 inset-x-4 z-40 mx-auto max-w-md rounded-2xl bg-amber-500 text-black shadow-2xl p-4 flex items-center gap-3" role="status">
          <span className="text-2xl" aria-hidden>🌙</span>
          <span className="flex-1">
            <span className="block text-xs font-bold">קידום סגירה</span>
            <span className="block font-black">{nextClosing!.title}</span>
            <button type="button" onClick={() => setListOpen(true)} className="text-xs underline">כל המשימות</button>
          </span>
          <button type="button" onClick={() => setDone(nextClosing!, true)} className="rounded-xl bg-black text-amber-300 font-black px-4 py-2">בוצע ✓</button>
        </div>, document.body)}

      {someoneIn && idleTask && !showClosing && !kitchenBusy && !listOpen && !confirm && !counting && createPortal(
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
            {groupTasks(tasks).map((g) => (
              <div key={g.section ?? "_"}>
                {g.section && <h3 className="mt-4 text-sm font-black text-muted-foreground">{g.section}</h3>}
                <ul className="divide-y divide-border">{g.tasks.map(taskRow)}</ul>
              </div>
            ))}
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
          <div role="dialog" aria-modal="true" aria-labelledby="count-title" className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-card border border-border p-5 mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 id="count-title" className="text-xl font-black mb-3">{counting.title}</h2>
            {counting.leaving && <p className="text-amber-300 font-bold mb-2">לפני היציאה של {counting.leaving.name} - סופרים ושומרים.</p>}
            <ul className="divide-y divide-border">
              {counting.items.map((i) => {
                const v = counting.values[i.id] ?? 0;
                const set = (n: number) => setCounting({ ...counting, values: { ...counting.values, [i.id]: Math.max(0, Math.min(9999, n)) } });
                const pack = itemPack(i);
                return (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-3">
                    <span className="font-bold">{i.name} <span className="text-xs text-muted-foreground">({i.unit}{pack ? ` · ${pack.name} = ${pack.size}` : ""})</span>
                      {pack && v >= pack.size && <span className="block text-xs text-amber-300">{stockText("count", v, i.unit, pack)}</span>}
                    </span>
                    <span className="flex flex-col gap-1.5">
                      {pack && (
                        <span className="flex items-center gap-2">
                          <button type="button" aria-label={`פחות ${pack.name}`} onClick={() => set(v - pack.size)} className="w-11 h-11 rounded-full bg-muted text-2xl font-black">−</button>
                          <span className="w-12 text-center"><span className="block text-2xl font-black leading-none">{Math.floor(v / pack.size)}</span><span className="text-[11px] text-muted-foreground">{packPlural(pack.name)}</span></span>
                          <button type="button" aria-label={`יותר ${pack.name}`} onClick={() => set(v + pack.size)} className="w-11 h-11 rounded-full bg-muted text-2xl font-black">+</button>
                        </span>
                      )}
                      <span className="flex items-center gap-2">
                        <button type="button" aria-label="פחות" onClick={() => set(v - Number(i.step))} className="w-11 h-11 rounded-full bg-muted text-2xl font-black">−</button>
                        <span className="w-12 text-center"><span className="block text-2xl font-black leading-none">{halfText(pack ? v - Math.floor(v / pack.size) * pack.size : v)}</span>{pack && <span className="text-[11px] text-muted-foreground">{i.unit}</span>}</span>
                        <button type="button" aria-label="יותר" onClick={() => set(v + Number(i.step))} className="w-11 h-11 rounded-full bg-muted text-2xl font-black">+</button>
                      </span>
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
