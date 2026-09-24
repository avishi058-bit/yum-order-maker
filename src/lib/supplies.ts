export type SupplyPurchase = {
  id: string;
  name: string;
  amount: number;
  includes_vat: boolean;
  purchased_at: string; // YYYY-MM-DD
  finished_at: string | null;
  notes: string | null;
};

const DAY = 86400000;
const toDay = (s: string) => new Date(s + "T00:00:00").getTime();

export const preVat = (p: SupplyPurchase) => (p.includes_vat ? Number(p.amount) / 1.18 : Number(p.amount));

/** Average days a product lasts, based on finished purchases with the same name. */
export function avgDuration(list: SupplyPurchase[], name: string): number | null {
  const done = list.filter((p) => p.name.trim() === name.trim() && p.finished_at);
  if (!done.length) return null;
  const sum = done.reduce((s, p) => s + Math.max(1, (toDay(p.finished_at!) - toDay(p.purchased_at)) / DAY), 0);
  return sum / done.length;
}

/** Days a purchase covers: actual if finished, else estimated from history (fallback 30). */
export function coverDays(list: SupplyPurchase[], p: SupplyPurchase): { days: number; estimated: boolean } {
  if (p.finished_at) return { days: Math.max(1, (toDay(p.finished_at) - toDay(p.purchased_at)) / DAY), estimated: false };
  const avg = avgDuration(list, p.name);
  const sinceBuy = Math.max(1, (Date.now() - toDay(p.purchased_at)) / DAY);
  return { days: Math.max(avg ?? 30, sinceBuy), estimated: true };
}

/** Pre-VAT cost of supplies allocated to [start, end) — spread evenly over the days each purchase lasted. */
export function suppliesCostInRange(list: SupplyPurchase[], start: Date, end: Date): number {
  let total = 0;
  for (const p of list) {
    const { days } = coverDays(list, p);
    const a = toDay(p.purchased_at);
    const b = a + days * DAY;
    const overlap = Math.min(b, end.getTime()) - Math.max(a, start.getTime());
    if (overlap > 0) total += (preVat(p) / days) * (overlap / DAY);
  }
  return total;
}
