import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SupplyPurchase, avgDuration, coverDays, preVat } from "@/lib/supplies";

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d: string) => d.split("-").reverse().join("/");

export default function SuppliesManager({ list, onChange }: { list: SupplyPurchase[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [inclVat, setInclVat] = useState(true);
  const [date, setDate] = useState(today());

  const names = useMemo(() => Array.from(new Set(list.map((p) => p.name))), [list]);
  const active = list.filter((p) => !p.finished_at);
  const history = list.filter((p) => p.finished_at).slice(0, 15);

  const add = async () => {
    const n = name.trim();
    const a = Number(amount);
    if (!n || !(a > 0)) return toast.error("יש למלא שם וסכום");
    const { error } = await (supabase as any).from("supply_purchases").insert({ name: n, amount: a, includes_vat: inclVat, purchased_at: date });
    if (error) return toast.error("השמירה נכשלה");
    toast.success("הקנייה נשמרה");
    setName(""); setAmount(""); setDate(today());
    onChange();
  };
  const finish = async (id: string) => {
    const { error } = await (supabase as any).from("supply_purchases").update({ finished_at: today() }).eq("id", id);
    if (error) toast.error("השמירה נכשלה"); else { toast.success("סומן שנגמר"); onChange(); }
  };
  const reopen = async (id: string) => {
    await (supabase as any).from("supply_purchases").update({ finished_at: null }).eq("id", id);
    onChange();
  };
  const remove = async (id: string) => {
    if (!confirm("למחוק את הקנייה?")) return;
    await (supabase as any).from("supply_purchases").delete().eq("id", id);
    onChange();
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="font-bold">🧴 מתכלים (סבון, מפיות, ניקוי, רטבים...)</div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-2">
        <input list="supply-names" value={name} onChange={(e) => setName(e.target.value)} placeholder="מה קנית?" className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1" />
        <datalist id="supply-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
        <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="₪" className="w-20 rounded-md border bg-background px-2 py-1" />
        <select value={inclVat ? "1" : "0"} onChange={(e) => setInclVat(e.target.value === "1")} className="rounded-md border bg-background px-1 py-1">
          <option value="1">כולל מע״מ</option>
          <option value="0">לפני מע״מ</option>
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border bg-background px-1 py-1" />
        <button onClick={add} className="rounded-md bg-primary px-3 py-1 font-bold text-primary-foreground">הוסף קנייה</button>
      </div>

      <div className="space-y-1.5">
        <div className="text-muted-foreground">בשימוש עכשיו:</div>
        {active.length === 0 && <div className="text-muted-foreground">אין פריטים פעילים</div>}
        {active.map((p) => {
          const { days } = coverDays(list, p);
          const avg = avgDuration(list, p.name);
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5">
              <span className="flex-1 font-bold">{p.name}</span>
              <span>₪{preVat(p).toFixed(0)} לפני מע״מ</span>
              <span className="text-muted-foreground">נקנה {fmt(p.purchased_at)}</span>
              <span className="text-muted-foreground">{avg ? `מחזיק בממוצע ${Math.round(avg)} ימים` : "ממוצע יחושב אחרי שיגמר"} · ₪{(preVat(p) / days).toFixed(2)}/יום</span>
              <button onClick={() => finish(p.id)} className="rounded-md bg-destructive px-2 py-1 font-bold text-destructive-foreground">נגמר</button>
              <button onClick={() => remove(p.id)} className="px-1 font-bold text-destructive" aria-label="מחק">✕</button>
            </div>
          );
        })}
      </div>

      {history.length > 0 && (
        <details>
          <summary className="cursor-pointer text-muted-foreground">היסטוריית קניות שנגמרו</summary>
          <div className="mt-1 space-y-1">
            {history.map((p) => {
              const { days } = coverDays(list, p);
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 px-2 py-1">
                  <span className="flex-1">{p.name}</span>
                  <span>₪{preVat(p).toFixed(0)}</span>
                  <span className="text-muted-foreground">{fmt(p.purchased_at)} → {fmt(p.finished_at!)} ({Math.round(days)} ימים)</span>
                  <button onClick={() => reopen(p.id)} className="text-xs underline">בטל "נגמר"</button>
                  <button onClick={() => remove(p.id)} className="px-1 font-bold text-destructive" aria-label="מחק">✕</button>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
