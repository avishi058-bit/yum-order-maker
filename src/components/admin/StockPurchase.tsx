// Owner shopping: "how much did you bring?" when ticking a missing product,
// and reading a receipt photo to fill in the amounts for every product on it.
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { halfText, itemPack, packPlural, staffDb } from "@/lib/staff";

const RECEIPT_URL = "https://habikta-staff.avishi058.workers.dev/receipt";

export interface PurchaseRow {
  reportId: string;
  item: { id: string; name: string; unit: string; pack_name: string | null; pack_size: number | null };
}

const savePurchase = (reportId: string, qty: number, source: "manual" | "receipt") =>
  staffDb.rpc("staff_stock_purchase", { p_report_id: reportId, p_qty: qty, p_source: source });

/** Amount with a pack stepper (cases) when the product has one, and a unit stepper. */
const Amount = ({ row, value, onChange }: { row: PurchaseRow; value: number; onChange: (n: number) => void }) => {
  const pack = itemPack(row.item);
  const set = (n: number) => onChange(Math.max(0, Math.min(9999, n)));
  const step = (label: string, shown: string, d: number) => (
    <span className="flex items-center gap-2">
      <button type="button" aria-label={`פחות ${label}`} onClick={() => set(value - d)} className="w-10 h-10 rounded-full border border-border text-xl font-black">−</button>
      <span className="w-12 text-center"><span className="block text-xl font-black leading-none">{shown}</span><span className="text-[11px] text-muted-foreground">{label}</span></span>
      <button type="button" aria-label={`יותר ${label}`} onClick={() => set(value + d)} className="w-10 h-10 rounded-full border border-border text-xl font-black">+</button>
    </span>
  );
  if (!pack) return step(row.item.unit, halfText(value), 1);
  const packs = Math.floor(value / pack.size);
  return (
    <span className="flex flex-col gap-1.5 items-end">
      {step(packPlural(pack.name), String(packs), pack.size)}
      {step(row.item.unit, halfText(value - packs * pack.size), 1)}
    </span>
  );
};

/** Asked when one product is ticked: how much was bought. */
export const BoughtDialog = ({ row, onClose }: { row: PurchaseRow; onClose: (saved: boolean) => void }) => {
  const pack = itemPack(row.item);
  const [qty, setQty] = useState(pack ? pack.size : 1);
  const [busy, setBusy] = useState(false);
  const save = async (n: number) => {
    setBusy(true);
    const { error } = await savePurchase(row.reportId, n, "manual");
    setBusy(false);
    if (error) { toast.error("לא נשמר"); return; }
    onClose(true);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => !busy && onClose(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="bought-title" className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 id="bought-title" className="text-xl font-black text-center">כמה הבאת? {row.item.name}</h2>
        <div className="flex justify-center"><Amount row={row} value={qty} onChange={setQty} /></div>
        <button type="button" onClick={() => save(qty)} disabled={busy || qty <= 0} className="w-full rounded-full bg-green-600 py-3 font-black text-white disabled:opacity-50">
          {busy ? "שומר…" : "שמירה"}
        </button>
        <button type="button" onClick={() => save(0)} disabled={busy} className="w-full rounded-full border border-border py-2.5 font-bold">נקנה, בלי לרשום כמות</button>
        <button type="button" onClick={() => onClose(false)} disabled={busy} className="w-full text-sm text-muted-foreground underline">ביטול</button>
      </div>
    </div>
  );
};

/** Shrinks a photo to a JPEG data URL (receipts stay readable at 1600px). */
const toDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src);
    resolve(c.toDataURL("image/jpeg", 0.85));
  };
  img.onerror = reject;
  img.src = URL.createObjectURL(file);
});

/** "Photograph the receipt": finds which missing products it shows and how many. */
export const ReceiptButton = ({ rows, onDone }: { rows: PurchaseRow[]; onDone: () => void }) => {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{ row: PurchaseRow; qty: number; line: string; on: boolean }[] | null>(null);

  const read = async (file: File) => {
    setBusy(true);
    try {
      const image = await toDataUrl(file);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(RECEIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ image, items: rows.map((r) => ({ id: r.item.id, name: r.item.name, unit: r.item.unit, pack_name: r.item.pack_name, pack_size: r.item.pack_size })) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "error");
      const list = (body.found ?? []).flatMap((f: { id: string; quantity: number; line: string }) => {
        const row = rows.find((r) => r.item.id === f.id);
        return row ? [{ row, qty: f.quantity, line: f.line, on: true }] : [];
      });
      if (list.length === 0) toast.info("לא מצאתי בקבלה מוצרים מהרשימה. אפשר לסמן ידנית.");
      else setFound(list);
    } catch {
      toast.error("לא הצלחתי לקרוא את הקבלה. נסו צילום חד יותר, או סמנו ידנית.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const saveAll = async () => {
    if (!found) return;
    setBusy(true);
    const results = await Promise.all(found.filter((f) => f.on).map((f) => savePurchase(f.row.reportId, f.qty, "receipt")));
    setBusy(false);
    if (results.some((r) => r.error)) toast.error("חלק לא נשמרו"); else toast.success("הקנייה נרשמה");
    setFound(null);
    onDone();
  };

  return (
    <>
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" aria-hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); }} />
      <button type="button" onClick={() => input.current?.click()} disabled={busy || rows.length === 0}
        className="w-full rounded-full border-2 border-primary text-primary py-2.5 font-black disabled:opacity-50">
        {busy && !found ? "קורא את הקבלה…" : "📷 צילום קבלה - לסמן הכל לבד"}
      </button>
      {found && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => !busy && setFound(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="receipt-title" className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-card border border-border p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 id="receipt-title" className="text-xl font-black">מה מצאתי בקבלה</h2>
            <p className="text-sm text-muted-foreground">כדאי לעבור על הכמויות - הקריאה לא תמיד מדויקת.</p>
            <ul className="divide-y divide-border">
              {found.map((f, i) => (
                <li key={f.row.reportId} className="py-3 flex items-center gap-3">
                  <input type="checkbox" checked={f.on} aria-label={`לרשום ${f.row.item.name}`} className="w-6 h-6 accent-green-600 shrink-0"
                    onChange={(e) => setFound(found.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} />
                  <span className="flex-1"><b>{f.row.item.name}</b>{f.line && <span className="block text-xs text-muted-foreground">{f.line}</span>}</span>
                  <Amount row={f.row} value={f.qty} onChange={(n) => setFound(found.map((x, j) => (j === i ? { ...x, qty: n } : x)))} />
                </li>
              ))}
            </ul>
            <button type="button" onClick={saveAll} disabled={busy} className="w-full rounded-full bg-green-600 py-3 font-black text-white disabled:opacity-50">
              {busy ? "שומר…" : "שמירה"}
            </button>
            <button type="button" onClick={() => setFound(null)} disabled={busy} className="w-full text-sm text-muted-foreground underline">ביטול</button>
          </div>
        </div>
      )}
    </>
  );
};
