// Counts how many burgers and patties were actually sold, from order_items rows.

export interface CountableOrderItem {
  order_id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  toppings: string[] | null;
  meal_drink?: string | null;
  meal_side?: string | null;
  deal_drinks?: unknown;
}

/** burgers / patties produced by one unit of a menu item */
const ITEM_UNITS: Record<string, { burgers: number; patties: number }> = {
  classic: { burgers: 1, patties: 1 },
  "smash-moshavnikim": { burgers: 1, patties: 2 },
  avishai: { burgers: 1, patties: 1 },
  double: { burgers: 1, patties: 2 },
  "crazy-smash": { burgers: 1, patties: 2 },
  "smash-double-cheese": { burgers: 1, patties: 2 },
  "special-hadegel": { burgers: 1, patties: 1 },
  "haf-mifsha": { burgers: 1, patties: 1 },
  "crispy-chicken": { burgers: 1, patties: 0 },
  "family-deal": { burgers: 5, patties: 5 },
  "friends-deal": { burgers: 3, patties: 3 },
};

// Meals carry the same burger as their base item
for (const id of Object.keys(ITEM_UNITS)) {
  if (!id.endsWith("-deal")) ITEM_UNITS[`meal-${id}`] = ITEM_UNITS[id];
}

/** Legacy rows have no item_id — fall back to the Hebrew name */
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
};

/** extra patties bought as toppings */
const TOPPING_PATTIES: { match: string; patties: number }[] = [
  { match: "זוג קציצות סמאש", patties: 2 },
  { match: "תוספת קציצה צמחונית", patties: 1 },
  { match: "תוספת קציצה", patties: 1 },
];

const toppingMultiplier = (topping: string): number => {
  const m = topping.match(/[×x]\s*(\d+)/);
  return m ? Number(m[1]) : 1;
};

export const countBurgers = (items: CountableOrderItem[]) => {
  let burgers = 0;
  let patties = 0;

  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    const baseName = (it.item_name || "").replace(/^ארוחת\s+/, "").trim();
    const id =
      it.item_id ||
      NAME_TO_ID[baseName] ||
      NAME_TO_ID[(it.item_name || "").trim()] ||
      "";
    const unit = ITEM_UNITS[id] || ITEM_UNITS[id.replace(/^meal-/, "")];
    if (unit) {
      burgers += unit.burgers * qty;
      patties += unit.patties * qty;
    }

    for (const t of it.toppings ?? []) {
      const hit = TOPPING_PATTIES.find((p) => t.includes(p.match));
      if (hit) patties += hit.patties * toppingMultiplier(t) * qty;
    }
  }

  return { burgers, patties };
};
