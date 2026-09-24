// Net-profit estimate: revenue excl. VAT − food cost − credit fees − prorated fixed costs.
import type { CountableOrderItem } from "@/lib/burgerStats";

export const VAT_RATE = 0.18;
/** Credit fee 0.78% before VAT */
export const CREDIT_FEE_RATE = 0.0078 * (1 + VAT_RATE);

const C = {
  patty: 8.36,
  bun: 2.7,
  veg: 1.5,
  sauce: 1 / 3,
  egg: 1.3,
  cheese: 1.61,
  addon: 2,
  crispy: 9,
  fries: 3.5,
};

/** base cost of one unit (without toppings) */
const ITEM_COST: Record<string, number> = {
  classic: C.patty + C.bun + C.veg,
  avishai: C.patty + C.bun + C.veg,
  "special-hadegel": C.patty + C.bun + C.veg,
  "haf-mifsha": C.patty + C.bun + C.veg,
  "smash-moshavnikim": 2 * C.patty + C.bun + C.veg,
  double: 2 * C.patty + C.bun + C.veg,
  "crazy-smash": 2 * C.patty + C.bun + C.veg,
  "smash-double-cheese": 2 * C.patty + C.bun + C.veg + 2 * C.cheese,
  "crispy-chicken": C.crispy + C.bun + C.veg,
  fries: C.fries,
  "sweet-potato-fries": C.fries,
  // מיקס חברים = מנה אחת מכל סוג: צ׳יפס, טבעות בצל, וופל צ׳יפס
  "friends-mix": 3 * C.fries,
  // one giant fries = 3 portions
  "family-deal": 5 * (C.patty + C.bun + C.veg) + 3 * C.fries,
  "friends-deal": 3 * (C.patty + C.bun + C.veg) + 3 * C.fries,
};

const NAME_TO_ID: Record<string, string> = {
  "קלאסי": "classic",
  "סמאש של מושבניקים": "smash-moshavnikim",
  "אבישי שחוט לי פרה!": "avishai",
  "כפולה": "double",
  "קרייזי סמאש": "crazy-smash",
  "סמאש דאבל צ׳יז": "smash-double-cheese",
  "ספיישל הדגל": "special-hadegel",
  "חף מפשע": "haf-mifsha",
  "קריספי צ׳יקן": "crispy-chicken",
  "דיל משפחתי": "family-deal",
  "דיל חברים": "friends-deal",
  "צ׳יפס": "fries",
  "מיקס חברים": "friends-mix",
};

const TOPPING_COST: { match: string; cost: number }[] = [
  { match: "זוג קציצות סמאש", cost: 2 * C.patty },
  { match: "תוספת קציצה", cost: C.patty },
  { match: "ביצת עין", cost: C.egg },
  { match: "צ׳דר", cost: C.cheese },
  { match: "צ'דר", cost: C.cheese },
  { match: "ריבת בצל", cost: C.addon },
  { match: "בצל מטוגן", cost: C.addon },
  { match: "קונפי שום", cost: C.addon },
  { match: "ריבת פלפלים", cost: C.addon },
  { match: "מיונז", cost: C.sauce },
  { match: "קטשופ", cost: C.sauce },
  { match: "איולי", cost: C.sauce },
];

/** Drink unit costs before VAT. Order matters: first match wins. */
const DRINK_COST: { re: RegExp; cost: number }[] = [
  { re: /מים\s*ב?טעמ/, cost: 3.354 },
  { re: /בלו/, cost: 2.188 },
  { re: /פיוז/, cost: 4.417 },
  { re: /סודה/, cost: 2.292 },
  { re: /תפוזים/, cost: 3.167 },
  { re: /ענבים/, cost: 3.167 },
  { re: /גולדסטאר/, cost: 4.808 },
  { re: /קרלסברג|קאלסברג|קלסטברג/, cost: 4.767 },
  { re: /^מים|מים \(בקבוק\)/, cost: 1.763 },
  { re: /פחית|קולה|זירו|פאנטה|ספרייט/, cost: 2.646 },
];

export const drinkCost = (name: string | null | undefined): number => {
  const n = (name || "").trim();
  if (!n) return 0;
  return DRINK_COST.find((d) => d.re.test(n))?.cost ?? 0;
};

const mult = (t: string) => {
  const m = t.match(/[×x]\s*(\d+)/);
  return m ? Number(m[1]) : 1;
};

export const itemCost = (it: CountableOrderItem): number => {
  const qty = Number(it.quantity) || 0;
  const name = (it.item_name || "").trim();
  const isMeal = (it.item_id || "").startsWith("meal-") || name.startsWith("ארוחת ");
  const baseId =
    (it.item_id || "").replace(/^meal-/, "") ||
    NAME_TO_ID[name.replace(/^ארוחת\s+/, "")] ||
    "";
  let unit = ITEM_COST[baseId] ?? drinkCost(name);
  // same drink cost whether sold alone or in a meal/deal — the price difference is already in the revenue
  if (it.meal_drink) unit += drinkCost(it.meal_drink);
  if (Array.isArray(it.deal_drinks)) {
    for (const d of it.deal_drinks as { name?: string }[]) unit += drinkCost(d?.name);
  }
  if (isMeal) unit += C.fries;
  for (const t of it.toppings ?? []) {
    const hit = TOPPING_COST.find((p) => t.includes(p.match));
    if (hit) unit += hit.cost * mult(t);
  }
  return unit * qty;
};

/** Takeaway packaging, before VAT */
export const PACK = { friesBox: 0.4, giantFriesBox: 0.8, bag: 0.39, wrap: 0.21 };
const FRIED_IDS = new Set(["fries", "sweet-potato-fries", "waffle-fries", "onion-rings", "tempura-onion"]);
const FRIED_NAME = /צ[׳']יפס|וופל|טבעות בצל/;
const BURGER_IDS = new Set(["classic", "avishai", "special-hadegel", "haf-mifsha", "smash-moshavnikim", "double", "crazy-smash", "smash-double-cheese", "crispy-chicken"]);

/** Packaging cost of ONE takeaway order */
export const packagingCost = (orderItems: CountableOrderItem[]): number => {
  let burgers = 0, fried = 0, mixUnits = 0, dealBags = 0, other = 0, cost = 0;
  for (const it of orderItems) {
    const qty = Number(it.quantity) || 0;
    const name = (it.item_name || "").trim();
    const isMeal = (it.item_id || "").startsWith("meal-") || name.startsWith("ארוחת ");
    const id = (it.item_id || "").replace(/^meal-/, "") || NAME_TO_ID[name.replace(/^ארוחת\s+/, "")] || "";
    if (id === "friends-deal" || id === "family-deal") {
      const n = id === "family-deal" ? 5 : 3;
      cost += qty * (n * PACK.wrap + PACK.giantFriesBox);
      dealBags += qty * (id === "family-deal" ? 2 : 1);
      continue;
    }
    // מיקס חברים — אריזה אחת של צ׳יפס ענק, לא 3 אריזות נפרדות
    if (id === "friends-mix") {
      cost += qty * PACK.giantFriesBox;
      mixUnits += qty;
      continue;
    }
    if (BURGER_IDS.has(id)) burgers += qty;
    else if (FRIED_IDS.has(id) || FRIED_NAME.test(name)) fried += qty;
    else other += qty;
    if (isMeal) fried += qty;
  }
  cost += burgers * PACK.wrap + fried * PACK.friesBox;
  const friedAll = fried + mixUnits;
  let bags = 0;
  if (burgers + friedAll + other > 0) {
    bags = burgers > 3 ? 2 : 1;
    if (friedAll > 4) bags += 1;
  }
  return cost + (bags + dealBags) * PACK.bag;
};

/** Dine-in: extra 0.6 ₪ per burger/crispy served in the cabin */
const DINE_IN_BURGER_EXTRA = 0.6;

/** Dine-in: one cardboard tray (0.39) per burger/crispy (deals = tray per burger) + 0.6 per burger, plus one tray for each giant fries / friends mix */
export const dineInPackagingCost = (orderItems: CountableOrderItem[]): number => {
  let trays = 0, burgerTrays = 0;
  for (const it of orderItems) {
    const qty = Number(it.quantity) || 0;
    const name = (it.item_name || "").trim();
    const id = (it.item_id || "").replace(/^meal-/, "") || NAME_TO_ID[name.replace(/^ארוחת\s+/, "")] || "";
    // כל המבורגר בדיל = כלי נפרד, והצ׳יפס הענק בדיל מוסיף כלי נוסף
    if (id === "friends-deal") { trays += (3 + 1) * qty; burgerTrays += 3 * qty; }
    else if (id === "family-deal") { trays += (5 + 1) * qty; burgerTrays += 5 * qty; }
    // מיקס חברים מוגש בכלי של צ׳יפס ענק
    else if (id === "friends-mix") trays += qty;
    else if (BURGER_IDS.has(id)) { trays += qty; burgerTrays += qty; }
  }
  return trays * PACK.bag + burgerTrays * DINE_IN_BURGER_EXTRA; // סירת קרטון = מחיר שקית 0.39
};

export const ACCOUNTANT_MONTHLY = 350; // before VAT
/** Payslip prep: 50 ₪ before VAT per month, only in months the employee worked */
export const PAYSLIP_MONTHLY = 50;
export const NATIONAL_INSURANCE_RATE = 0.08;
/** Frying oil: 5.5 L/week at 6.5 ₪/L before VAT */
export const OIL_WEEKLY = 5.5 * 6.5;
/** Trash bags: 1.2 ₪ per work day */
export const TRASH_BAGS_DAILY = 1.2;

export interface ProfitInput {
  revenue: number;
  creditRevenue: number;
  items: CountableOrderItem[];
  /** ids of takeaway orders (bags/boxes/wraps apply only to these) */
  takeawayIds?: Set<string>;
  /** ids of dine-in orders (cardboard tray per burger) */
  dineInIds?: Set<string>;
  /** monthly costs already allocated to this range by work days */
  fixed: number;
  wages: number;
  accountant: number;
  /** frying oil allocated to this range */
  oil?: number;
  /** trash bags allocated to this range */
  trashBags?: number;
}

export const computeProfit = ({ revenue, creditRevenue, items, takeawayIds, dineInIds, fixed, wages, accountant, oil = 0, trashBags = 0 }: ProfitInput) => {
  const byOrder: Record<string, CountableOrderItem[]> = {};
  for (const i of items) if (takeawayIds?.has(i.order_id)) (byOrder[i.order_id] ??= []).push(i);
  const byDineOrder: Record<string, CountableOrderItem[]> = {};
  for (const i of items) if (dineInIds?.has(i.order_id)) (byDineOrder[i.order_id] ??= []).push(i);
  const packaging =
    Object.values(byOrder).reduce((s, l) => s + packagingCost(l), 0) +
    Object.values(byDineOrder).reduce((s, l) => s + dineInPackagingCost(l), 0);
  const netRevenue = revenue / (1 + VAT_RATE);
  const vat = revenue - netRevenue;
  const foodCost = items.reduce((s, i) => s + itemCost(i), 0);
  const creditFees = creditRevenue * CREDIT_FEE_RATE;
  const beforeTax = netRevenue - foodCost - creditFees - packaging - fixed - wages - accountant - oil - trashBags;
  const nationalInsurance = beforeTax > 0 ? beforeTax * NATIONAL_INSURANCE_RATE : 0;
  const profit = beforeTax - nationalInsurance;
  return { netRevenue, vat, foodCost, packaging, creditFees, fixed, wages, accountant, oil, trashBags, beforeTax, nationalInsurance, profit, margin: netRevenue ? profit / netRevenue : 0 };
};
