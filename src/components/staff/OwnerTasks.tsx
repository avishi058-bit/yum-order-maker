// The owner edits the task lists from his staff app: rename (tap the name),
// move up/down, remove, and add to each list.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { staffDb } from "@/lib/staff";

interface TaskDef { id: string; title: string; kind: string; section: string | null; weekday: number | null; per_week: number | null; at_opening: boolean; sort_order: number }

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "מוצ״ש"];
const GROUPS: { key: string; label: string; hint: string; kind: string; section?: string; ordered?: boolean }[] = [
  { key: "rotating", label: "משימות יומיות", hint: "מתחלקות בין המשמרות של העובדים", kind: "rotating" },
  { key: "weekly", label: "ביום קבוע", hint: "כל שבוע באותו יום", kind: "weekly" },
  { key: "pre", label: "קידום סגירה", hint: "כל משמרת", kind: "closing", section: "קידום סגירה", ordered: true },
  { key: "close", label: "סדר סגירה", hint: "כל משמרת, לפי הסדר", kind: "closing", section: "סדר סגירה", ordered: true },
  { key: "idle", label: "כשאין עבודה", hint: "ניתנות אחת אחת בזמן שקט", kind: "idle" },
];
const line = "border-[#f3ece7]";
const muted = "text-[#9a8478]";

const OwnerTasks = ({ token, onClose }: { token: string; onClose: () => void }) => {
  const [tasks, setTasks] = useState<TaskDef[] | null>(null);
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const [adding, setAdding] = useState<Record<string, { title: string; weekday: number; perWeek: number }>>({});

  const load = useCallback(async () => {
    const { data, error } = await staffDb.rpc("staff_owner_tasks", { p_token: token });
    if (error) { toast.error("לא נטען"); return; }
    setTasks(data as TaskDef[]);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const call = async (fn: string, args: Record<string, unknown>) => {
    const { error } = await staffDb.rpc(fn, { p_token: token, ...args });
    if (error) toast.error("לא נשמר");
    await load();
  };
  const saveTitle = async () => {
    if (!editing) return;
    const t = tasks?.find((x) => x.id === editing.id);
    if (t && editing.title.trim() && editing.title.trim() !== t.title)
      await call("staff_owner_task_save", { p_id: t.id, p_title: editing.title, p_kind: t.kind });
    setEditing(null);
  };
  const add = async (g: (typeof GROUPS)[number]) => {
    const a = adding[g.key];
    if (!a?.title.trim()) return;
    await call("staff_owner_task_save", { p_id: null, p_title: a.title, p_kind: g.kind, p_section: g.section ?? null,
      p_weekday: g.kind === "weekly" ? a.weekday : null, p_per_week: g.kind === "rotating" ? a.perWeek : null });
    setAdding({ ...adding, [g.key]: { ...a, title: "" } });
  };

  if (!tasks) return <p className={`text-center ${muted}`}>טוען…</p>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black">עריכת משימות</h2>
        <button type="button" onClick={onClose} className="rounded-full bg-[#e8502f] text-white font-black px-4 h-10">סיום</button>
      </div>
      <p className={`text-sm ${muted}`}>נוגעים בשם כדי לשנות. השינויים חלים גם על הערב.</p>
      {GROUPS.map((g) => {
        const list = tasks.filter((t) => t.kind === g.kind && (g.section ? t.section === g.section : true))
          .sort((a, b) => g.kind === "weekly" ? (a.weekday ?? 0) - (b.weekday ?? 0) : a.sort_order - b.sort_order);
        const a = adding[g.key] ?? { title: "", weekday: 0, perWeek: 1 };
        return (
          <section key={g.key} className="rounded-[24px] border border-[#f0e6df] p-4">
            <h3 className="font-black text-lg">{g.label} <span className={`text-xs font-semibold ${muted}`}>· {g.hint}</span></h3>
            <ul>
              {list.map((t, i) => (
                <li key={t.id} className={`flex items-center gap-2 py-2.5 border-b last:border-0 ${line}`}>
                  {editing?.id === t.id ? (
                    <input value={editing.title} autoFocus maxLength={120} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                      onBlur={saveTitle} onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditing(null); }}
                      aria-label="שם המשימה" className={`flex-1 h-10 rounded-xl border-2 ${line} px-3 font-semibold`} />
                  ) : (
                    <button type="button" onClick={() => setEditing({ id: t.id, title: t.title })} className="flex-1 text-right font-semibold">
                      {g.ordered && <span className={`${muted} text-sm`}>{i + 1}. </span>}{t.title}
                      {t.kind === "weekly" && <span className={`text-xs ${muted}`}> · {DAYS[t.weekday ?? 0]}{t.at_opening ? " בפתיחה" : ""}</span>}
                      {t.kind === "rotating" && <span className={`text-xs ${muted}`}> · {t.per_week === 1 ? "פעם" : `${t.per_week} פעמים`} בשבוע</span>}
                    </button>
                  )}
                  {g.ordered && (
                    <span className="flex flex-col">
                      <button type="button" aria-label={`להזיז למעלה: ${t.title}`} disabled={i === 0} onClick={() => call("staff_owner_task_move", { p_id: t.id, p_up: true })} className="disabled:opacity-20"><ChevronUp size={18} /></button>
                      <button type="button" aria-label={`להזיז למטה: ${t.title}`} disabled={i === list.length - 1} onClick={() => call("staff_owner_task_move", { p_id: t.id, p_up: false })} className="disabled:opacity-20"><ChevronDown size={18} /></button>
                    </span>
                  )}
                  <button type="button" aria-label={`להסיר: ${t.title}`} onClick={() => { if (window.confirm(`להסיר את "${t.title}"?`)) call("staff_owner_task_remove", { p_id: t.id }); }}
                    className={`w-9 h-9 flex items-center justify-center rounded-full ${muted}`}><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 mt-2 flex-wrap">
              <input value={a.title} maxLength={120} placeholder="משימה חדשה" aria-label={`משימה חדשה ב${g.label}`}
                onChange={(e) => setAdding({ ...adding, [g.key]: { ...a, title: e.target.value } })}
                onKeyDown={(e) => { if (e.key === "Enter") add(g); }}
                className={`flex-1 min-w-36 h-11 rounded-xl border-2 ${line} px-3`} />
              {g.kind === "weekly" && (
                <select value={a.weekday} onChange={(e) => setAdding({ ...adding, [g.key]: { ...a, weekday: Number(e.target.value) } })}
                  aria-label="יום" className={`h-11 rounded-xl border-2 ${line} px-2 bg-white`}>
                  {DAYS.map((d, i) => i !== 5 && <option key={i} value={i}>{d}</option>)}
                </select>
              )}
              {g.kind === "rotating" && (
                <select value={a.perWeek} onChange={(e) => setAdding({ ...adding, [g.key]: { ...a, perWeek: Number(e.target.value) } })}
                  aria-label="כמה פעמים בשבוע" className={`h-11 rounded-xl border-2 ${line} px-2 bg-white`}>
                  {[1, 2, 3].map((n) => <option key={n} value={n}>{n === 1 ? "פעם בשבוע" : `${n} בשבוע`}</option>)}
                </select>
              )}
              <button type="button" onClick={() => add(g)} disabled={!a.title.trim()} className="h-11 px-4 rounded-xl bg-[#2b1a12] text-white font-bold disabled:opacity-40">הוספה</button>
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default OwnerTasks;
