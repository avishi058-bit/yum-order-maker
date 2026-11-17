// Waste report on the employee page: pick what was thrown away, how many and
// why. A report can be taken back for 5 minutes.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { addWaste, fetchWaste, removeWaste, timeIL, type WasteList } from "@/lib/staff";

const REASONS = ["נפל", "נשרף", "טעות בהזמנה", "פג תוקף / התקלקל", "אחר"];
const line = "border-[#f3ece7]";
const muted = "text-[#9a8478]";

const StaffWaste = ({ token }: { token: string }) => {
  const [data, setData] = useState<WasteList | null>(null);
  const [pick, setPick] = useState<{ id: string; name: string; qty: number; reason: string | null; what: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await fetchWaste(token)); } catch { /* shown as loading */ }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const isOther = pick?.name === "אחר";
  const save = async () => {
    if (!pick?.reason || (isOther && !pick.what.trim())) return;
    setBusy(true);
    try {
      await addWaste(token, pick.id, pick.qty, pick.reason, isOther ? pick.what.trim() : undefined);
      setPick(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message === "too_many" ? "יותר מדי דיווחים בשעה האחרונה" : "לא נשמר, נסו שוב");
    } finally {
      setBusy(false);
    }
  };
  const undo = async (id: string) => {
    try { await removeWaste(token, id); await load(); } catch { toast.error("כבר אי אפשר לבטל"); }
  };

  if (!data) return <p className={`text-center ${muted}`}>טוען…</p>;
  return (
    <>
      <p className={`text-sm ${muted}`}>משהו נזרק? נוגעים במוצר, בוחרים כמה ולמה.</p>
      <div className="grid grid-cols-2 gap-3">
        {data.items.map((i) => (
          <button key={i.id} type="button" onClick={() => setPick({ id: i.id, name: i.name, qty: 1, reason: null, what: "" })}
            className="h-16 rounded-3xl bg-[#f7f3f0] text-base font-black active:scale-[0.97] transition-transform">
            {i.name}
          </button>
        ))}
      </div>
      {data.today.length > 0 && (
        <section className="rounded-[28px] p-4 border border-[#f0e6df]">
          <h3 className="font-black mb-1">דיווחתי היום</h3>
          <ul>
            {data.today.map((l) => (
              <li key={l.id} className={`flex items-center justify-between gap-2 py-2.5 border-b last:border-0 ${line}`}>
                <span>
                  <b>{l.quantity > 1 ? `${l.quantity} × ` : ""}{l.name}</b>
                  <span className={`block text-xs ${muted}`}>{l.reason} · {timeIL(l.at)}</span>
                </span>
                {l.can_remove && <button type="button" onClick={() => undo(l.id)} className={`text-sm underline ${muted}`}>ביטול</button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {pick && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="waste-title" onClick={() => !busy && setPick(null)}>
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 text-[#2b1a12]" onClick={(e) => e.stopPropagation()}>
            <h2 id="waste-title" className="text-2xl font-black text-center">{isOther ? "מה נזרק?" : `נזרק: ${pick.name}`}</h2>
            {isOther && (
              <input value={pick.what} onChange={(e) => setPick({ ...pick, what: e.target.value })} maxLength={60} autoFocus
                placeholder="למשל: גבינה, רוטב, בירה" aria-label="מה נזרק"
                className={`w-full h-14 rounded-2xl border-2 ${line} px-4 text-lg font-bold`} />
            )}
            <div className="flex items-center justify-center gap-5">
              <button type="button" aria-label="פחות" onClick={() => setPick({ ...pick, qty: Math.max(1, pick.qty - 1) })} className={`w-14 h-14 rounded-full border-2 ${line} text-3xl font-black`}>−</button>
              <span className="text-5xl font-black w-16 text-center" aria-live="polite">{pick.qty}</span>
              <button type="button" aria-label="יותר" onClick={() => setPick({ ...pick, qty: Math.min(50, pick.qty + 1) })} className={`w-14 h-14 rounded-full border-2 ${line} text-3xl font-black`}>+</button>
            </div>
            <div className="flex flex-wrap gap-2 justify-center" role="radiogroup" aria-label="למה">
              {REASONS.map((r) => (
                <button key={r} type="button" role="radio" aria-checked={pick.reason === r} onClick={() => setPick({ ...pick, reason: r })}
                  className={`rounded-full px-4 h-11 font-bold border-2 ${pick.reason === r ? "bg-[#2b1a12] border-[#2b1a12] text-white" : `bg-white ${line}`}`}>
                  {r}
                </button>
              ))}
            </div>
            <button type="button" onClick={save} disabled={busy || !pick.reason || (isOther && !pick.what.trim())} className="w-full h-14 rounded-full text-lg font-black bg-[#e8502f] text-white disabled:opacity-40">
              {busy ? "שומר…" : isOther && !pick.what.trim() ? "כותבים מה נזרק" : pick.reason ? "דיווח" : "בוחרים למה"}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default StaffWaste;
