// Shared menu pricing for server-side validation.
// MUST stay in sync with src/data/menu.ts.
// Only used by Edge Functions to recompute prices server-side.

export interface MenuItemPricing {
  id: string;
  name: string;
  price: number;
  category: "burger" | "side" | "drink" | "deal" | "meal";
  baseBurgerId?: string;
}

export const MENU_ITEMS: MenuItemPricing[] = [
  // Burgers
  { id: "classic", name: "קלאסי", price: 52, category: "burger" },
  { id: "smash-moshavnikim", name: "סמאש של מושבניקים", price: 58, category: "burger" },
  { id: "avishai", name: "אבישי שחוט לי פרה!", price: 78, category: "burger" },
  { id: "double", name: "כפולה", price: 76, category: "burger" },
  { id: "crazy-smash", name: "קרייזי סמאש", price: 64, category: "burger" },
  { id: "smash-double-cheese", name: "סמאש דאבל צ׳יז", price: 66, category: "burger" },
  { id: "special-hadegel", name: "ספיישל הדגל", price: 73, category: "burger" },
  { id: "haf-mifsha", name: "חף מפשע", price: 55, category: "burger" },
  // Meals
  { id: "meal-classic", name: "ארוחת קלאסי", price: 75, category: "meal", baseBurgerId: "classic" },
  { id: "meal-smash-moshavnikim", name: "ארוחת סמאש של מושבניקים", price: 81, category: "meal", baseBurgerId: "smash-moshavnikim" },
  { id: "meal-avishai", name: "ארוחת אבישי שחוט לי פרה!", price: 101, category: "meal", baseBurgerId: "avishai" },
  { id: "meal-double", name: "ארוחת כפולה", price: 99, category: "meal", baseBurgerId: "double" },
  { id: "meal-crazy-smash", name: "ארוחת קרייזי סמאש", price: 87, category: "meal", baseBurgerId: "crazy-smash" },
  { id: "meal-smash-double-cheese", name: "ארוחת סמאש דאבל צ׳יז", price: 89, category: "meal", baseBurgerId: "smash-double-cheese" },
  { id: "meal-special-hadegel", name: "ארוחת ספיישל הדגל", price: 96, category: "meal", baseBurgerId: "special-hadegel" },
  { id: "meal-haf-mifsha", name: "ארוחת חף מפשע", price: 78, category: "meal", baseBurgerId: "haf-mifsha" },
  // Sides
  { id: "fries", name: "צ׳יפס", price: 20, category: "side" },
  { id: "waffle-fries", name: "וופל צ׳יפס", price: 25, category: "side" },
  { id: "onion-rings", name: "טבעות בצל", price: 24, category: "side" },
  { id: "tempura-onion", name: "טבעות בצל ביתיות בטמפורה", price: 32, category: "side" },
  { id: "friends-mix", name: "מיקס חברים", price: 59, category: "side" },
  // Drinks
  { id: "can", name: "פחית", price: 10, category: "drink" },
  { id: "bottle", name: "בקבוק", price: 12, category: "drink" },
  { id: "beer-regular", name: "בירה", price: 18, category: "drink" },
  { id: "beer-premium", name: "בירה פרימיום", price: 23, category: "drink" },
  { id: "beer-weiss", name: "ויינשטפאן (חצי)", price: 25, category: "drink" },
  // Deals
  { id: "family-deal", name: "דיל משפחתי", price: 300, category: "deal" },
  { id: "friends-deal", name: "דיל חברים", price: 216, category: "deal" },
];

export const TOPPINGS_PRICING: Record<string, { name: string; price: number }> = {
  "onion-jam": { name: "ריבת בצל של סבתא דינה", price: 9 },
  "peanut-butter": { name: "חמאת בוטנים", price: 8 },
  "fried-onion": { name: "בצל מטוגן", price: 7 },
  "garlic-confit": { name: "קונפי שום", price: 7 },
  "egg": { name: "ביצת עין", price: 8 },
  "vegan-cheddar": { name: "צ׳דר טבעוני", price: 7 },
  "roastbeef": { name: "רצועות רוסטביף", price: 20 },
  "extra-patty": { name: "אקסטרה קציצה (220 גרם)", price: 25 },
  "hot-pepper-jam": { name: "ריבת פלפלים חריפים", price: 9 },
  "onion-rings-topping": { name: "שלוש טבעות בצל ביתיות", price: 8 },
  "maple": { name: "מייפל", price: 5 },
};

export const MEAL_UPGRADE_PRICE = 23;

export const MEAL_SIDE_PRICING: Record<string, { name: string; price: number }> = {
  "side-fries": { name: "צ׳יפס רגיל", price: 0 },
  "side-waffle": { name: "וופל צ׳יפס", price: 5 },
  "side-onion-rings": { name: "טבעות בצל", price: 4 },
  "side-tempura": { name: "טבעות בצל ביתיות בטמפורה", price: 13 },
};

// Meal drinks (in ItemCustomizer)
const MEAL_DRINK_PRICING: Record<string, { name: string; price: number }> = {
  "drink-cola": { name: "קולה", price: 0 },
  "drink-zero": { name: "זירו", price: 0 },
  "drink-fanta": { name: "פאנטה", price: 0 },
  "drink-fanta-grape": { name: "פאנטה ענבים", price: 0 },
  "drink-fanta-exotic": { name: "פאנטה אקזוטי", price: 0 },
  "drink-sprite": { name: "ספרייט", price: 0 },
  "drink-sprite-zero": { name: "ספרייט זירו", price: 0 },
  "drink-blu": { name: "בלו", price: 0 },
  "drink-blu-mojito": { name: "בלו מוחיטו", price: 0 },
  "drink-blu-day": { name: "בלו דיי", price: 0 },
  "drink-goldstar": { name: "גולדסטאר", price: 8 },
  "drink-heineken": { name: "הייניקן", price: 8 },
  "drink-corona": { name: "קורונה", price: 8 },
  "drink-carlsberg": { name: "קאלסברג", price: 8 },
  "drink-laffe": { name: "לאפ בראון", price: 12 },
  "drink-unfiltered": { name: "גולדסטאר אנפילטר", price: 12 },
  "drink-guinness": { name: "גינס", price: 12 },
};

// Deal drinks (in DealCustomizer / FamilyDealCustomizer)
const DEAL_DRINK_PRICING: Record<string, { name: string; price: number }> = {
  "deal-cola": { name: "קולה", price: 0 },
  "deal-zero": { name: "זירו", price: 0 },
  "deal-fanta": { name: "פאנטה", price: 0 },
  "deal-fanta-grape": { name: "פאנטה ענבים", price: 0 },
  "deal-fanta-exotic": { name: "פאנטה אקזוטי", price: 0 },
  "deal-sprite": { name: "ספרייט", price: 0 },
  "deal-sprite-zero": { name: "ספרייט זירו", price: 0 },
  "deal-blu": { name: "בלו", price: 0 },
  "deal-blu-mojito": { name: "בלו מוחיטו", price: 0 },
  "deal-blu-day": { name: "בלו דיי", price: 0 },
  "deal-grapes": { name: "ענבים (בקבוק)", price: 2 },
  "deal-oranges": { name: "תפוזים (בקבוק)", price: 2 },
  "deal-flavored-water": { name: "מים בטעמים (בקבוק)", price: 2 },
  "deal-goldstar": { name: "גולדסטאר", price: 8 },
  "deal-heineken": { name: "הייניקן", price: 8 },
  "deal-corona": { name: "קורונה", price: 8 },
  "deal-carlsberg": { name: "קאלסברג", price: 8 },
  "deal-laffe": { name: "לאפ בראון", price: 12 },
  "deal-unfiltered": { name: "גולדסטאר אנפילטר", price: 12 },
  "deal-guinness": { name: "גינס", price: 12 },
  // Family deal IDs
  "fam-cola": { name: "קולה", price: 0 },
  "fam-zero": { name: "זירו", price: 0 },
  "fam-fanta": { name: "פאנטה", price: 0 },
  "fam-sprite": { name: "ספרייט", price: 0 },
  "fam-blu": { name: "בלו", price: 0 },
  "fam-grapes": { name: "ענבים", price: 0 },
  "fam-apples": { name: "תפוחים", price: 0 },
  "fam-goldstar": { name: "גולדסטאר", price: 8 },
  "fam-heineken": { name: "הייניקן", price: 8 },
  "fam-corona": { name: "קורונה", price: 8 },
  "fam-carlsberg": { name: "קאלסברג", price: 8 },
  "fam-laffe": { name: "לאפ בראון", price: 12 },
  "fam-unfiltered": { name: "גולדסטאר אנפילטר", price: 12 },
  "fam-guinness": { name: "גינס", price: 12 },
};

// Lookup maps
const MENU_BY_ID = new Map(MENU_ITEMS.map((m) => [m.id, m]));

export function getMenuItem(id: string): MenuItemPricing | undefined {
  return MENU_BY_ID.get(id);
}

// Apply admin price overrides (from site_settings.menu_item_overrides)
export function getEffectivePrice(
  itemId: string,
  overrides: Record<string, { price?: number }> = {}
): number | undefined {
  const item = MENU_BY_ID.get(itemId);
  if (!item) return undefined;
  const override = overrides?.[itemId];
  if (override && typeof override.price === "number") return override.price;
  return item.price;
}

export interface ServerCartItem {
  itemId: string;
  quantity: number;
  toppings?: string[];
  removals?: string[];
  withMeal?: boolean;
  mealSideId?: string | null;
  mealDrinkId?: string | null;
  dealBurgers?: Array<{ name?: string; removals?: string[] }> | null;
  dealDrinks?: Array<{ optionId: string }> | null;
}

export interface PricingResult {
  ok: true;
  total: number;
  lines: Array<{
    itemId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    toppingNames: string[];
    removalNames: string[];
    withMeal: boolean;
    mealSideName: string | null;
    mealDrinkName: string | null;
    dealBurgers: Array<{ name?: string; removals?: string[] }> | null;
    dealDrinks: Array<{ optionId: string; name: string }> | null;
  }>;
}

export interface PricingError {
  ok: false;
  error: string;
}

/**
 * Recomputes the entire cart price server-side. Clients can lie about prices
 * but this function is the only source of truth for what gets charged.
 */
export function computeCartPricing(
  items: ServerCartItem[],
  overrides: Record<string, { price?: number }> = {}
): PricingResult | PricingError {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Cart is empty" };
  }

  const lines: PricingResult["lines"] = [];
  let total = 0;

  for (const item of items) {
    const menuItem = MENU_BY_ID.get(item.itemId);
    if (!menuItem) {
      return { ok: false, error: `Unknown menu item: ${item.itemId}` };
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50) {
      return { ok: false, error: `Invalid quantity for ${item.itemId}` };
    }

    const basePrice = getEffectivePrice(item.itemId, overrides) ?? menuItem.price;
    let unitPrice = basePrice;
    const toppingNames: string[] = [];
    const removalNames: string[] = [];
    let mealSideName: string | null = null;
    let mealDrinkName: string | null = null;
    let dealDrinksWithNames: Array<{ optionId: string; name: string }> | null = null;

    // Toppings (only valid for burgers/meals)
    if (item.toppings?.length) {
      if (menuItem.category !== "burger" && menuItem.category !== "meal") {
        return { ok: false, error: `Toppings not allowed on ${item.itemId}` };
      }
      for (const tId of item.toppings) {
        const t = TOPPINGS_PRICING[tId];
        if (!t) return { ok: false, error: `Unknown topping: ${tId}` };
        unitPrice += t.price;
        toppingNames.push(t.name);
      }
    }

    // Removals (free, just record names)
    if (item.removals?.length) {
      for (const rId of item.removals) {
        // Names resolved client-side; we just pass through the ids→names via stored array
        removalNames.push(rId);
      }
    }

    // Meal upgrade (burger → meal)
    if (item.withMeal) {
      if (menuItem.category !== "burger") {
        return { ok: false, error: `Meal upgrade only valid on burgers (${item.itemId})` };
      }
      unitPrice += MEAL_UPGRADE_PRICE;
    }

    // Meal side / drink — valid for meals or burger+withMeal
    const isMealContext = menuItem.category === "meal" || item.withMeal;
    if (item.mealSideId) {
      if (!isMealContext) {
        return { ok: false, error: `Side not allowed on ${item.itemId}` };
      }
      const side = MEAL_SIDE_PRICING[item.mealSideId];
      if (!side) return { ok: false, error: `Unknown side: ${item.mealSideId}` };
      unitPrice += side.price;
      mealSideName = side.name;
    }
    if (item.mealDrinkId) {
      if (!isMealContext) {
        return { ok: false, error: `Drink not allowed on ${item.itemId}` };
      }
      const drink = MEAL_DRINK_PRICING[item.mealDrinkId];
      if (!drink) return { ok: false, error: `Unknown meal drink: ${item.mealDrinkId}` };
      unitPrice += drink.price;
      mealDrinkName = drink.name;
    }

    // Deal drinks (price extras get added on top of deal base price)
    if (item.dealDrinks?.length) {
      if (menuItem.category !== "deal") {
        return { ok: false, error: `Deal drinks not allowed on ${item.itemId}` };
      }
      dealDrinksWithNames = [];
      for (const dd of item.dealDrinks) {
        const drink = DEAL_DRINK_PRICING[dd.optionId];
        if (!drink) return { ok: false, error: `Unknown deal drink: ${dd.optionId}` };
        unitPrice += drink.price;
        dealDrinksWithNames.push({ optionId: dd.optionId, name: drink.name });
      }
    }

    const lineTotal = unitPrice * item.quantity;
    total += lineTotal;

    lines.push({
      itemId: item.itemId,
      name: menuItem.name,
      unitPrice,
      quantity: item.quantity,
      lineTotal,
      toppingNames,
      removalNames,
      withMeal: !!item.withMeal,
      mealSideName,
      mealDrinkName,
      dealBurgers: item.dealBurgers ?? null,
      dealDrinks: dealDrinksWithNames,
    });
  }

  // Round to 2 decimals
  total = Math.round(total * 100) / 100;
  return { ok: true, total, lines };
}
