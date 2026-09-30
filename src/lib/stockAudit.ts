// Stock usage audit: counts per product, usage between counts vs. what was sold.
// Tracking for a product starts only at its first count — nothing before that is used.

export type AuditItem = {
  order_id: string; item_id: string | null; item_name: string; quantity: number;
  toppings: string[] | null; removals: string[] | null; with_meal: boolean | null;
  deal_burgers: unknown; created_at: string; dine_in: boolean | null;
};
export type StockCount = { id: string; item_key: string; kind: "count" | "received"; quantity: number; unit: string | null; counted_at: string; note: string | null };

type Driver = { label: string; per: (it: AuditItem) => number };
export type AuditProduct = { key: string; label: string; group: string; unit: string; drivers: Driver[]; split?: number[]; dependsOn: string };

const BURGER_IDS = ["classic", "smash-moshavnikim", "avishai", "double", "crazy-smash", "smash-double-cheese", "special-hadegel", "haf-mifsha", "crispy-chicken"];
const DEAL_BURGERS: Record<string, number> = { "family-deal": 5, "friends-deal": 3 };
const FRIED_IDS = ["fries", "sweet-potato-fries", "onion-rings", "tempura-onion"];
const baseId = (it: AuditItem) => (it.item_id || "").replace(/^meal-/, "");
const q = (it: AuditItem) => Number(it.quantity) || 0;
const removed = (list: unknown, word: string) =>
  Array.isArray(list) && list.some((r) => typeof r === "string" && /^(ללא|בלי|יבש)/.test(r) && (r.includes(word) || r.includes("ירקות")));

/** burgers that got this vegetable (removals excluded, incl. burgers inside deals) */
const vegBurgers = (word: string) => (it: AuditItem) => {
  const id = baseId(it);
  if (BURGER_IDS.includes(id)) return removed(it.removals, word) ? 0 : q(it);
  const n = DEAL_BURGERS[it.item_id || ""];
  if (!n) return 0;
  const list = Array.isArray(it.deal_burgers) ? (it.deal_burgers as { removals?: string[] }[]) : [];
  const skipped = list.filter((b) => removed(b?.removals, word)).length;
  return Math.max(0, n - skipped) * q(it);
};

const toppingUnits = (it: AuditItem, match: string) =>
  (it.toppings ?? []).reduce((s, t) => {
    if (!t.includes(match)) return s;
    const m = t.match(/[×x]\s*(\d+)/);
    return s + (m ? Number(m[1]) : 1) * q(it);
  }, 0);

const friedBoxes = (it: AuditItem) => {
  if (FRIED_IDS.includes(it.item_id || "")) return q(it);
  if ((it.item_id || "").startsWith("meal-") || it.with_meal) return q(it);
  return 0;
};

export const AUDIT_PRODUCTS: AuditProduct[] = [
  { key: "lettuce", label: "חסה", group: "ירקות", unit: "ק״ג", dependsOn: "כל ההמבורגרים וקריספי צ׳יקן, בלי מי שביקש בלי חסה", drivers: [{ label: "המבורגרים עם חסה", per: vegBurgers("חסה") }] },
  { key: "tomato", label: "עגבנייה", group: "ירקות", unit: "ק״ג", dependsOn: "כל ההמבורגרים וקריספי צ׳יקן, בלי מי שביקש בלי עגבנייה", drivers: [{ label: "המבורגרים עם עגבנייה", per: vegBurgers("עגבני") }] },
  { key: "red_onion", label: "בצל סגול", group: "ירקות", unit: "ק״ג", dependsOn: "כל ההמבורגרים וקריספי צ׳יקן, בלי מי שביקש בלי בצל", drivers: [{ label: "המבורגרים עם בצל", per: vegBurgers("בצל") }] },
  { key: "pickles", label: "מלפפון חמוץ", group: "ירקות", unit: "ק״ג", dependsOn: "כל ההמבורגרים וקריספי צ׳יקן, בלי מי שביקש בלי חמוצים", drivers: [{ label: "המבורגרים עם חמוצים", per: vegBurgers("חמוצ") }] },
  {
    key: "white_onion", label: "בצל לבן", group: "ירקות", unit: "ק״ג", split: [0.85, 0.15],
    dependsOn: "85% לריבת בצל (כולל ספיישל הדגל), 15% לבצל מטוגן. לא קשור לטבעות בצל",
    drivers: [
      { label: "מנות ריבת בצל", per: (it) => toppingUnits(it, "ריבת בצל") + (baseId(it) === "special-hadegel" ? q(it) : 0) },
      { label: "מנות בצל מטוגן", per: (it) => toppingUnits(it, "בצל מטוגן") },
    ],
  },
  { key: "fried_box", label: "מארז לצ׳יפס / טבעות", group: "אריזות", unit: "יח׳", dependsOn: "צ׳יפס, וופל צ׳יפס, טבעות בצל, טבעות בטמפורה ותוספת בארוחות — בישיבה ובטייק אווי", drivers: [{ label: "מנות מטוגנים", per: friedBoxes }] },
];

export type Period = { from: string; to: string; start: number; received: number; end: number; used: number; drivers: { label: string; units: number; perUnit: number | null }[] };

export function periodsFor(p: AuditProduct, counts: StockCount[], items: AuditItem[]): Period[] {
  const list = counts.filter((c) => c.item_key === p.key).sort((a, b) => a.counted_at.localeCompare(b.counted_at));
  const snaps = list.filter((c) => c.kind === "count");
  const out: Period[] = [];
  for (let i = 1; i < snaps.length; i++) {
    const a = snaps[i - 1], b = snaps[i];
    const received = list.filter((c) => c.kind === "received" && c.counted_at >= a.counted_at && c.counted_at < b.counted_at).reduce((s, c) => s + Number(c.quantity), 0);
    const used = Number(a.quantity) + received - Number(b.quantity);
    const inRange = items.filter((it) => it.created_at >= a.counted_at && it.created_at < b.counted_at);
    out.push({
      from: a.counted_at, to: b.counted_at, start: Number(a.quantity), received, end: Number(b.quantity), used,
      drivers: p.drivers.map((d, j) => {
        const units = inRange.reduce((s, it) => s + d.per(it), 0);
        const share = p.split ? p.split[j] : 1;
        return { label: d.label, units, perUnit: units ? (used * share) / units : null };
      }),
    });
  }
  return out;
}
