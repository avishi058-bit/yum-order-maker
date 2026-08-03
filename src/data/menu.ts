// Frontend menu definitions.
// Pricing (id/name/price/category) is the SINGLE SOURCE OF TRUTH at:
//   supabase/functions/_shared/menu-pricing.ts
// This file overlays UI-only metadata (description, image, badge, etc.)
// on top of those bare records. To add/remove an item or option, edit the
// shared pricing file ONCE — both the frontend and the order server pick it up.

import {
  MENU_ITEMS_PRICING,
  TOPPINGS_PRICING as TOPPINGS_PRICING_SHARED,
  MEAL_SIDES_PRICING,
  MEAL_DRINKS_PRICING,
  DEAL_DRINKS_PRICING,
  MEAL_UPGRADE_PRICE,
  type MenuCategory,
} from "../../supabase/functions/_shared/menu-pricing";

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  weight?: string;
  category: MenuCategory;
  badge?: string;
  baseBurgerId?: string;
  popular?: boolean;
  specialOfMonth?: boolean;
  special?: boolean;
}

export interface Topping {
  id: string;
  name: string;
  price: number;
  recommended?: boolean;
  image?: string;
}

export interface Upgrade {
  id: string;
  name: string;
  price: number;
}

// ===== UI-only overlays for menu items =====
interface MenuItemUIOverlay {
  description: string;
  weight?: string;
  badge?: string;
  baseBurgerId?: string;
  popular?: boolean;
  specialOfMonth?: boolean;
  special?: boolean;
}

const MENU_UI: Record<string, MenuItemUIOverlay> = {
  classic: { description: "בצל, עגבנייה, חסה, חמוצים ואיולי הבית", weight: "220 גרם" },
  "smash-moshavnikim": { description: "חמוצים, חסה, איולי הבית, שתי קציצות של 110 גרם מעוכות מרושלות וקריספיות", weight: "220 גרם" },
  avishai: { description: "חסה, עגבנייה, בצל, חמוצים, קציצת בקר, רצועות רוסטביף מעושן, ביצת עין ואיולי הבית", weight: "220 גרם", popular: true },
  double: { description: "שתי קציצות של 220, בצל, עגבנייה, חסה, חמוצים ואיולי הבית", weight: "440 גרם" },
  "crazy-smash": { description: "שתי קציצות סמאש, איולי, ריבת פלפלים חריפים, חמוצים ומייפל", weight: "220 גרם", badge: "🌶️" },
  "smash-double-cheese": { description: "חסה, חמוצים ואיולי הבית, שתי קציצות סמאש עם שתי פרוסות צ׳דר טבעוני (הולך טוב עם ריבת בצל או חמאת בוטנים)", weight: "220 גרם", badge: "🧀", popular: true },
  "special-hadegel": { description: "קציצת בקר, כל הירקות, איולי הבית, שתי טבעות בצל ביתיות, ריבת בצל ביין וקונפי שום", weight: "220 גרם" },
  napoleon: { description: "קציצת בקר 220, גבינה כחולה טבעונית, ריבת בצל ביין, חסה, עגבנייה, בצל, חמוצים", weight: "220 גרם", specialOfMonth: true },
  "crispy-chicken": { description: "חזה עוף בציפוי קריספי, חסה, עגבנייה, בצל, חמוצים ואיולי הבית", weight: "", special: true },
  "meal-crispy-chicken": { description: "קריספי צ׳יקן + צ׳יפס + שתייה", weight: "", baseBurgerId: "crispy-chicken", special: true },
  "haf-mifsha": { description: "המבורגר צמחוני - חסה, עגבנייה, בצל, חמוצים ואיולי (מבושל באיזור בשרי, אין הפרדה מוחלטת)", weight: "", badge: "🌱" },
  "meal-classic": { description: "קלאסי + צ׳יפס + שתייה", weight: "220 גרם", baseBurgerId: "classic" },
  "meal-smash-moshavnikim": { description: "סמאש של מושבניקים + צ׳יפס + שתייה", weight: "220 גרם", baseBurgerId: "smash-moshavnikim" },
  "meal-avishai": { description: "אבישי + צ׳יפס + שתייה", weight: "220 גרם", baseBurgerId: "avishai" },
  "meal-double": { description: "כפולה + צ׳יפס + שתייה", weight: "440 גרם", baseBurgerId: "double" },
  "meal-crazy-smash": { description: "קרייזי סמאש + צ׳יפס + שתייה", weight: "220 גרם", baseBurgerId: "crazy-smash", badge: "🌶️" },
  "meal-smash-double-cheese": { description: "סמאש דאבל צ׳יז + צ׳יפס + שתייה", weight: "220 גרם", baseBurgerId: "smash-double-cheese", badge: "🧀" },
  "meal-special-hadegel": { description: "ספיישל הדגל + צ׳יפס + שתייה", weight: "220 גרם", baseBurgerId: "special-hadegel" },
  "meal-napoleon": { description: "נפוליאון + צ׳יפס + שתייה", weight: "220 גרם", baseBurgerId: "napoleon", specialOfMonth: true },
  "meal-haf-mifsha": { description: "חף מפשע (צמחוני) + צ׳יפס + שתייה", weight: "", baseBurgerId: "haf-mifsha", badge: "🌱" },
  fries: { description: "" },
  "sweet-potato-fries": { description: "" },
  "onion-rings": { description: "" },

  "tempura-onion": { description: "טבעות בצל בטמפורה" },
  "friends-mix": { description: "ערימת צ׳יפסים: רגיל, טבעות בצל, וופל צ׳יפס" },
  "arayes-special": { description: "3 רבעי עראיס שמנים ועסיסיים בתוספת טחינה חוצפנית בצד" },
  "arayes-special-4": { description: "4 רבעי עראיס שמנים ועסיסיים בתוספת טחינה חוצפנית בצד" },
  can: { description: "קולה, זירו, פאנטה, ספרייט, בלו, מוחיטו, אבטיח, ד״י, מלון תפוח" },
  bottle: { description: "ענבים / תפוזים" },
  water: { description: "בקבוק מים מינרליים" },
  "flavored-water": { description: "מים בטעם תפוח / ענבים" },
  soda: { description: "בקבוק סודה" },
  "beer-regular": { description: "קלסטברג, גולדסטאר, הייניקן, קורונה, סטלה" },
  "beer-premium": { description: "הוגרדן, לאף, גולסטאר אנפילטר, פאולנר" },
  "beer-weiss": { description: "בירת חיטה גרמנית" },
  "beer-shapira": { description: "בירת קראפט ירושלמית — Pale Ale 5%" },
  "beer-maccabi": { description: "בירת לאגר חזקה 7.9%" },

  "family-deal": { description: "5 מנות קלאסיות (220), צ׳יפס ענק" },
  "friends-deal": { description: "3 מנות קלאסיות (220), +צ׳יפס ענק, +3 פחיות שתייה" },
};

export const menuItems: MenuItem[] = MENU_ITEMS_PRICING.map((m) => ({
  ...m,
  description: MENU_UI[m.id]?.description ?? "",
  weight: MENU_UI[m.id]?.weight,
  badge: MENU_UI[m.id]?.badge,
  baseBurgerId: MENU_UI[m.id]?.baseBurgerId,
  popular: MENU_UI[m.id]?.popular,
  specialOfMonth: MENU_UI[m.id]?.specialOfMonth,
  special: MENU_UI[m.id]?.special,
}));

export { MEAL_UPGRADE_PRICE };


export interface Removal {
  id: string;
  name: string;
}

export const removals: Removal[] = [
  { id: "no-changes", name: "ללא שינויים במנה" },
  { id: "no-lettuce", name: "בלי חסה" },
  { id: "no-tomato", name: "בלי עגבנייה" },
  { id: "no-pickles", name: "בלי חמוצים" },
  { id: "no-aioli", name: "בלי איולי" },
  { id: "dry", name: "יבש ללא ירקות ורטבים" },
];

export const smashModifications: Removal[] = [
  { id: "no-changes", name: "ללא שינויים במנה" },
  { id: "no-lettuce", name: "ללא חסה" },
  { id: "no-pickles", name: "ללא חמוצים" },
  { id: "no-aioli", name: "ללא איולי" },
  { id: "add-tomato", name: "להוסיף עגבנייה" },
  { id: "add-onion", name: "להוסיף בצל" },
];

/** Ingredient checklist model — replaces the old removal radio buttons.
 *  Each ingredient has a default ON/OFF state per burger type.
 *  The customer toggles ingredients on/off; we convert to removals/additions at submit. */
export interface Ingredient {
  id: string;
  name: string;
  /** Removal ID emitted when ingredient is turned OFF (e.g. "no-aioli") */
  removalId: string;
  /** Addition ID emitted when ingredient is turned ON from OFF default (smash extras) */
  addId?: string;
  /** Included by default in regular burgers */
  defaultRegular: boolean;
  /** Included by default in smash burgers */
  defaultSmash: boolean;
  /** Optional image asset key (imported in component) */
  image?: string;
}

export const ingredients: Ingredient[] = [
  { id: "aioli", name: "איולי הבית (במנה)", removalId: "no-aioli", defaultRegular: true, defaultSmash: true, image: "aioli-sauce" },
  { id: "lettuce", name: "🥬 חסה", removalId: "no-lettuce", defaultRegular: true, defaultSmash: true },
  { id: "onion", name: "בצל", removalId: "no-onion", addId: "add-onion", defaultRegular: true, defaultSmash: false, image: "onion" },
  { id: "tomato", name: "עגבנייה", removalId: "no-tomato", addId: "add-tomato", defaultRegular: true, defaultSmash: false, image: "tomato" },
  { id: "pickles", name: "חמוצים", removalId: "no-pickles", defaultRegular: true, defaultSmash: true, image: "pickles" },
];

/** Map removal/addition IDs to Hebrew display text for cart & receipt */
export const removalDisplayNames: Record<string, string> = {
  "no-aioli": "ללא איולי",
  "no-lettuce": "ללא חסה",
  "no-onion": "ללא בצל",
  "no-tomato": "ללא עגבנייה",
  "no-pickles": "ללא חמוצים",
  "add-onion": "להוסיף בצל",
  "add-tomato": "להוסיף עגבנייה",
  "dry": "יבש ללא ירקות ורטבים",
};

export const smashBurgerIds = ["smash-moshavnikim", "smash-double-cheese", "crazy-smash"];

export interface DonenessOption {
  id: string;
  label: string;
  shortLabel: string;
  recommended?: boolean;
  image?: string;
}

export const donenessOptions: DonenessOption[] = [
  { id: "doneness-m", label: "מדיום", shortLabel: "M", image: "doneness-medium" },
  { id: "doneness-mw", label: "מדיום וואל", shortLabel: "MW", recommended: true, image: "doneness-medium-well" },
  { id: "doneness-wd", label: "וואל דאן", shortLabel: "WD", image: "doneness-well-done" },
];

export const DEFAULT_DONENESS = "doneness-mw";

// ===== Toppings: pricing comes from shared file; UI overlay (image, recommended, display name with emoji) here =====
interface ToppingUIOverlay {
  displayName?: string; // overrides bare name (e.g. adds emoji)
  recommended?: boolean;
  image?: string;
}

const TOPPING_UI: Record<string, ToppingUIOverlay> = {
  "onion-jam": { recommended: true, image: "onion-jam" },
  "garlic-confit": { image: "garlic-confit" },
  roastbeef: { displayName: "רוסטביף 🥓" },
  egg: { displayName: "ביצת עין 🍳" },
  "vegan-cheddar": { image: "cheddar" },
  "vegan-blue-cheese": { image: "blue-cheese" },
  "hot-pepper-jam": { displayName: "ריבת פלפלים 🌶️" },
  "fried-onion": { image: "fried-onion" },
  "peanut-butter": { displayName: "חמאת בוטנים 🥜", recommended: true },
  maple: { image: "maple" },
  "extra-patty": { image: "extra-patty" },
  "extra-vegan-patty": { image: "extra-patty" },
  "extra-smash-patty": { image: "extra-patty" },
  "onion-rings-topping": { image: "onion-rings" },
  "gluten-free-bun": { displayName: "לחמנייה ללא גלוטן (מיוחדים) 🌾" },
};

export const toppings: Topping[] = TOPPINGS_PRICING_SHARED.map((t) => ({
  id: t.id,
  name: TOPPING_UI[t.id]?.displayName ?? t.name,
  price: t.price,
  recommended: TOPPING_UI[t.id]?.recommended,
  image: TOPPING_UI[t.id]?.image,
}));

/** Toppings to hide entirely from the customizer for specific burger items.
 *  Keyed by burger id (the meal variant inherits via baseBurgerId). */
export const excludedToppingsByItem: Record<string, string[]> = {
  "special-hadegel": ["onion-jam", "garlic-confit", "onion-rings-topping"],
  "avishai": ["egg"],
  "crazy-smash": ["maple", "hot-pepper-jam"],
  "napoleon": ["vegan-blue-cheese", "onion-jam"],
  "haf-mifsha": ["extra-patty"],
  "crispy-chicken": ["extra-patty", "extra-smash-patty", "extra-vegan-patty", "roastbeef"],
};

export const mealUpgrade = {
  name: "שדרוג לארוחה עסקית (המבורגר+צ׳יפס+שתייה)",
  price: MEAL_UPGRADE_PRICE,
};

export const mealSideOptions: Upgrade[] = MEAL_SIDES_PRICING.map((s) => ({ ...s }));

export interface DrinkOption {
  id: string;
  name: string;
  price: number;
  category: "soft" | "beer";
}

const BEER_SUFFIXES = ["goldstar", "heineken", "corona", "carlsberg", "laffe", "unfiltered", "paulaner", "hoegaarden", "weiss", "guinness", "stella", "shapira", "maccabi"];
const isBeerId = (id: string) => BEER_SUFFIXES.some((s) => id.endsWith(s));

export const mealDrinkOptions: DrinkOption[] = MEAL_DRINKS_PRICING.map((d) => ({
  ...d,
  category: isBeerId(d.id) ? "beer" : "soft",
}));

// Sub-options for standalone drink menu items
export interface DrinkSubOption {
  id: string;
  name: string;
}

export const drinkSubOptions: Record<string, DrinkSubOption[]> = {
  can: [
    { id: "can-cola", name: "קולה" },
    { id: "can-zero", name: "זירו" },
    { id: "can-fanta", name: "פאנטה" },
    { id: "can-fanta-grape", name: "פאנטה ענבים" },
    { id: "can-fanta-exotic", name: "פאנטה אקזוטי" },
    { id: "can-sprite", name: "ספרייט" },
    { id: "can-sprite-zero", name: "ספרייט זירו" },
    { id: "can-blu", name: "בלו רגיל" },
    { id: "can-mojito", name: "בלו מוחיטו" },
    { id: "can-watermelon", name: "בלו אבטיח" },
    { id: "can-day", name: "בלו דיי" },
    { id: "can-melon-apple", name: "בלו מלון תפוח" },

  ],

  bottle: [
    { id: "bottle-grapes", name: "ענבים" },
    { id: "bottle-apples", name: "תפוזים" },
  ],
  "flavored-water": [
    { id: "flavored-water-apple", name: "תפוח" },
    { id: "flavored-water-grape", name: "ענבים" },
  ],
  "beer-regular": [
    { id: "beer-carlsberg", name: "קלסטברג" },
    { id: "beer-goldstar", name: "גולדסטאר" },
    { id: "beer-heineken", name: "הייניקן" },
    { id: "beer-corona", name: "קורונה" },
    { id: "beer-stella", name: "סטלה" },
  ],
  "beer-premium": [
    { id: "beer-hoegaarden", name: "הוגרדן" },
    { id: "beer-laffe", name: "לאף" },
    { id: "beer-unfiltered", name: "גולדסטאר אנפילטר" },
    { id: "beer-paulaner", name: "פאולנר" },
    { id: "beer-guinness", name: "גינס" },
  ],
};

// Deal drinks (friends-deal "deal-*" + family-deal "fam-*"). Frontend uses only the deal-* prefix here.
export const dealDrinkOptions: DrinkOption[] = DEAL_DRINKS_PRICING
  .filter((d) => d.id.startsWith("deal-"))
  .map((d) => ({ ...d, category: isBeerId(d.id) ? "beer" : "soft" }));

export interface SauceOption {
  id: string;
  name: string;
  recommended?: boolean;
  /** Premium sauce with a fixed per-unit price. Not counted toward the free-sauce quota. */
  price?: number;
}

// Mapping from any drink option ID to canonical availability ID
export const drinkToAvailabilityId: Record<string, string> = {
  // can sub-options (DrinkSelector)
  "can-cola": "drink-cola", "can-zero": "drink-zero", "can-fanta": "drink-fanta",
  "can-fanta-grape": "drink-fanta-grape", "can-fanta-exotic": "drink-fanta-exotic",
  "can-sprite": "drink-sprite", "can-sprite-zero": "drink-sprite-zero", "can-blu": "drink-blu",
  "can-mojito": "drink-blu-mojito", "can-watermelon": "drink-watermelon", "can-day": "drink-blu-day",
  "can-melon-apple": "drink-blu-melon-apple",
  // bottle sub-options
  "bottle-grapes": "drink-grapes", "bottle-apples": "drink-apples",
  // flavored water sub-options (DrinkSelector)
  "flavored-water-apple": "drink-flavored-water-apple", "flavored-water-grape": "drink-flavored-water-grape",
  // beer sub-options
  "beer-carlsberg": "drink-carlsberg", "beer-goldstar": "drink-goldstar",
  "beer-heineken": "drink-heineken", "beer-corona": "drink-corona",
  "beer-hoegaarden": "drink-hoegaarden", "beer-laffe": "drink-laffe", "beer-unfiltered": "drink-unfiltered",
  "beer-paulaner": "drink-paulaner", "beer-stella": "drink-stella", "beer-guinness": "drink-guinness",
  // meal drink options (ItemCustomizer)
  "drink-cola": "drink-cola", "drink-zero": "drink-zero", "drink-fanta": "drink-fanta",
  "drink-fanta-grape": "drink-fanta-grape", "drink-fanta-exotic": "drink-fanta-exotic",
  "drink-sprite": "drink-sprite", "drink-sprite-zero": "drink-sprite-zero",
  "drink-blu": "drink-blu", "drink-blu-mojito": "drink-blu-mojito", "drink-blu-day": "drink-blu-day",
  "drink-blu-watermelon": "drink-watermelon", "drink-blu-melon-apple": "drink-blu-melon-apple",
  "drink-grapes": "drink-grapes", "drink-oranges": "drink-apples",

  "drink-goldstar": "drink-goldstar", "drink-heineken": "drink-heineken",
  "drink-corona": "drink-corona", "drink-carlsberg": "drink-carlsberg",
  "drink-laffe": "drink-laffe", "drink-unfiltered": "drink-unfiltered", "drink-guinness": "drink-guinness",
  "drink-weiss": "drink-weiss", "drink-paulaner": "drink-paulaner", "drink-hoegaarden": "drink-hoegaarden",
  "drink-stella": "drink-stella",
  "drink-shapira": "drink-shapira", "drink-maccabi": "drink-maccabi",

  "drink-water": "water", "drink-soda": "soda",
  "drink-flavored-water-apple": "drink-flavored-water-apple", "drink-flavored-water-grape": "drink-flavored-water-grape",
  // deal drink options (DealCustomizer)
  "deal-cola": "drink-cola", "deal-zero": "drink-zero", "deal-fanta": "drink-fanta",
  "deal-fanta-grape": "drink-fanta-grape", "deal-fanta-exotic": "drink-fanta-exotic",
  "deal-sprite": "drink-sprite", "deal-sprite-zero": "drink-sprite-zero",
  "deal-blu": "drink-blu", "deal-blu-mojito": "drink-blu-mojito", "deal-blu-day": "drink-blu-day",
  "deal-blu-watermelon": "drink-watermelon", "deal-blu-melon-apple": "drink-blu-melon-apple",

  "deal-grapes": "drink-grapes", "deal-oranges": "drink-grapes", "deal-flavored-water": "drink-flavored-water",
  "deal-flavored-water-apple": "drink-flavored-water-apple", "deal-flavored-water-grape": "drink-flavored-water-grape",
  "deal-water": "water", "deal-soda": "soda",
  "deal-goldstar": "drink-goldstar", "deal-heineken": "drink-heineken",
  "deal-corona": "drink-corona", "deal-carlsberg": "drink-carlsberg",
  "deal-laffe": "drink-laffe", "deal-unfiltered": "drink-unfiltered", "deal-guinness": "drink-guinness",
  "deal-shapira": "drink-shapira", "deal-maccabi": "drink-maccabi",
  // family deal drink options (FamilyDealCustomizer)
  "fam-cola": "drink-cola", "fam-zero": "drink-zero", "fam-fanta": "drink-fanta",
  "fam-sprite": "drink-sprite", "fam-blu": "drink-blu", "fam-blu-melon-apple": "drink-blu-melon-apple",
  "fam-grapes": "drink-grapes", "fam-apples": "drink-apples",
  "fam-flavored-water-apple": "drink-flavored-water-apple", "fam-flavored-water-grape": "drink-flavored-water-grape",
  "fam-water": "water", "fam-soda": "soda",
  "fam-goldstar": "drink-goldstar", "fam-heineken": "drink-heineken",
  "fam-corona": "drink-corona", "fam-carlsberg": "drink-carlsberg",
  "fam-laffe": "drink-laffe", "fam-unfiltered": "drink-unfiltered", "fam-guinness": "drink-guinness",
  "fam-shapira": "drink-shapira", "fam-maccabi": "drink-maccabi",
};


export const sauceOptions: SauceOption[] = [
  { id: "ketchup", name: "קטשופ" },
  { id: "mayo", name: "מיונז" },
  { id: "chili", name: "צ׳ילי חריף" },
  { id: "plum", name: "שזיפים", recommended: true },
  { id: "aioli-garlic-mint", name: "איולי שום נענע", price: 2 },
];
