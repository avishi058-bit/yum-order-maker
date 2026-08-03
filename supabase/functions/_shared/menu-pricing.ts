// SINGLE SOURCE OF TRUTH for menu pricing.
// This file is imported by BOTH the frontend (src/data/menu.ts) and the
// create-order edge function. When you add/remove an item, topping, side,
// or drink option — edit this file ONLY.
//
// UI-only metadata (descriptions, images, badges, weights, etc.) lives
// in src/data/menu.ts and is merged on top of these bare records.

export type MenuCategory = "burger" | "side" | "drink" | "deal" | "meal";

export interface MenuItemPricing {
  id: string;
  name: string;
  price: number;
  category: MenuCategory;
}

export interface PricedOption {
  id: string;
  name: string;
  price: number;
}

// ===== Menu items =====
export const MENU_ITEMS_PRICING: MenuItemPricing[] = [
  // Burgers
  { id: "classic", name: "קלאסי", price: 52, category: "burger" },
  { id: "smash-moshavnikim", name: "סמאש של מושבניקים", price: 58, category: "burger" },
  { id: "avishai", name: "אבישי שחוט לי פרה!", price: 78, category: "burger" },
  { id: "double", name: "כפולה", price: 76, category: "burger" },
  { id: "crazy-smash", name: "קרייזי סמאש", price: 64, category: "burger" },
  { id: "smash-double-cheese", name: "סמאש דאבל צ׳יז", price: 66, category: "burger" },
  { id: "special-hadegel", name: "ספיישל הדגל", price: 73, category: "burger" },
  { id: "napoleon", name: "נפוליאון", price: 78, category: "burger" },
  { id: "haf-mifsha", name: "חף מפשע", price: 55, category: "burger" },
  { id: "crispy-chicken", name: "קריספי צ׳יקן", price: 58, category: "burger" },
  // Meals
  { id: "meal-classic", name: "ארוחת קלאסי", price: 75, category: "meal" },
  { id: "meal-smash-moshavnikim", name: "ארוחת סמאש של מושבניקים", price: 81, category: "meal" },
  { id: "meal-avishai", name: "ארוחת אבישי שחוט לי פרה!", price: 101, category: "meal" },
  { id: "meal-double", name: "ארוחת כפולה", price: 99, category: "meal" },
  { id: "meal-crazy-smash", name: "ארוחת קרייזי סמאש", price: 87, category: "meal" },
  { id: "meal-smash-double-cheese", name: "ארוחת סמאש דאבל צ׳יז", price: 89, category: "meal" },
  { id: "meal-special-hadegel", name: "ארוחת ספיישל הדגל", price: 96, category: "meal" },
  { id: "meal-napoleon", name: "ארוחת נפוליאון", price: 101, category: "meal" },
  { id: "meal-haf-mifsha", name: "ארוחת חף מפשע", price: 78, category: "meal" },
  { id: "meal-crispy-chicken", name: "ארוחת קריספי צ׳יקן", price: 81, category: "meal" },
  // Sides
  { id: "fries", name: "צ׳יפס", price: 20, category: "side" },
  { id: "sweet-potato-fries", name: "וופל צ׳יפס", price: 25, category: "side" },
  { id: "onion-rings", name: "טבעות בצל", price: 24, category: "side" },
  { id: "tempura-onion", name: "טבעות בצל בטמפורה", price: 32, category: "side" },
  { id: "friends-mix", name: "מיקס חברים", price: 59, category: "side" },
  { id: "arayes-special", name: "ספיישל עראיס הבית", price: 44, category: "side" },
  { id: "arayes-special-4", name: "ספיישל עראיס הבית (4 רבעים)", price: 59, category: "side" },
  // Drinks
  { id: "can", name: "פחית", price: 10, category: "drink" },
  { id: "bottle", name: "בקבוק", price: 12, category: "drink" },
  { id: "water", name: "מים (בקבוק)", price: 10, category: "drink" },
  { id: "flavored-water", name: "מים בטעמים", price: 12, category: "drink" },
  { id: "soda", name: "סודה (בקבוק)", price: 10, category: "drink" },
  { id: "beer-regular", name: "בירה", price: 18, category: "drink" },
  { id: "beer-premium", name: "בירה פרימיום", price: 23, category: "drink" },
  { id: "beer-weiss", name: "ויינשטפאן (חצי)", price: 25, category: "drink" },
  { id: "beer-shapira", name: "בירת שפירא", price: 25, category: "drink" },
  { id: "beer-maccabi", name: "בירה מכבי 7.9%", price: 20, category: "drink" },

  // Deals
  { id: "family-deal", name: "דיל משפחתי", price: 300, category: "deal" },
  { id: "friends-deal", name: "דיל חברים", price: 216, category: "deal" },
];

// ===== Toppings (paid burger add-ons) =====
export const TOPPINGS_PRICING: PricedOption[] = [
  { id: "onion-jam", name: "ריבת בצל של סבתא דינה", price: 8 },
  { id: "garlic-confit", name: "קונפי שום", price: 7 },
  { id: "roastbeef", name: "רצועות רוסטביף", price: 20 },
  { id: "egg", name: "ביצת עין", price: 8 },
  { id: "vegan-cheddar", name: "צ׳דר טבעוני", price: 7 },
  { id: "vegan-blue-cheese", name: "גבינה כחולה טבעונית", price: 15 },
  { id: "hot-pepper-jam", name: "ריבת פלפלים", price: 8 },
  { id: "fried-onion", name: "בצל מטוגן", price: 7 },
  { id: "crispy-onion-chips", name: "שבבי בצל קריספי", price: 4 },
  { id: "peanut-butter", name: "חמאת בוטנים", price: 8 },
  { id: "maple", name: "סירופ בטעם מייפל", price: 5 },
  { id: "extra-patty", name: "תוספת קציצה", price: 25 },
  { id: "extra-vegan-patty", name: "תוספת קציצה צמחונית", price: 28 },
  { id: "extra-smash-patty", name: "+ קציצת סמאש", price: 29 },
  { id: "onion-rings-topping", name: "שלוש טבעות בצל ביתיות", price: 8 },
  { id: "gluten-free-bun", name: "לחמנייה ללא גלוטן (מיוחדים)", price: 4 },
  { id: "arayes-extra-quarter", name: "רבע עראיס נוסף", price: 15 },
  { id: "lotus-spread", name: "ממרח לוטוס", price: 6 },
];

// ===== Meal upgrade =====
export const MEAL_UPGRADE_PRICE = 23;

// ===== Meal sides (chosen with meal upgrade or full meal) =====
export const MEAL_SIDES_PRICING: PricedOption[] = [
  { id: "side-fries", name: "צ׳יפס רגיל", price: 0 },
  { id: "side-sweet-potato", name: "וופל צ׳יפס", price: 5 },
  { id: "side-onion-rings", name: "טבעות בצל", price: 4 },
  { id: "side-tempura", name: "טבעות בצל בטמפורה", price: 13 },
];

// ===== Meal drinks =====
export const MEAL_DRINKS_PRICING: PricedOption[] = [
  { id: "drink-cola", name: "קולה", price: 0 },
  { id: "drink-zero", name: "זירו", price: 0 },
  { id: "drink-fanta", name: "פאנטה", price: 0 },
  { id: "drink-fanta-grape", name: "פאנטה ענבים", price: 0 },
  { id: "drink-fanta-exotic", name: "פאנטה אקזוטי", price: 0 },
  { id: "drink-sprite", name: "ספרייט", price: 0 },
  { id: "drink-sprite-zero", name: "ספרייט זירו", price: 0 },
  { id: "drink-blu", name: "בלו", price: 0 },
  { id: "drink-blu-mojito", name: "בלו מוחיטו", price: 0 },
  { id: "drink-blu-day", name: "בלו דיי", price: 0 },
  { id: "drink-blu-watermelon", name: "בלו אבטיח", price: 0 },
  { id: "drink-blu-melon-apple", name: "בלו מלון תפוח", price: 0 },
  { id: "drink-grapes", name: "ענבים (בקבוק)", price: 0 },
  { id: "drink-oranges", name: "תפוזים (בקבוק)", price: 0 },

  { id: "drink-goldstar", name: "גולדסטאר", price: 8 },
  { id: "drink-heineken", name: "הייניקן", price: 8 },
  { id: "drink-corona", name: "קורונה", price: 8 },
  { id: "drink-carlsberg", name: "קאלסברג", price: 8 },
  { id: "drink-laffe", name: "לאפ בראון", price: 12 },
  { id: "drink-unfiltered", name: "גולדסטאר אנפילטר", price: 12 },
  { id: "drink-paulaner", name: "פאולנר", price: 12 },
  { id: "drink-stella", name: "סטלה", price: 8 },
  { id: "drink-hoegaarden", name: "הוגרדן", price: 12 },
  { id: "drink-weiss", name: "ויינשטפאן (חצי)", price: 15 },
  { id: "drink-shapira", name: "שפירא", price: 15 },
  { id: "drink-maccabi", name: "מכבי 7.9%", price: 10 },
  { id: "drink-guinness", name: "גינס", price: 12 },
  { id: "drink-water", name: "מים (בקבוק)", price: 0 },
  { id: "drink-flavored-water-apple", name: "מים בטעם תפוח", price: 0 },
  { id: "drink-flavored-water-grape", name: "מים בטעם ענבים", price: 0 },
  { id: "drink-soda", name: "סודה (בקבוק)", price: 0 },
];


// ===== Deal drinks (friends deal + family deal) =====
export const DEAL_DRINKS_PRICING: PricedOption[] = [
  { id: "deal-cola", name: "קולה", price: 0 },
  { id: "deal-zero", name: "זירו", price: 0 },
  { id: "deal-fanta", name: "פאנטה", price: 0 },
  { id: "deal-fanta-grape", name: "פאנטה ענבים", price: 0 },
  { id: "deal-fanta-exotic", name: "פאנטה אקזוטי", price: 0 },
  { id: "deal-sprite", name: "ספרייט", price: 0 },
  { id: "deal-sprite-zero", name: "ספרייט זירו", price: 0 },
  { id: "deal-blu", name: "בלו", price: 0 },
  { id: "deal-blu-mojito", name: "בלו מוחיטו", price: 0 },
  { id: "deal-blu-day", name: "בלו דיי", price: 0 },
  { id: "deal-blu-watermelon", name: "בלו אבטיח", price: 0 },
  { id: "deal-blu-melon-apple", name: "בלו מלון תפוח", price: 0 },

  { id: "deal-grapes", name: "ענבים (בקבוק)", price: 2 },
  { id: "deal-oranges", name: "תפוזים (בקבוק)", price: 2 },
  { id: "deal-flavored-water", name: "מים בטעמים (בקבוק)", price: 2 },
  { id: "deal-flavored-water-apple", name: "מים בטעם תפוח", price: 0 },
  { id: "deal-flavored-water-grape", name: "מים בטעם ענבים", price: 0 },
  { id: "deal-goldstar", name: "גולדסטאר", price: 8 },
  { id: "deal-heineken", name: "הייניקן", price: 8 },
  { id: "deal-corona", name: "קורונה", price: 8 },
  { id: "deal-carlsberg", name: "קאלסברג", price: 8 },
  { id: "deal-laffe", name: "לאפ בראון", price: 12 },
  { id: "deal-unfiltered", name: "גולדסטאר אנפילטר", price: 12 },
  { id: "deal-guinness", name: "גינס", price: 12 },
  { id: "deal-shapira", name: "שפירא", price: 15 },
  { id: "deal-maccabi", name: "מכבי 7.9%", price: 10 },
  { id: "deal-water", name: "מים (בקבוק)", price: 0 },
  { id: "deal-soda", name: "סודה (בקבוק)", price: 0 },
  { id: "fam-cola", name: "קולה", price: 0 },
  { id: "fam-zero", name: "זירו", price: 0 },
  { id: "fam-fanta", name: "פאנטה", price: 0 },
  { id: "fam-sprite", name: "ספרייט", price: 0 },
  { id: "fam-blu", name: "בלו", price: 0 },
  { id: "fam-blu-melon-apple", name: "בלו מלון תפוח", price: 0 },
  { id: "fam-grapes", name: "ענבים", price: 0 },
  { id: "fam-apples", name: "תפוזים", price: 0 },
  { id: "fam-water", name: "מים (בקבוק)", price: 0 },
  { id: "fam-flavored-water-apple", name: "מים בטעם תפוח", price: 0 },
  { id: "fam-flavored-water-grape", name: "מים בטעם ענבים", price: 0 },
  { id: "fam-soda", name: "סודה (בקבוק)", price: 0 },
  { id: "fam-goldstar", name: "גולדסטאר", price: 8 },
  { id: "fam-heineken", name: "הייניקן", price: 8 },
  { id: "fam-corona", name: "קורונה", price: 8 },
  { id: "fam-carlsberg", name: "קאלסברג", price: 8 },
  { id: "fam-laffe", name: "לאפ בראון", price: 12 },
  { id: "fam-unfiltered", name: "גולדסטאר אנפילטר", price: 12 },
  { id: "fam-guinness", name: "גינס", price: 12 },
  { id: "fam-shapira", name: "שפירא", price: 15 },
  { id: "fam-maccabi", name: "מכבי 7.9%", price: 10 },
];


// ===== Lookup map helpers =====
export const toLookup = <T extends { id: string }>(arr: T[]): Record<string, T> =>
  Object.fromEntries(arr.map((x) => [x.id, x]));
