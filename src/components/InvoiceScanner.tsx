import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Category = "supply" | "fixed" | "one_time";
type Draft = { name: string; supplier: string; date: string; amount: string; inclVat: boolean; category: Category; monthly: string };

const today = () => new Date().toISOString().slice(0, 10);
const CAT_LABEL: Record<Category, string> = { supply: "מתכלים (נגמר ונקנה שוב)", fixed: "הוצאה קבועה חודשית", one_time: "הוצאה חד-פעמית" };

/** Shrinks a photo so the upload stays small but readable. */
const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 1800;
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("bad image"));
    img.src = URL.createObjectURL(file);
  });

export default function InvoiceScanner({
  onSaved,
  addFixedExpense,
}: {
  onSaved: () => void;
  addFixedExpense: (label: string, monthly: number) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const scan = async (file: File) => {
    setBusy(true);
    setDraft(null);
    try {
      const image = await toDataUrl(file);
      const { data, error } = await supabase.functions.invoke("scan-invoice", { body: { image } });
      if (error || data?.error) {
        let msg = data?.error;
        try { msg ||= (await (error as any)?.context?.json())?.error; } catch { /* */ }
        throw new Error(msg || "הפענוח נכשל");
      }
      const r = data.result;
      if (!r.is_invoice) toast.warning("לא נראה כמו חשבונית — בדוק את הפרטים");
      setDraft({
        name: r.description || r.supplier || "",
        supplier: r.supplier || "",
        date: /^\d{4}-\d{2}-\d{2}$/.test(r.date || "") ? r.date : today(),
        amount: r.total != null ? String(r.total) : "",
        inclVat: r.includes_vat !== false,
        category: r.category,
        monthly: r.monthly != null ? String(r.monthly) : r.total != null ? String(+(r.total / (r.includes_vat !== false ? 1.18 : 1)).toFixed(2)) : "",
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return toast.error("חסר שם");
    if (draft.category === "fixed") {
      const m = Number(draft.monthly);
      if (!(m > 0)) return toast.error("חסר סכום חודשי");
      await addFixedExpense(name, m);
    } else {
      const a = Number(draft.amount);
      if (!(a > 0)) return toast.error("חסר סכום");
      const { error } = await (supabase as any).from("supply_purchases").insert({
        name, amount: a, includes_vat: draft.inclVat, purchased_at: draft.date,
        kind: draft.category, supplier: draft.supplier.trim() || null,
      });
      if (error) return toast.error("השמירה נכשלה");
      toast.success("ההוצאה נשמרה");
      onSaved();
    }
    setDraft(null);
  };

  const set = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  return (
    <div className="space-y-2 text-sm">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])} />
      <button onClick={() => fileRef.current?.click()} disabled={busy}
        className="w-full rounded-lg bg-primary px-3 py-2.5 font-bold text-primary-foreground disabled:opacity-60">
        {busy ? "קורא את החשבונית..." : "📷 צלם חשבונית והוסף כהוצאה"}
      </button>

      {draft && (
        <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
          <div className="font-bold">בדוק ואשר:</div>
          <label className="block">סוג
            <select value={draft.category} onChange={(e) => set({ category: e.target.value as Category })} className="mt-1 w-full rounded-md border bg-background px-2 py-1">
              {(Object.keys(CAT_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
            </select>
          </label>
          <label className="block">מה נקנה
            <input value={draft.name} onChange={(e) => set({ name: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-2 py-1" />
          </label>
          {draft.category !== "fixed" && (
            <>
              <label className="block">ספק
                <input value={draft.supplier} onChange={(e) => set({ supplier: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-2 py-1" />
              </label>
              <div className="flex flex-wrap gap-2">
                <input type="number" step="0.01" value={draft.amount} onChange={(e) => set({ amount: e.target.value })} className="w-24 rounded-md border bg-background px-2 py-1" placeholder="₪" />
                <select value={draft.inclVat ? "1" : "0"} onChange={(e) => set({ inclVat: e.target.value === "1" })} className="rounded-md border bg-background px-1 py-1">
                  <option value="1">כולל מע״מ</option>
                  <option value="0">לפני מע״מ</option>
                </select>
                <input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} className="rounded-md border bg-background px-1 py-1" />
              </div>
            </>
          )}
          {draft.category === "fixed" && (
            <label className="block">סכום חודשי לפני מע״מ
              <input type="number" step="0.01" value={draft.monthly} onChange={(e) => set({ monthly: e.target.value })} className="mt-1 w-32 rounded-md border bg-background px-2 py-1" />
            </label>
          )}
          <div className="flex gap-2">
            <button onClick={save} className="flex-1 rounded-md bg-primary px-3 py-1.5 font-bold text-primary-foreground">שמור הוצאה</button>
            <button onClick={() => setDraft(null)} className="rounded-md border px-3 py-1.5">ביטול</button>
          </div>
        </div>
      )}
    </div>
  );
}
