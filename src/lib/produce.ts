// Vegetable food-cost tracking: each purchase is assumed to last until the next one of the same kind.
import { countBurgers, type CountableOrderItem } from "@/lib/burgerStats";

export type ProduceKey = "lettuce" | "tomato" | "red_onion" | "pickles" | "white_onion";
export const VEG_KEYS: ProduceKey[] = ["lettuce", "tomato", "red_onion", "pickles"];
export const PRODUCE_LABEL: Record<string, string> = {
  lettuce: "חסה",
  tomato: "עגבנייה",
  red_onion: "בצל סגול",
  pickles: "מלפפון חמוץ",
  white_onion: "בצל לבן (ריבה/מטוגן)",
  other: "אחר — לא ירק לבורגר",
};

export type ProducePurchase = {
  id: string;
  purchased_at: string;
  supplier: string | null;
  item_key: string;
  raw_name: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total: number; // before VAT
  prev_finished: boolean;
};

export type DatedItem = CountableOrderItem & { created_at: string };

const day = (s: string) => new Date(s + "T06:00:00").getTime(); // business day starts 06:00

const onionUnits = (it: DatedItem) => {
  const qty = Number(it.quantity) || 0;
  let n = it.item_id === "special-hadegel" || it.item_id === "meal-special-hadegel" ? qty : 0;
  for (const t of it.toppings ?? []) {
    if (t.includes("ריבת בצל") || t.includes("בצל מטוגן")) {
      const m = t.match(/[×x]\s*(\d+)/);
      n += (m ? Number(m[1]) : 1) * qty;
    }
  }
  return n;
};

const servingsIn = (items: DatedItem[], key: string, a: number, b: number) => {
  const inRange = items.filter((i) => { const t = new Date(i.created_at).getTime(); return t >= a && t < b; });
  return key === "white_onion" ? inRange.reduce((s, i) => s + onionUnits(i), 0) : countBurgers(inRange).burgers;
};

export type Cycle = { from: string; to: string; cost: number; servings: number; perServing: number };

/** Completed cycles per item: purchase date → next purchase date where the previous was marked finished. */
export function cyclesFor(list: ProducePurchase[], items: DatedItem[], key: string): Cycle[] {
  const byDate = new Map<string, { total: number; finished: boolean }>();
  for (const p of list.filter((x) => x.item_key === key)) {
    const g = byDate.get(p.purchased_at) ?? { total: 0, finished: true };
    g.total += Number(p.total) || 0;
    g.finished = g.finished && p.prev_finished;
    byDate.set(p.purchased_at, g);
  }
  const dates = [...byDate.keys()].sort();
  const out: Cycle[] = [];
  let start = 0;
  let cost = byDate.get(dates[0])?.total ?? 0;
  for (let i = 1; i < dates.length; i++) {
    const g = byDate.get(dates[i])!;
    if (!g.finished) { cost += g.total; continue; }
    const servings = servingsIn(items, key, day(dates[start]), day(dates[i]));
    out.push({ from: dates[start], to: dates[i], cost, servings, perServing: servings ? cost / servings : 0 });
    start = i;
    cost = g.total;
  }
  return out;
}

export const avgPerServing = (cycles: Cycle[]) => {
  const c = cycles.reduce((s, x) => s + x.cost, 0);
  const n = cycles.reduce((s, x) => s + x.servings, 0);
  return n ? c / n : null;
};

/** Latest unit-price change for an item vs. the previous purchase with the same unit. */
export function priceChange(list: ProducePurchase[], key: string) {
  const l = list.filter((p) => p.item_key === key && p.unit_price).sort((a, b) => a.purchased_at.localeCompare(b.purchased_at) || 0);
  const last = l[l.length - 1];
  if (!last) return null;
  const prev = [...l.slice(0, -1)].reverse().find((p) => (p.unit || "") === (last.unit || ""));
  if (!prev) return null;
  const pct = ((Number(last.unit_price) - Number(prev.unit_price)) / Number(prev.unit_price)) * 100;
  return { from: Number(prev.unit_price), to: Number(last.unit_price), unit: last.unit, pct };
}
