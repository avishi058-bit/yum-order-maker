import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, X } from "lucide-react";
import { AUDIT_PRODUCTS, periodsFor, type AuditItem, type StockCount } from "@/lib/stockAudit";

const fmtDate = (s: string) => new Date(s).toLocaleString("he-IL", { day: "numeric", month: "numeric", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const n2 = (x: number) => (Math.round(x * 1000) / 1000).toString();

export default function StockAudit({ token, onClose }: { token: string; onClose: () => void }) {
  const [counts, setCounts] = useState<StockCount[] | null>(null);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [form, setForm] = useState<Record<string, { count: string; received: string }>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("inventory-action", { body: { token, action: "stock_audit_data" } });
    if (error || data?.error) { toast.error("לא הצלחתי לטעון ספירות"); setCounts([]); return; }
    setCounts(data.counts ?? []);
    setItems(data.items ?? []);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const setF = (k: string, p: Partial<{ count: string; received: string }>) =>
    setForm((f) => ({ ...f, [k]: { count: "", received: "", ...f[k], ...p } }));

  const save = async () => {
    const now = new Date().toISOString();
    const rows = AUDIT_PRODUCTS.flatMap((p) => {
      const f = form[p.key];
      if (!f) return [];
      const r = [];
      if (f.count.trim() !== "") r.push({ item_key: p.key, kind: "count", quantity: f.count, unit: p.unit, counted_at: now });
      if (f.received.trim() !== "" && Number(f.received) > 0) r.push({ item_key: p.key, kind: "received", quantity: Number(f.received) * (p.receivedToUnit ?? 1), unit: p.unit, counted_at: now });
      return r;
    });
    if (!rows.length) return toast.error("לא הוזנה אף כמות");
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("inventory-action", { body: { token, action: "add_stock_count", rows } });
    setSaving(false);
    if (error || data?.error) return toast.error("השמירה נכשלה");
    toast.success("הספירה נשמרה");
    setForm({});
    load();
  };

  const del = async (c: StockCount) => {
    if (!confirm("למחוק את הרישום?")) return;
    const { data, error } = await supabase.functions.invoke("inventory-action", { body: { token, action: "delete_stock_count", id: c.id } });
    if (error || data?.error) return toast.error("המחיקה נכשלה");
    load();
  };

  const groups = useMemo(() => [...new Set(AUDIT_PRODUCTS.map((p) => p.group))], []);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background" dir="rtl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-4 py-3">
        <h2 className="text-lg font-bold">📋 ספירת מלאי ובדיקת שימוש</h2>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="סגור"><X className="h-5 w-5" /></Button>
      </div>
      <div className="mx-auto max-w-2xl space-y-4 p-4 text-sm">
        <p className="text-muted-foreground">
          המעקב על כל מוצר מתחיל רק מהספירה הראשונה שלו. הזן כמה נשאר עכשיו, וכמה סחורה חדשה נכנסה. בספירה הבאה אחשב כמה נוצל לעומת מה שנמכר.
        </p>
        {!counts ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div> : groups.map((g) => (
          <div key={g} className="space-y-2">
            <h3 className="text-base font-bold">{g}</h3>
            {AUDIT_PRODUCTS.filter((p) => p.group === g).map((p) => {
              const mine = counts.filter((c) => c.item_key === p.key);
              const periods = periodsFor(p, counts, items);
              return (
                <div key={p.key} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-bold">{p.label}</div>
                    <div className="text-xs text-muted-foreground">{mine.length ? `במעקב מ-${fmtDate(mine[0].counted_at)}` : "עוד לא נספר"}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">תלוי ב: {p.dependsOn}</div>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-1">נשאר עכשיו
                      <input inputMode="decimal" value={form[p.key]?.count ?? ""} onChange={(e) => setF(p.key, { count: e.target.value })} className="w-20 rounded-md border bg-background px-2 py-1" />
                      {p.unit}
                    </label>
                    <label className="flex items-center gap-1">סחורה חדשה
                      <input inputMode="decimal" value={form[p.key]?.received ?? ""} onChange={(e) => setF(p.key, { received: e.target.value })} className="w-20 rounded-md border bg-background px-2 py-1" />
                      {p.receivedUnit ?? p.unit}
                    </label>
                  </div>
                  {p.receivedUnit && p.receivedUnit !== p.unit && (
                    <div className="text-xs text-muted-foreground">סחורה חדשה מוזנת ב{p.receivedUnit} לפי החשבונית, ונשמרת ב{p.unit}</div>
                  )}
                  {periods.map((r) => (
                    <div key={r.from} className="rounded-md bg-muted p-2">
                      <div className="text-xs">{fmtDate(r.from)} ← {fmtDate(r.to)}: היה {n2(r.start)} + נכנס {n2(r.received)} − נשאר {n2(r.end)} = <b>נוצל {n2(r.used)} {p.unit}</b></div>
                      {r.drivers.map((d) => (
                        <div key={d.label} className="text-xs">{d.label}: {d.units} → <b>{d.perUnit == null ? "—" : `${n2(d.perUnit)} ${p.unit} למנה`}</b></div>
                      ))}
                    </div>
                  ))}
                  {mine.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">היסטוריית רישומים ({mine.length})</summary>
                      {mine.map((c) => (
                        <div key={c.id} className="flex items-center justify-between border-t py-1">
                          <span>{fmtDate(c.counted_at)} · {c.kind === "count" ? "ספירה" : "סחורה חדשה"}: {n2(Number(c.quantity))} {c.unit}</span>
                          <button onClick={() => del(c)} className="text-destructive" aria-label="מחק"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <Button size="lg" className="w-full" disabled={saving} onClick={save}>{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "שמור ספירה"}</Button>
      </div>
    </div>
  );
}
