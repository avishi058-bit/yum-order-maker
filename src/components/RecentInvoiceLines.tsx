import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

type Row = { table: "produce" | "supply"; id: string; date: string; supplier: string | null; name: string; qty: string; total: string; vatNote: string };

export default function RecentInvoiceLines({ token }: { token: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("inventory-action", { body: { token, action: "recent_invoice_lines" } });
    if (error || data?.error) { toast.error("לא הצלחתי לטעון חשבוניות"); setRows([]); return; }
    const p: Row[] = (data.produce ?? []).map((r: any) => ({
      table: "produce", id: r.id, date: r.purchased_at, supplier: r.supplier, name: r.raw_name || r.item_key,
      qty: r.quantity != null ? String(r.quantity) : "", total: String(r.total), vatNote: "לפני מע״מ",
    }));
    const s: Row[] = (data.supplies ?? []).map((r: any) => ({
      table: "supply", id: r.id, date: r.purchased_at, supplier: r.supplier, name: r.name,
      qty: r.notes ?? "", total: String(r.amount), vatNote: r.includes_vat ? "כולל מע״מ" : "לפני מע״מ",
    }));
    setRows([...p, ...s].sort((a, b) => b.date.localeCompare(a.date)));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const set = (id: string, patch: Partial<Row>) => setRows((r) => r && r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const save = async (r: Row) => {
    setBusyId(r.id);
    const body = r.table === "produce"
      ? { token, action: "update_invoice_line", table: "produce", id: r.id, quantity: r.qty, total: r.total }
      : { token, action: "update_invoice_line", table: "supply", id: r.id, amount: r.total, notes: r.qty };
    const { data, error } = await supabase.functions.invoke("inventory-action", { body });
    setBusyId(null);
    if (error || data?.error) return toast.error("השמירה נכשלה");
    toast.success("עודכן");
  };

  const del = async (r: Row) => {
    if (!confirm(`להסיר את "${r.name}" מהחשבונית?`)) return;
    setBusyId(r.id);
    const { data, error } = await supabase.functions.invoke("inventory-action", { body: { token, action: "delete_invoice_line", table: r.table, id: r.id } });
    setBusyId(null);
    if (error || data?.error) return toast.error("ההסרה נכשלה");
    setRows((x) => x && x.filter((y) => y.id !== r.id));
    toast.success("הוסר");
  };

  if (!rows) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!rows.length) return null;

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.date} · ${r.supplier || "ללא ספק"}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  return (
    <div className="space-y-3 pt-4">
      <h3 className="font-bold">חשבוניות אחרונות — אפשר לתקן או להסיר שורה</h3>
      {[...groups.entries()].map(([k, list]) => (
        <div key={k} className="space-y-1.5 rounded-md border p-2">
          <div className="text-xs font-semibold text-muted-foreground">{k}</div>
          {list.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-1.5 border-t pt-1.5">
              <div className="min-w-0 flex-1 truncate font-medium">{r.name}</div>
              <input value={r.qty} onChange={(e) => set(r.id, { qty: e.target.value })} placeholder={r.table === "produce" ? "כמות" : "כמות / הערה"} className={`${r.table === "produce" ? "w-16" : "w-32"} rounded-md border bg-background px-1 py-1`} />
              <input value={r.total} onChange={(e) => set(r.id, { total: e.target.value })} className="w-20 rounded-md border bg-background px-1 py-1" aria-label="סכום" />
              <span className="text-[10px] text-muted-foreground">₪ {r.vatNote}</span>
              <button disabled={busyId === r.id} onClick={() => save(r)} className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground">שמור</button>
              <button disabled={busyId === r.id} onClick={() => del(r)} className="text-destructive" aria-label="הסר"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
