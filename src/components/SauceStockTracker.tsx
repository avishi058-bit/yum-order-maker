// Sauce consumption check (informational only — does not affect profit).
// Usage between counts = previous stock + purchases − current count, divided by days.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Ev = { id: string; sauce: string; kind: "purchase" | "count"; quantity: number; event_date: string };
const SAUCES = ["מיונז", "קטשופ", "איולי", "חריף", "שזיפים", "חלפניו", "סירופ מייפל"];
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d: string) => d.split("-").reverse().join("/");
const days = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 864e5);

function periods(evs: Ev[]) {
  const sorted = [...evs].sort((a, b) => a.event_date.localeCompare(b.event_date) || (a.kind === "purchase" ? -1 : 1));
  const out: { from: string; to: string; used: number; perDay: number }[] = [];
  let level: number | null = null, bought = 0, start = "";
  for (const e of sorted) {
    const q = Number(e.quantity);
    if (e.kind === "purchase") { if (level === null) { level = 0; start = e.event_date; } bought += q; continue; }
    const d = level === null ? 0 : days(start, e.event_date);
    if (level !== null && d > 0) { const used = level + bought - q; out.push({ from: start, to: e.event_date, used, perDay: used / d }); }
    level = q; bought = 0; start = e.event_date;
  }
  return { out, level, bought };
}

export default function SauceStockTracker() {
  const [evs, setEvs] = useState<Ev[]>([]);
  const [sauce, setSauce] = useState(SAUCES[0]);
  const [kind, setKind] = useState<"purchase" | "count">("purchase");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(today());

  const load = async () => {
    const { data } = await (supabase as any).from("sauce_stock_events").select("*").order("event_date", { ascending: false });
    setEvs(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    const q = Number(qty);
    if (!(q >= 0) || qty === "") return toast.error("יש להזין כמות בק״ג");
    const { error } = await (supabase as any).from("sauce_stock_events").insert({ sauce, kind, quantity: q, event_date: date });
    if (error) return toast.error("השמירה נכשלה");
    toast.success("נשמר"); setQty(""); load();
  };
  const remove = async (id: string) => {
    if (!confirm("למחוק?")) return;
    await (supabase as any).from("sauce_stock_events").delete().eq("id", id); load();
  };

  const bySauce = useMemo(() => {
    const names = Array.from(new Set([...SAUCES, ...evs.map((e) => e.sauce)]));
    return names.map((n) => ({ n, ...periods(evs.filter((e) => e.sauce === n)) })).filter((s) => s.level !== null);
  }, [evs]);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3" dir="rtl">
      <div>
        <h3 className="font-bold">🥫 בדיקת צריכת רטבים</h3>
        <p className="text-xs text-muted-foreground">רשום קנייה (ק״ג) וספירת מלאי (כמה נשאר). לבדיקה בלבד — לא משפיע על הרווח.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select className="border rounded-md p-2 bg-background" value={sauce} onChange={(e) => setSauce(e.target.value)}>
          {SAUCES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="border rounded-md p-2 bg-background" value={kind} onChange={(e) => setKind(e.target.value as any)}>
          <option value="purchase">קנייה (נכנס)</option>
          <option value="count">ספירה (נשאר)</option>
        </select>
        <input className="border rounded-md p-2 bg-background" type="number" inputMode="decimal" step="0.1" placeholder="ק״ג (למשל 25)" value={qty} onChange={(e) => setQty(e.target.value)} />
        <input className="border rounded-md p-2 bg-background" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <button onClick={add} className="w-full rounded-md bg-primary text-primary-foreground py-2 font-bold">שמור</button>

      {bySauce.map(({ n, out, level, bought }) => {
        const tot = out.reduce((s, p) => s + p.used, 0), d = out.reduce((s, p) => s + days(p.from, p.to), 0);
        return (
          <div key={n} className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between font-bold">
              <span>{n}</span>
              <span>{d ? `${(tot / d).toFixed(2)} ק״ג ליום` : "צריך ספירה"}</span>
            </div>
            <div className="text-xs text-muted-foreground">במלאי לפי ספירה אחרונה: {Number(level).toFixed(1)} ק״ג{bought ? ` + ${bought} נקנו מאז` : ""}</div>
            {out.slice(-3).reverse().map((p) => (
              <div key={p.from + p.to} className="text-xs">{fmt(p.from)}–{fmt(p.to)}: {p.used.toFixed(1)} ק״ג ({p.perDay.toFixed(2)} ליום)</div>
            ))}
          </div>
        );
      })}

      {evs.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">היסטוריית רישומים</summary>
          {evs.slice(0, 30).map((e) => (
            <div key={e.id} className="flex justify-between py-1 border-b">
              <span>{fmt(e.event_date)} · {e.sauce} · {e.kind === "purchase" ? "קנייה" : "ספירה"} {e.quantity} ק״ג</span>
              <button onClick={() => remove(e.id)} className="text-destructive">מחק</button>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
