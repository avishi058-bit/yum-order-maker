// Stock usage audit: counts per product, usage between counts vs. what was sold.
// Tracking for a product starts only at its first count — nothing before that is used.
// Owner enters "left now" + "new goods" per product. New goods may be entered in a
// different unit (invoice kg, boxes) and converted to the tracked unit via receivedToUnit.

export type AuditItem = {
  order_id: string; item_id: string | null; item_name: string; quantity: number;
  toppings: string[] | null; removals: string[] | null; with_meal: boolean | null;
  deal_burgers: unknown; created_at: string; dine_in: boolean | null;
};
export type StockCount = { id: string; item_key: string; kind: "count" | "received"; quantity: number; unit: string | null; counted_at: string; note: string | null };

type Driver = { label: string; per: (it: AuditItem, orderFrac: number) => number };
export type AuditProduct = {
  key: string; label: string; group: string; unit: string;
  drivers: Driver[]; split?: number[]; dependsOn: string;
  /** unit the owner types when adding new goods (defaults to unit) */
  receivedUnit?: string;
  /** multiply the entered amount to get `unit` (kg→units, boxes→portions) */
  receivedToUnit?: number;
};

const BURGER_IDS = ["classic", "smash-moshavnikim", "avishai", "double", "crazy-smash", "smash-double-cheese", "special-hadegel", "haf-mifsha", "crispy-chicken"];
const DEAL_BURGERS: Record<string, number> = { "family-deal": 5, "friends-deal": 3 };
const DEAL_BOX_IDS = ["family-deal", "friends-deal", "friends-mix"];
const FRIED_IDS = ["fries", "sweet-potato-fries", "onion-rings", "tempura-onion"];
const baseId = (it: AuditItem) => (it.item_id || "").replace(/^meal-/, "");
const q = (it: AuditItem) => Number(it.quantity) || 0;
const removed = (list: unknown, word: string) =>
  Array.isArray(list) && list.some((r) => typeof r === "string" && /^(ללא|בלי|יבש)/.test(r) && (r.includes(word) || r.includes("ירקות")));

/** burgers that got this vegetable/sauce (removals excluded, incl. burgers inside deals) */
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

const isTakeaway = (it: AuditItem) => it.dine_in === false;
const isDineIn = (it: AuditItem) => it.dine_in === true;

const takeawayOrdersF: Driver = { label: "הזמנות טייק אווי", per: (it, f) => (isTakeaway(it) ? f : 0) };
const takeawayItems: Driver = { label: "פריטים בטייק אווי", per: (it) => (isTakeaway(it) ? q(it) : 0) };
const dineInOrders: Driver = { label: "הזמנות בישיבה", per: (it, f) => (isDineIn(it) ? f : 0) };
const dineInItems: Driver = { label: "פריטים בישיבה", per: (it) => (isDineIn(it) ? q(it) : 0) };

const sideSaucesSold = (match: string): Driver => ({
  label: "רטבים בצד שנמכרו (טייק אווי)",
  per: (it) => toppingUnits(it, match),
});

export const AUDIT_PRODUCTS: AuditProduct[] = [
  // ===== ירקות — נספרים ביחידות =====
  { key: "lettuce", label: "חסה", group: "ירקות", unit: "יח׳", dependsOn: "כל ההמבורגרים וקריספי צ׳יקן, בלי מי שביקש בלי חסה. נספר ביחידות", drivers: [{ label: "המבורגרים עם חסה", per: vegBurgers("חסה") }] },
  { key: "tomato", label: "עגבנייה", group: "ירקות", unit: "יח׳", receivedUnit: "ק״ג", receivedToUnit: 1 / 0.14, dependsOn: "כל ההמבורגרים וקריספי צ׳יקן, בלי מי שביקש בלי עגבנייה. חשבונית בק״ג — עגבנייה ממוצעת 140 גרם", drivers: [{ label: "המבורגרים עם עגבנייה", per: vegBurgers("עגבני") }] },
  { key: "red_onion", label: "בצל סגול", group: "ירקות", unit: "יח׳", receivedUnit: "ק״ג", receivedToUnit: 1 / 0.135, dependsOn: "כל ההמבורגרים וקריספי צ׳יקן, בלי מי שביקש בלי בצל. חשבונית בק״ג — בצל ממוצע 135 גרם", drivers: [{ label: "המבורגרים עם בצל", per: vegBurgers("בצל") }] },
  { key: "pickles", label: "מלפפון חמוץ", group: "ירקות", unit: "יח׳", dependsOn: "כל ההמבורגרים וקריספי צ׳יקן, בלי מי שביקש בלי חמוצים. נספר בפחיות שימורים", drivers: [{ label: "המבורגרים עם חמוצים", per: vegBurgers("חמוצ") }] },
  { key: "white_onion", label: "בצל לבן", group: "ירקות", unit: "ק״ג", split: [0.85, 0.15],
    dependsOn: "85% לריבת בצל (כולל ספיישל הדגל), 15% לבצל מטוגן. לא קשור לטבעות בצל",
    drivers: [
      { label: "מנות ריבת בצל", per: (it) => toppingUnits(it, "ריבת בצל") + (baseId(it) === "special-hadegel" ? q(it) : 0) },
      { label: "מנות בצל מטוגן", per: (it) => toppingUnits(it, "בצל מטוגן") },
    ] },
  // ===== אריזות =====
  { key: "fried_box", label: "מארז לצ׳יפס / טבעות", group: "אריזות", unit: "יח׳", dependsOn: "צ׳יפס, וופל צ׳יפס, טבעות בצל, טבעות בטמפורה ותוספת בארוחות — בישיבה ובטייק אווי", drivers: [{ label: "מנות מטוגנים", per: friedBoxes }] },
  { key: "fried_box_large", label: "מארז צ׳יפס גדול (דילים)", group: "אריזות", unit: "יח׳", dependsOn: "מארז גדול אחד לכל דיל חברים, דיל משפחתי ומיקס חברים", drivers: [{ label: "דילים ומיקס חברים", per: (it) => (DEAL_BOX_IDS.includes(it.item_id || "") ? q(it) : 0) }] },
  { key: "bags", label: "שקיות טייק אווי", group: "אריזות", unit: "יח׳", dependsOn: "רק הזמנות לקחת — בודקים כמה שקיות יוצאות ביחס למספר ההזמנות ולגודלן", drivers: [takeawayOrdersF, takeawayItems] },
  // ===== רטבים — מנות (טייק אווי בלבד) =====
  { key: "ketchup_portions", label: "קטשופ מנות", group: "רטבים — מנות", unit: "מנות", receivedUnit: "ארגז", receivedToUnit: 996, dependsOn: "רק לטייק אווי. ארגז = 996 מנות — מזין ארגזים והמערכת ממירה", drivers: [takeawayOrdersF, takeawayItems] },
  { key: "mayo_portions", label: "מיונז מנות", group: "רטבים — מנות", unit: "מנות", receivedUnit: "ארגז", receivedToUnit: 900, dependsOn: "רק לטייק אווי. ארגז = 900 מנות — מזין ארגזים והמערכת ממירה", drivers: [takeawayOrdersF, takeawayItems] },
  // ===== רטבים — ישיבה במקום =====
  { key: "ketchup_pouch", label: "קטשופ פאוץ׳", group: "רטבים — ישיבה", unit: "ליטר", dependsOn: "רק לישיבה במקום. פאוץ׳ של 13 ליטר", drivers: [dineInOrders, dineInItems] },
  { key: "mayo_bucket", label: "מיונז דלי", group: "רטבים — ישיבה", unit: "ליטר", receivedUnit: "ק״ג", receivedToUnit: 1, dependsOn: "רק לישיבה במקום. דלי של 5 ק״ג (ק״ג ≈ ליטר)", drivers: [dineInOrders, dineInItems] },
  // ===== רטבים — גם בצד בטייק אווי =====
  { key: "plum", label: "שזיפים", group: "רטבים — גם בצד", unit: "ליטר", dependsOn: "לישיבה במקום וגם רוטב בצד בטייק אווי. נספר בליטרים לפי החשבונית", drivers: [dineInOrders, sideSaucesSold("שזיפים")] },
  { key: "chili", label: "צ׳ילי חריף", group: "רטבים — גם בצד", unit: "ליטר", dependsOn: "לישיבה במקום וגם רוטב בצד בטייק אווי. נספר בליטרים לפי החשבונית", drivers: [dineInOrders, sideSaucesSold("צ׳ילי")] },
  { key: "aioli", label: "איולי", group: "רטבים — גם בצד", unit: "ליטר", dependsOn: "לישיבה במקום (כולל בהמבורגרים) וגם רוטב בצד בטייק אווי. נספר בליטרים לפי החשבונית", drivers: [dineInOrders, sideSaucesSold("איולי")] },
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
    // weight so an "orders" driver counts each order once, no matter how many items it has
    const perOrder = new Map<string, number>();
    for (const it of inRange) perOrder.set(it.order_id, (perOrder.get(it.order_id) ?? 0) + 1);
    const orderFrac = (it: AuditItem) => 1 / (perOrder.get(it.order_id) ?? 1);
    out.push({
      from: a.counted_at, to: b.counted_at, start: Number(a.quantity), received, end: Number(b.quantity), used,
      drivers: p.drivers.map((d, j) => {
        const units = inRange.reduce((s, it) => s + d.per(it, orderFrac(it)), 0);
        const share = p.split ? p.split[j] : 1;
        return { label: d.label, units, perUnit: units ? (used * share) / units : null };
      }),
    });
  }
  return out;
}
