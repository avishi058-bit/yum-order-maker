import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Camera, ImageIcon, Loader2, X } from "lucide-react";

const CATS: Record<string, string> = {
  lettuce: "חסה", tomato: "עגבנייה", red_onion: "בצל סגול", pickles: "מלפפון חמוץ", white_onion: "בצל לבן",
  supply: "מתכלה / חומר גלם", one_time: "ציוד חד פעמי",
};
type Line = { raw_name: string; name: string; category: string; quantity: string; unit: string; unit_price: string; total: string; aiCat: string; unknown: boolean };
type Draft = { supplier: string; date: string; inclVat: boolean; lines: Line[] };

const today = () => new Date().toISOString().slice(0, 10);
const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 1800 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("לא הצלחתי לקרוא את התמונה"));
    img.src = URL.createObjectURL(file);
  });

export default function InventoryInvoiceScanner({ token, onClose }: { token: string; onClose: () => void }) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const scan = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setDraft(null);
    try {
      const image = await toDataUrl(file);
      const { data, error } = await supabase.functions.invoke("scan-invoice", { body: { image, mode: "general", inventory_token: token } });
      if (error || data?.error) {
        let msg = data?.error;
        try { msg ||= (await (error as any)?.context?.json())?.error; } catch { /* */ }
        throw new Error(msg || "הפענוח נכשל");
      }
      const r = data.result;
      if (!r.is_invoice) toast.warning("לא נראה כמו חשבונית — בדוק את הפרטים");
      const { data: al } = await supabase.functions.invoke("inventory-action", { body: { token, action: "list_aliases" } });
      const aliases: { raw_name: string; item_key: string; label: string | null }[] = al?.aliases ?? [];
      const norm = (s: string) => s.trim().replace(/\s+/g, " ");
      setDraft({
        supplier: r.supplier || "",
        date: /^\d{4}-\d{2}-\d{2}$/.test(r.date || "") ? r.date : today(),
        inclVat: r.includes_vat !== false,
        lines: (r.lines || []).map((l: any) => {
          const a = aliases.find((x) => norm(x.raw_name) === norm(l.raw_name || ""));
          const cat = a && CATS[a.item_key] ? a.item_key : l.category === "unknown" ? "" : l.category;
          return {
            raw_name: l.raw_name || "", name: a?.label || (l.category === "unknown" ? "" : l.name_he || l.raw_name || ""),
            category: cat, aiCat: cat, unknown: !a && l.category === "unknown",
            quantity: l.quantity != null ? String(l.quantity) : "", unit: l.unit || "",
            unit_price: l.unit_price != null ? String(l.unit_price) : "", total: l.total != null ? String(l.total) : "",
          };
        }),
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (camRef.current) camRef.current.value = "";
      if (galRef.current) galRef.current.value = "";
    }
  };

  const setLine = (i: number, p: Partial<Line>) => setDraft((d) => d && { ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const removeLine = (i: number) => setDraft((d) => d && { ...d, lines: d.lines.filter((_, j) => j !== i) });
  const unanswered = draft?.lines.filter((l) => !l.category || !l.name.trim()).length ?? 0;

  const save = async () => {
    if (!draft) return;
    if (unanswered) return toast.error("ענה קודם על המוצרים שלא זיהיתי");
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("inventory-action", {
        body: {
          token, action: "save_invoice", supplier: draft.supplier, date: draft.date, includes_vat: draft.inclVat,
          lines: draft.lines.map((l) => ({ ...l, remember: l.unknown || l.category !== l.aiCat })),
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`נשמר בניהול המטבח: ${data.supplies} הוצאות, ${data.produce} ירקות${data.aliases ? ` · זכרתי ${data.aliases} שמות חדשים` : ""}`);
      setDraft(null);
      onClose();
    } catch (e) {
      toast.error(`השמירה נכשלה: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background" dir="rtl">
      <div className="sticky top-0 flex items-center justify-between border-b bg-card px-4 py-3">
        <h2 className="text-lg font-bold">🧾 סריקת חשבונית</h2>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="סגור"><X className="h-5 w-5" /></Button>
      </div>
      <div className="mx-auto max-w-2xl space-y-3 p-4 text-sm">
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => scan(e.target.files?.[0])} />
        <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={(e) => scan(e.target.files?.[0])} />
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" disabled={busy} onClick={() => camRef.current?.click()} className="gap-2"><Camera className="h-5 w-5" /> צלם חשבונית</Button>
          <Button size="lg" variant="outline" disabled={busy} onClick={() => galRef.current?.click()} className="gap-2"><ImageIcon className="h-5 w-5" /> מהגלריה</Button>
        </div>
        {busy && <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> קורא את החשבונית...</div>}
        {!draft && !busy && <p className="text-center text-muted-foreground">החשבונית תישמר אוטומטית בניהול המטבח (הוצאות ועלות ירקות). מוצר שלא אזהה — אשאל אותך ואזכור לפעם הבאה.</p>}

        {draft && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <input value={draft.supplier} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} placeholder="ספק" className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5" />
              <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="rounded-md border bg-background px-1 py-1.5" />
              <select value={draft.inclVat ? "1" : "0"} onChange={(e) => setDraft({ ...draft, inclVat: e.target.value === "1" })} className="rounded-md border bg-background px-1 py-1.5">
                <option value="1">כולל מע״מ</option><option value="0">לפני מע״מ</option>
              </select>
            </div>
            {unanswered > 0 && <div className="rounded-md bg-destructive/10 p-2 font-bold text-destructive">יש {unanswered} מוצרים שלא הבנתי — מה הם? אזכור את התשובה לפעם הבאה.</div>}
            {draft.lines.map((l, i) => (
              <div key={i} className={`space-y-1.5 rounded-md border p-2 ${!l.category || !l.name.trim() ? "border-2 border-destructive" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold">{l.raw_name || "—"}</div>
                  <button onClick={() => removeLine(i)} className="text-muted-foreground" aria-label="הסר שורה"><X className="h-4 w-4" /></button>
                </div>
                {l.unknown && <div className="text-destructive">❓ לא הכרתי — מה זה?</div>}
                <div className="flex flex-wrap gap-1.5">
                  <input value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} placeholder="מה המוצר? (למשל: צ׳יפס קלאסי)" className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1" />
                  <select value={l.category} onChange={(e) => setLine(i, { category: e.target.value })} className="rounded-md border bg-background px-1 py-1">
                    <option value="">סוג...</option>
                    {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <input value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} className="w-16 rounded-md border bg-background px-1 py-1" placeholder="כמות" />
                  <input value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} className="w-14 rounded-md border bg-background px-1 py-1" placeholder="יחידה" />
                  <input value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value })} className="w-16 rounded-md border bg-background px-1 py-1" placeholder="₪/יח׳" />
                  <input value={l.total} onChange={(e) => setLine(i, { total: e.target.value })} className="w-20 rounded-md border bg-background px-1 py-1" placeholder="סה״כ ₪" />
                </div>
              </div>
            ))}
            <Button size="lg" className="w-full" disabled={saving || !draft.lines.length} onClick={save}>
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "שמור לניהול המטבח"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
