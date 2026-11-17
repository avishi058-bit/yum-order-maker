// Orders to suppliers, worked out from the latest stock counts and reports.
// fill: complete to N packs (whole packs only). below: order N packs when that
// many units or fewer are left. Other products: whatever was reported missing.
// The owner unticks what he doesn't want, can fix amounts and the text, and
// sends it himself on WhatsApp.
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { dateIL, staffDb, timeIL } from "@/lib/staff";

interface Supplier { id: string; name: string; phone: string | null; delivery_weekday: number | null; count_weekday: number | null }
interface Item {
  id: string; name: string; unit: string; pack_name: string | null; pack_size: number | null; supplier: string | null;
  order_rule: "fill" | "below" | null; order_target: number | null; order_below: number | null; order_optional: boolean;
}
interface Line { item: Item; qty: number | null; note: string; checked: boolean }

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const SIGNATURE = "אבישי, הבעלים של המבורגר הבקתה";
const orderName = (name: string) => name.replace(/^פחית /, "פחיות ");
const halfText = (q: number) => (Number.isInteger(q) ? String(q) : `${q >= 1 ? Math.floor(q) : ""}½`);

const buildLines = (items: Item[], latest: Map<string, { qty: number; at: string }>, reported: Map<string, string>): Line[] => {
  const out: Line[] = [];
  for (const item of items) {
    const have = latest.get(item.id)?.qty ?? null;
    const target = Number(item.order_target ?? 0);
    if (item.order_rule === "fill") {
      if (have === null) { out.push({ item, qty: target, note: "לא נספר", checked: false }); continue; }
      if (item.pack_size) {
        const qty = target - Math.floor(have / item.pack_size);
        if (qty > 0) out.push({ item, qty, note: `נשארו ${halfText(have)} ${item.unit}`, checked: !item.order_optional });
      } else if (have === 0) {
        out.push({ item, qty: target, note: "נגמר", checked: !item.order_optional });
      } else {
        out.push({ item, qty: target, note: `נשארו ${halfText(have)} - לבדוק כמה להזמין`, checked: false });
      }
    } else if (item.order_rule === "below") {
      if (have === null) out.push({ item, qty: target, note: "לא נספר", checked: false });
      else if (have <= Number(item.order_below ?? 0)) out.push({ item, qty: target, note: `נשארו ${halfText(have)} ${item.unit}`, checked: !item.order_optional });
    } else if (reported.has(item.id)) {
      out.push({ item, qty: null, note: reported.get(item.id) === "out" ? "נגמר" : "נשאר קצת", checked: true });
    }
  }
  return out;
};

const messageFor = (s: Supplier, lines: Line[]) => {
  const rows = lines.filter((l) => l.checked && (l.qty === null || l.qty > 0)).map((l) =>
    l.qty === null ? `- ${l.item.name}` : `- ${l.qty} ${l.qty === 1 ? "ארגז" : "ארגזים"} ${orderName(l.item.name)}`);
  if (rows.length === 0) return "";
  const when = s.delivery_weekday !== null ? ` לאספקה ביום ${DAYS[s.delivery_weekday]}` : "";
  return `שלום, הזמנה להמבורגר הבקתה${when}:\n${rows.join("\n")}\n\nתודה,\n${SIGNATURE}`;
};

const waLink = (phone: string, text: string) => {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
};

const SupplierCard = ({ s, initial, lastAt, onPhone }: { s: Supplier; initial: Line[]; lastAt: string | null; onPhone: (p: string) => void }) => {
  const [lines, setLines] = useState(initial);
  const [text, setText] = useState(() => messageFor(s, initial));
  const [phone, setPhone] = useState(s.phone ?? "");
  useEffect(() => { setLines(initial); setText(messageFor(s, initial)); }, [s, initial]);
  const update = (next: Line[]) => { setLines(next); setText(messageFor(s, next)); };

  return (
    <div className="rounded-xl border border-border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="font-black text-lg">ספק {s.name}</p>
        <p className="text-xs text-muted-foreground">
          {s.delivery_weekday !== null ? `אספקה ביום ${DAYS[s.delivery_weekday]}` : "יום אספקה לא הוגדר"}
          {s.count_weekday !== null ? ` · ספירה ביום ${DAYS[s.count_weekday]} בערב` : ""}
          {lastAt ? ` · נספר ${dateIL(lastAt)} ${timeIL(lastAt)}` : ""}
        </p>
      </div>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">אין מה להזמין לפי הספירה האחרונה.</p>
      ) : (
        <ul className="divide-y divide-border">
          {lines.map((l, i) => (
            <li key={l.item.id} className="flex items-center gap-3 py-2">
              <input type="checkbox" checked={l.checked} aria-label={`להזמין ${l.item.name}`}
                onChange={(e) => update(lines.map((x, j) => (j === i ? { ...x, checked: e.target.checked } : x)))} className="w-6 h-6 accent-green-600 shrink-0" />
              <span className="flex-1">
                <b>{l.item.name}</b>
                <span className="block text-xs text-muted-foreground">{l.note}{l.item.order_optional ? " · לא חובה" : ""}</span>
              </span>
              {l.qty !== null && (
                <label className="flex items-center gap-1 text-sm">
                  <input type="number" min={0} value={l.qty} aria-label={`כמה ארגזים ${l.item.name}`}
                    onChange={(e) => update(lines.map((x, j) => (j === i ? { ...x, qty: Math.max(0, Number(e.target.value) || 0) } : x)))}
                    className="w-14 rounded-md border border-border bg-background px-2 py-1 text-center" />
                  ארגזים
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
      {lines.length > 0 && (
        <>
          <label className="block text-sm font-bold">
            ההודעה לספק (אפשר לערוך)
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(14, text.split("\n").length + 1)}
              className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm font-normal" />
          </label>
          <div className="flex gap-2 flex-wrap items-center">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => phone !== (s.phone ?? "") && onPhone(phone)}
              placeholder="טלפון הספק" aria-label={`טלפון ספק ${s.name}`} className="w-36 rounded-lg border border-border bg-background px-2 py-2 text-sm" dir="ltr" />
            <a href={phone && text ? waLink(phone, text) : undefined} target="_blank" rel="noopener noreferrer"
              aria-disabled={!phone || !text}
              className={`flex-1 text-center rounded-full py-2.5 font-black text-white ${phone && text ? "bg-green-600" : "bg-muted pointer-events-none"}`}>
              שליחה בוואטסאפ
            </a>
          </div>
        </>
      )}
    </div>
  );
};

const SupplierOrders = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [latest, setLatest] = useState(new Map<string, { qty: number; at: string }>());
  const [reported, setReported] = useState(new Map<string, string>());

  const load = useCallback(async () => {
    const [s, it, c, r] = await Promise.all([
      staffDb.from("staff_suppliers").select("id, name, phone, delivery_weekday, count_weekday").order("sort_order"),
      staffDb.from("staff_stock_items").select("id, name, unit, pack_name, pack_size, supplier, order_rule, order_target, order_below, order_optional, sort_order")
        .eq("active", true).not("supplier", "is", null).order("sort_order").order("name"),
      staffDb.from("staff_stock_counts").select("item_id, quantity, created_at").order("created_at", { ascending: false }).limit(1000),
      staffDb.from("staff_stock_reports").select("item_id, level, quantity, created_at").is("resolved_at", null),
    ]);
    const map = new Map<string, { qty: number; at: string }>();
    const consider = (id: string, qty: number, at: string) => {
      const cur = map.get(id);
      if (!cur || cur.at < at) map.set(id, { qty, at });
    };
    for (const x of c.data ?? []) consider(x.item_id, Number(x.quantity), x.created_at);
    const rep = new Map<string, string>();
    for (const x of r.data ?? []) {
      rep.set(x.item_id, x.level);
      if (x.level === "out") consider(x.item_id, 0, x.created_at);
      if (x.level === "count") consider(x.item_id, Number(x.quantity), x.created_at);
    }
    setSuppliers(s.data ?? []);
    setItems(it.data ?? []);
    setLatest(map);
    setReported(rep);
  }, []);
  useEffect(() => { load(); }, [load]);
  // Opened from the "order is ready" notification: jump to this section.
  useEffect(() => {
    if (suppliers.length && window.location.hash === "#orders") document.getElementById("orders")?.scrollIntoView();
  }, [suppliers.length]);

  const bySupplier = useMemo(() => suppliers.map((s) => {
    const mine = items.filter((i) => i.supplier === s.id);
    const ats = mine.map((i) => latest.get(i.id)?.at).filter(Boolean) as string[];
    return { s, lines: buildLines(mine, latest, reported), lastAt: ats.length ? ats.sort().at(-1)! : null };
  }), [suppliers, items, latest, reported]);

  const savePhone = async (id: string, phone: string) => {
    const { error } = await staffDb.from("staff_suppliers").update({ phone: phone.trim() || null }).eq("id", id);
    if (error) toast.error("הטלפון לא נשמר"); else load();
  };

  if (suppliers.length === 0) return null;
  return (
    <section id="orders" className="rounded-2xl bg-card border border-border p-4 space-y-3 scroll-mt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black">הזמנות מספקים</h2>
        <button type="button" onClick={load} className="text-sm text-primary underline">רענון</button>
      </div>
      {bySupplier.map(({ s, lines, lastAt }) => (
        <SupplierCard key={s.id} s={s} initial={lines} lastAt={lastAt} onPhone={(p) => savePhone(s.id, p)} />
      ))}
    </section>
  );
};

export default SupplierOrders;
