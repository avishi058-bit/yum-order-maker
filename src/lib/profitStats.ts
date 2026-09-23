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
  "family-deal": 5 * (C.patty + C.bun + C.veg) + 5 * C.fries,
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
  let unit = ITEM_COST[baseId] ?? 0;
  if (isMeal) unit += C.fries;
  for (const t of it.toppings ?? []) {
    const hit = TOPPING_COST.find((p) => t.includes(p.match));
    if (hit) unit += hit.cost * mult(t);
  }
  return unit * qty;
};

export const ACCOUNTANT_MONTHLY = 350; // before VAT
export const NATIONAL_INSURANCE_RATE = 0.08;

export interface ProfitInput {
  revenue: number;
  creditRevenue: number;
  items: CountableOrderItem[];
  /** monthly costs already allocated to this range by work days */
  fixed: number;
  wages: number;
  accountant: number;
}

export const computeProfit = ({ revenue, creditRevenue, items, fixed, wages, accountant }: ProfitInput) => {
  const netRevenue = revenue / (1 + VAT_RATE);
  const vat = revenue - netRevenue;
  const foodCost = items.reduce((s, i) => s + itemCost(i), 0);
  const creditFees = creditRevenue * CREDIT_FEE_RATE;
  const beforeTax = netRevenue - foodCost - creditFees - fixed - wages - accountant;
  const nationalInsurance = beforeTax > 0 ? beforeTax * NATIONAL_INSURANCE_RATE : 0;
  const profit = beforeTax - nationalInsurance;
  return { netRevenue, vat, foodCost, creditFees, fixed, wages, accountant, beforeTax, nationalInsurance, profit, margin: netRevenue ? profit / netRevenue : 0 };
};
