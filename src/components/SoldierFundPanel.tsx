// Soldier fund balance + ledger + manual adjustment (admin dashboard).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = { id: string; delta: number; reason: string; note: string | null; created_at: string };
const LABEL: Record<string, string> = { donation: "תרומה", donation_reversal: "ביטול תרומה", spend: "שולם לחייל", adjust: "עדכון ידני" };

export default function SoldierFundPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    const { data } = await (supabase as any).from("soldier_fund_ledger").select("*").order("created_at", { ascending: false }).limit(500);
    setRows(data ?? []);
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("soldier-fund").on("postgres_changes", { event: "*", schema: "public", table: "soldier_fund_ledger" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const balance = rows.reduce((s, r) => s + Number(r.delta), 0);
  const donated = rows.filter((r) => r.reason.startsWith("donation")).reduce((s, r) => s + Number(r.delta), 0);
  const meals = rows.filter((r) => r.reason === "spend").length;

  const adjust = async () => {
    const a = Number(amount);
    if (!a) return toast.error("יש להזין סכום (שלילי להורדה)");
    const { error } = await (supabase as any).from("soldier_fund_ledger").insert({ delta: a, reason: "adjust", note: note || null });
    if (error) return toast.error("השמירה נכשלה");
    setAmount(""); setNote(""); toast.success("עודכן"); load();
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3" dir="rtl">
      <h3 className="font-bold">🫡 הזמן חייל/ת</h3>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-primary/10 p-2"><div className="text-xs">יתרה</div><div className="text-xl font-black">₪{balance.toFixed(0)}</div></div>
        <div className="rounded-lg bg-muted p-2"><div className="text-xs">נתרם סה״כ</div><div className="font-bold">₪{donated.toFixed(0)}</div></div>
        <div className="rounded-lg bg-muted p-2"><div className="text-xs">חיילים שקיבלו</div><div className="font-bold">{meals}</div></div>
      </div>
      <p className="text-xs text-muted-foreground">תרומה נכנסת רק אחרי שההזמנה שולמה. לתשלום הזמנה מהקופה - כפתור "🫡 מ'הזמן חייל/ת'" בכרטיס ההזמנה במטבח.</p>
      <div className="flex gap-2">
        <input className="w-24 border rounded-md p-2 bg-background" inputMode="decimal" placeholder="±₪" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className="flex-1 border rounded-md p-2 bg-background" placeholder="הערה (למשל: פינוק לחיילים)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button onClick={adjust} className="rounded-md bg-primary px-3 text-primary-foreground font-bold">עדכן</button>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">תנועות אחרונות</summary>
        {rows.slice(0, 40).map((r) => (
          <div key={r.id} className="flex justify-between py-1 border-b">
            <span>{new Date(r.created_at).toLocaleDateString("he-IL")} · {LABEL[r.reason] ?? r.reason}{r.note ? ` · ${r.note}` : ""}</span>
            <span className={Number(r.delta) < 0 ? "text-destructive" : "text-primary"}>{Number(r.delta) > 0 ? "+" : ""}₪{Number(r.delta)}</span>
          </div>
        ))}
      </details>
    </div>
  );
}
