import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VEG_ESTIMATE } from "@/lib/profitStats";
import { PRODUCE_LABEL, VEG_KEYS, avgPerServing, cyclesFor, priceChange, type DatedItem, type ProducePurchase } from "@/lib/produce";

type Alias = { raw_name: string; item_key: string; label: string | null };
type Line = { raw_name: string; quantity: string; unit: string; unit_price: string; total: string; item_key: string; known: boolean };

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d: string) => d.split("-").reverse().join("/");
const norm = (s: string) => s.trim().replace(/\s+/g, " ");
const KEYS = [...VEG_KEYS, "white_onion", "other"];
const UNCOUNTED = new Set(["cancelled", "pending_payment", "payment_failed"]);

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
    img.onerror = () => reject(new Error("bad image"));
    img.src = URL.createObjectURL(file);
  });

export default function ProduceTracker({ approved, onApprove }: { approved: number | null; onApprove: (v: number | null) => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [list, setList] = useState<ProducePurchase[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [items, setItems] = useState<DatedItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ supplier: string; date: string; inclVat: boolean; lines: Line[]; onionFinished: boolean | null } | null>(null);

  const load = async () => {
    const [{ data: p }, { data: a }] = await Promise.all([
      (supabase as any).from("produce_purchases").select("*").order("purchased_at", { ascending: false }),
      (supabase as any).from("product_aliases").select("raw_name, item_key, label"),
    ]);
    setList(p || []);
    setAliases(a || []);
    const first = (p || []).map((x: ProducePurchase) => x.purchased_at).sort()[0];
    if (!first) return setItems([]);
    const all: DatedItem[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await (supabase as any).from("orders")
        .select("created_at, status, payment_method, paid_at, order_items(order_id, item_id, item_name, quantity, toppings)")
        .gte("created_at", new Date(first + "T00:00:00").toISOString()).order("created_at").range(from, from + 999);
      for (const o of data || []) {
        if (UNCOUNTED.has(o.status) || (o.payment_method === "credit" && !o.paid_at)) continue;
        for (const it of o.order_items || []) all.push({ ...it, created_at: o.created_at });
      }
      if (!data || data.length < 1000) break;
    }
    setItems(all);
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const per = [...VEG_KEYS, "white_onion"].map((k) => {
      const cycles = cyclesFor(list, items, k);
      return { key: k, cycles, avg: avgPerServing(cycles), change: priceChange(list, k), count: list.filter((p) => p.item_key === k).length };
    });
    const veg = per.filter((p) => VEG_KEYS.includes(p.key as never));
    const complete = veg.every((p) => p.avg != null);
    const total = veg.reduce((s, p) => s + (p.avg ?? 0), 0);
    return { per, total, complete };
  }, [list, items]);

  const scan = async (file: File) => {
    setBusy(true);
    setDraft(null);
    try {
      const image = await toDataUrl(file);
      const { data, error } = await supabase.functions.invoke("scan-invoice", {
        body: { image, mode: "produce", aliases: aliases.map((a) => ({ raw_name: a.raw_name, label: a.label || PRODUCE_LABEL[a.item_key] || a.item_key })) },
      });
      if (error || data?.error) {
        let msg = data?.error;
        try { msg ||= (await (error as any)?.context?.json())?.error; } catch { /* */ }
        throw new Error(msg || "הפענוח נכשל");
      }
      const r = data.result;
      if (!r.is_invoice) toast.warning("לא נראה כמו חשבונית — בדוק את הפרטים");
      const lines: Line[] = (r.lines || []).map((l: any) => {
        const alias = aliases.find((a) => norm(a.raw_name) === norm(l.raw_name || ""));
        const key = alias ? (KEYS.includes(alias.item_key) ? alias.item_key : "other") : l.item_key;
        return {
          raw_name: l.raw_name || "", quantity: l.quantity != null ? String(l.quantity) : "", unit: l.unit || "",
          unit_price: l.unit_price != null ? String(l.unit_price) : "", total: l.total != null ? String(l.total) : "",
          item_key: key === "unknown" ? "" : key, known: !!alias || key !== "unknown",
        };
      });
      setDraft({ supplier: r.supplier || "", date: /^\d{4}-\d{2}-\d{2}$/.test(r.date || "") ? r.date : today(), inclVat: r.includes_vat !== false, lines, onionFinished: null });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const setLine = (i: number, p: Partial<Line>) => setDraft((d) => d && { ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const hasOnion = draft?.lines.some((l) => l.item_key === "white_onion");
  const hadOnionBefore = list.some((p) => p.item_key === "white_onion");

  const save = async () => {
    if (!draft) return;
    if (draft.lines.some((l) => !l.item_key)) return toast.error("יש מוצרים שלא זיהיתי — בחר מה הם");
    if (hasOnion && hadOnionBefore && draft.onionFinished === null) return toast.error("ענה אם ריבת הבצל הקודמת נגמרה");
    const vat = draft.inclVat ? 1.18 : 1;
    const rows = draft.lines.filter((l) => l.item_key !== "other" && Number(l.total) > 0).map((l) => ({
      purchased_at: draft.date, supplier: draft.supplier.trim() || null, item_key: l.item_key, raw_name: l.raw_name,
      quantity: Number(l.quantity) || null, unit: l.unit || null,
      unit_price: Number(l.unit_price) ? +(Number(l.unit_price) / vat).toFixed(4) : null,
      total: +(Number(l.total) / vat).toFixed(2),
      prev_finished: l.item_key === "white_onion" ? draft.onionFinished !== false : true,
    }));
    // remember names the owner had to identify (or corrected)
    const newAliases = draft.lines.filter((l) => l.raw_name && !aliases.some((a) => norm(a.raw_name) === norm(l.raw_name)) && !l.known)
      .map((l) => ({ raw_name: norm(l.raw_name), item_key: l.item_key, label: PRODUCE_LABEL[l.item_key] }));
    if (newAliases.length) await (supabase as any).from("product_aliases").upsert(newAliases, { onConflict: "raw_name" });
    if (rows.length) {
      const { error } = await (supabase as any).from("produce_purchases").insert(rows);
      if (error) return toast.error("השמירה נכשלה");
    }
    toast.success(`נשמרו ${rows.length} שורות ירקות${newAliases.length ? ` · נזכרתי ב-${newAliases.length} שמות חדשים` : ""}`);
    setDraft(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("למחוק את השורה?")) return;
    await (supabase as any).from("produce_purchases").delete().eq("id", id);
    load();
  };
  const removeAlias = async (raw: string) => {
    await (supabase as any).from("product_aliases").delete().eq("raw_name", raw);
    load();
  };

  return (
    <div className="space-y-3 rounded-lg border p-3 text-sm">
      <div className="font-bold">🥬 עלות ירקות למנה (חסה, עגבנייה, בצל סגול, מלפפון חמוץ)</div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])} />
      <button onClick={() => fileRef.current?.click()} disabled={busy} className="w-full rounded-lg bg-primary px-3 py-2.5 font-bold text-primary-foreground disabled:opacity-60">
        {busy ? "קורא את החשבונית..." : "📷 צלם חשבונית ירקות"}
      </button>

      {draft && (
        <div className="space-y-2 rounded-lg bg-muted/40 p-3">
          <div className="flex flex-wrap gap-2">
            <input value={draft.supplier} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} placeholder="ספק" className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1" />
            <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="rounded-md border bg-background px-1 py-1" />
            <select value={draft.inclVat ? "1" : "0"} onChange={(e) => setDraft({ ...draft, inclVat: e.target.value === "1" })} className="rounded-md border bg-background px-1 py-1">
              <option value="1">כולל מע״מ</option><option value="0">לפני מע״מ</option>
            </select>
          </div>
          {draft.lines.map((l, i) => (
            <div key={i} className={`space-y-1 rounded-md p-2 ${l.item_key ? "bg-background" : "border-2 border-destructive bg-background"}`}>
              <div className="font-bold">{l.raw_name}</div>
              {!l.known && <div className="text-destructive">לא הכרתי את המוצר — מה זה? (אזכור לפעם הבאה)</div>}
              <div className="flex flex-wrap gap-1.5">
                <select value={l.item_key} onChange={(e) => setLine(i, { item_key: e.target.value })} className="rounded-md border bg-background px-1 py-1">
                  <option value="">בחר...</option>
                  {KEYS.map((k) => <option key={k} value={k}>{PRODUCE_LABEL[k]}</option>)}
                </select>
                <input value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} className="w-16 rounded-md border bg-background px-1 py-1" placeholder="כמות" />
                <input value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} className="w-14 rounded-md border bg-background px-1 py-1" placeholder="יחידה" />
                <input value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value })} className="w-16 rounded-md border bg-background px-1 py-1" placeholder="₪/יח׳" />
                <input value={l.total} onChange={(e) => setLine(i, { total: e.target.value })} className="w-20 rounded-md border bg-background px-1 py-1" placeholder="סה״כ ₪" />
              </div>
            </div>
          ))}
          {hasOnion && hadOnionBefore && (
            <div className="rounded-md bg-background p-2">
              <div className="font-bold">האם ריבת הבצל / הבצל המטוגן הקודם נגמר?</div>
              <div className="mt-1 flex gap-2">
                <button onClick={() => setDraft({ ...draft, onionFinished: true })} className={`rounded-md border px-3 py-1 ${draft.onionFinished === true ? "bg-primary text-primary-foreground" : ""}`}>כן, נגמר</button>
                <button onClick={() => setDraft({ ...draft, onionFinished: false })} className={`rounded-md border px-3 py-1 ${draft.onionFinished === false ? "bg-primary text-primary-foreground" : ""}`}>עוד לא</button>
              </div>
            </div>
          )}
          <div className="text-muted-foreground">שורות "אחר" לא נשמרות כירקות.</div>
          <div className="flex gap-2">
            <button onClick={save} className="flex-1 rounded-md bg-primary px-3 py-1.5 font-bold text-primary-foreground">שמור</button>
            <button onClick={() => setDraft(null)} className="rounded-md border px-3 py-1.5">ביטול</button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {stats.per.map((p) => (
          <div key={p.key} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5">
            <span className="flex-1 font-bold">{PRODUCE_LABEL[p.key]}</span>
            <span>{p.avg != null ? `₪${p.avg.toFixed(2)} ${p.key === "white_onion" ? "לתוספת" : "למנה"}` : p.count ? "יחושב בקנייה הבאה" : "אין קניות"}</span>
            {p.change && Math.abs(p.change.pct) >= 1 && (
              <span className={p.change.pct > 0 ? "font-bold text-destructive" : "font-bold text-primary"}>
                {p.change.pct > 0 ? "▲ התייקר" : "▼ הוזל"} {Math.abs(p.change.pct).toFixed(0)}% (₪{p.change.from.toFixed(2)}→₪{p.change.to.toFixed(2)}{p.change.unit ? `/${p.change.unit}` : ""})
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-muted/60 p-2">
        <div>
          ירקות לכל המבורגר/קריספי: <b>{stats.complete ? `₪${stats.total.toFixed(2)}` : "עדיין אין מספיק נתונים"}</b> · אומדן נוכחי ₪{VEG_ESTIMATE.toFixed(2)}
        </div>
        <div className="text-muted-foreground">בחישוב הרווח הנקי: ₪{(approved ?? VEG_ESTIMATE).toFixed(2)} {approved ? "(מאושר על ידך)" : "(אומדן)"}</div>
        <div className="mt-1 flex gap-2">
          {stats.complete && Math.abs(stats.total - (approved ?? VEG_ESTIMATE)) > 0.005 && (
            <button onClick={() => onApprove(+stats.total.toFixed(2))} className="rounded-md bg-primary px-3 py-1 font-bold text-primary-foreground">אשר ₪{stats.total.toFixed(2)} לרווח הנקי</button>
          )}
          {approved != null && <button onClick={() => onApprove(null)} className="rounded-md border px-3 py-1">חזור לאומדן</button>}
        </div>
      </div>

      {list.length > 0 && (
        <details>
          <summary className="cursor-pointer text-muted-foreground">היסטוריית קניות ירקות</summary>
          <div className="mt-1 space-y-1">
            {list.slice(0, 40).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 px-2 py-1">
                <span className="flex-1">{PRODUCE_LABEL[p.item_key]} · {p.raw_name}{p.supplier ? ` · ${p.supplier}` : ""}</span>
                <span>₪{Number(p.total).toFixed(2)} לפני מע״מ</span>
                <span className="text-muted-foreground">{fmt(p.purchased_at)}</span>
                <button onClick={() => remove(p.id)} className="px-1 font-bold text-destructive" aria-label="מחק">✕</button>
              </div>
            ))}
          </div>
        </details>
      )}
      {aliases.length > 0 && (
        <details>
          <summary className="cursor-pointer text-muted-foreground">שמות מוצרים שזכרתי</summary>
          <div className="mt-1 space-y-1">
            {aliases.map((a) => (
              <div key={a.raw_name} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2 py-1">
                <span className="flex-1">"{a.raw_name}" = {a.label || PRODUCE_LABEL[a.item_key]}</span>
                <button onClick={() => removeAlias(a.raw_name)} className="px-1 font-bold text-destructive" aria-label="מחק">✕</button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
