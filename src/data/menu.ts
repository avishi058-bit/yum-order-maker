export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  weight?: string;
  category: "burger" | "side" | "drink" | "deal" | "meal";
  badge?: string;
  baseBurgerId?: string;
  popular?: boolean;
}

export interface Topping {
  id: string;
  name: string;
  price: number;
  recommended?: boolean;
}

export interface Upgrade {
  id: string;
  name: string;
  price: number;
}

export const menuItems: MenuItem[] = [
  // המבורגרים
  {
    id: "classic",
    name: "קלאסי",
    description: "בצל, עגבנייה, חסה, חמוצים ואיולי הבית",
    price: 52,
    weight: "220 גרם",
    category: "burger",
  },
  {
    id: "smash-moshavnikim",
    name: "סמאש של מושבניקים",
    description: "חמוצים, חסה, איולי הבית, שתי קציצות של 110 גרם מעוכות מרוסלות וקריספיות",
    price: 58,
    weight: "220 גרם",
    category: "burger",
  },
  {
    id: "avishai",
    name: "אבישי שחוט לי פרה!",
    description: "חסה, עגבנייה, בצל, חמוצים, קציצת בקר, רצועות רוסטביף מעושן, ביצת עין ואיולי הבית",
    price: 78,
    weight: "220 גרם",
    category: "burger",
    popular: true,
  },
  {
    id: "double",
    name: "כפולה",
    description: "שתי קציצות של 220, בצל, עגבנייה, חסה, חמוצים ואיולי הבית",
    price: 76,
    weight: "440 גרם",
    category: "burger",
  },
  {
    id: "crazy-smash",
    name: "קרייזי סמאש",
    description: "שתי קציצות סמאש, איולי, ריבת פלפלים חריפים, חמוצים ומייפל",
    price: 64,
    weight: "220 גרם",
    category: "burger",
    badge: "🌶️",
  },
  {
    id: "smash-double-cheese",
    name: "סמאש דאבל צ׳יז",
    description: "חסה, חמוצים ואיולי הבית, שתי קציצות סמאש עם שתי פרוסות צ׳דר טבעוני (הולך טוב עם ריבת בצל או חמאת בוטנים)",
    price: 66,
    weight: "220 גרם",
    category: "burger",
    badge: "🧀",
    popular: true,
  },
  {
    id: "special-hadegel",
    name: "ספיישל הדגל",
    description: "קציצת בקר, כל הירקות, איולי הבית, שתי טבעות בצל ביתיות, ריבת בצל ביין וקונפי שום",
    price: 73,
    weight: "220 גרם",
    category: "burger",
  },
  {
    id: "haf-mifsha",
    name: "חף מפשע",
    description: "המבורגר צמחוני - חסה, עגבנייה, בצל, חמוצים ואיולי (מבושל באיזור בשרי, אין הפרדה מוחלטת)",
    price: 55,
    weight: "",
    category: "burger",
    badge: "🌱",
  },
  // ארוחות עסקיות
  {
    id: "meal-classic",
    name: "ארוחת קלאסי",
    description: "קלאסי + צ׳יפס + שתייה",
    price: 75,
    weight: "220 גרם",
    category: "meal",
    baseBurgerId: "classic",
  },
  {
    id: "meal-smash-moshavnikim",
    name: "ארוחת סמאש של מושבניקים",
    description: "סמאש של מושבניקים + צ׳יפס + שתייה",
    price: 81,
    weight: "220 גרם",
    category: "meal",
    baseBurgerId: "smash-moshavnikim",
  },
  {
    id: "meal-avishai",
    name: "ארוחת אבישי שחוט לי פרה!",
    description: "אבישי + צ׳יפס + שתייה",
    price: 101,
    weight: "220 גרם",
    category: "meal",
    baseBurgerId: "avishai",
  },
  {
    id: "meal-double",
    name: "ארוחת כפולה",
    description: "כפולה + צ׳יפס + שתייה",
    price: 99,
    weight: "440 גרם",
    category: "meal",
    baseBurgerId: "double",
  },
  {
    id: "meal-crazy-smash",
    name: "ארוחת קרייזי סמאש",
    description: "קרייזי סמאש + צ׳יפס + שתייה",
    price: 87,
    weight: "220 גרם",
    category: "meal",
    baseBurgerId: "crazy-smash",
    badge: "🌶️",
  },
  {
    id: "meal-smash-double-cheese",
    name: "ארוחת סמאש דאבל צ׳יז",
    description: "סמאש דאבל צ׳יז + צ׳יפס + שתייה",
    price: 89,
    weight: "220 גרם",
    category: "meal",
    baseBurgerId: "smash-double-cheese",
    badge: "🧀",
  },
  {
    id: "meal-special-hadegel",
    name: "ארוחת ספיישל הדגל",
    description: "ספיישל הדגל + צ׳יפס + שתייה",
    price: 96,
    weight: "220 גרם",
    category: "meal",
    baseBurgerId: "special-hadegel",
  },
  {
    id: "meal-haf-mifsha",
    name: "ארוחת חף מפשע",
    description: "חף מפשע (צמחוני) + צ׳יפס + שתייה",
    price: 78,
    weight: "",
    category: "meal",
    baseBurgerId: "haf-mifsha",
    badge: "🌱",
  },
  // צ׳יפס
  {
    id: "fries",
    name: "צ׳יפס",
    description: "צ׳יפס פריך",
    price: 20,
    category: "side",
  },
  {
    id: "waffle-fries",
    name: "וופל צ׳יפס",
    description: "צ׳יפס וופל פריך",
    price: 25,
    category: "side",
  },
  {
    id: "onion-rings",
    name: "טבעות בצל",
    description: "טבעות בצל מטוגנות",
    price: 24,
    category: "side",
  },
  {
    id: "tempura-onion",
    name: "טבעות בצל ביתיות בטמפורה",
    description: "טבעות בצל ביתיות בציפוי טמפורה",
    price: 32,
    category: "side",
  },
  // שתייה
  {
    id: "can",
    name: "פחית",
    description: "קולה, זירו, פאנטה, ספרייט, בלו, הגל, מוחיטו, אבטיח, ד״י",
    price: 10,
    category: "drink",
  },
  {
    id: "bottle",
    name: "בקבוק",
    description: "ענבים / תפוחים",
    price: 12,
    category: "drink",
  },
  {
    id: "beer-regular",
    name: "בירה",
    description: "קלסטברג, גולדסטאר, הייניקן, קורונה",
    price: 18,
    category: "drink",
  },
  {
    id: "beer-premium",
    name: "בירה פרימיום",
    description: "הוגרדן, לאף, גולסטאר אנפילטר",
    price: 23,
    category: "drink",
  },
  {
    id: "beer-weiss",
    name: "ויינשטפאן (חצי)",
    description: "בירת חיטה גרמנית",
    price: 25,
    category: "drink",
  },
  // דילים
  {
    id: "family-deal",
    name: "דיל משפחתי",
    description: "5 מנות קלאסיות (220), צ׳יפס ענק",
    price: 300,
    category: "deal",
  },
  {
    id: "friends-deal",
    name: "דיל חברים",
    description: "3 מנות קלאסיות (220), +צ׳יפס ענק, +3 פחיות שתייה",
    price: 216,
    category: "deal",
  },
  {
    id: "friends-mix",
    name: "מיקס חברים",
    description: "ערימת צ׳יפסים: רגיל, טבעות בצל, וופל צ׳יפס",
    price: 59,
    category: "side",
  },
];

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

export const smashBurgerIds = ["smash-moshavnikim", "smash-double-cheese", "crazy-smash"];

export const toppings: Topping[] = [
  { id: "onion-jam", name: "ריבת בצל של סבתא דינה", price: 9, recommended: true },
  { id: "peanut-butter", name: "חמאת בוטנים", price: 8, recommended: true },
  { id: "fried-onion", name: "בצל מטוגן", price: 7 },
  { id: "garlic-confit", name: "קונפי שום", price: 7 },
  { id: "egg", name: "ביצת עין", price: 8 },
  { id: "vegan-cheddar", name: "צ׳דר טבעוני", price: 7 },
  { id: "roastbeef", name: "רצועות רוסטביף", price: 20 },
  { id: "extra-patty", name: "אקסטרה קציצה (220 גרם)", price: 25 },
  { id: "hot-pepper-jam", name: "ריבת פלפלים חריפים", price: 9 },
  { id: "onion-rings-topping", name: "שלוש טבעות בצל ביתיות", price: 8 },
  { id: "maple", name: "מייפל", price: 5 },
];

export const mealUpgrade = {
  name: "שדרוג לארוחה עסקית (המבורגר+צ׳יפס+שתייה)",
  price: 23,
};

export const mealSideOptions: Upgrade[] = [
  { id: "side-fries", name: "צ׳יפס רגיל", price: 0 },
  { id: "side-waffle", name: "וופל צ׳יפס", price: 5 },
  { id: "side-onion-rings", name: "טבעות בצל", price: 4 },
  { id: "side-tempura", name: "טבעות בצל ביתיות בטמפורה", price: 13 },
];

export interface DrinkOption {
  id: string;
  name: string;
  price: number;
  category: "soft" | "beer";
}

export const mealDrinkOptions: DrinkOption[] = [
  { id: "drink-cola", name: "קולה", price: 0, category: "soft" },
  { id: "drink-zero", name: "זירו", price: 0, category: "soft" },
  { id: "drink-fanta", name: "פאנטה", price: 0, category: "soft" },
  { id: "drink-fanta-grape", name: "פאנטה ענבים", price: 0, category: "soft" },
  { id: "drink-fanta-exotic", name: "פאנטה אקזוטי", price: 0, category: "soft" },
  { id: "drink-sprite", name: "ספרייט", price: 0, category: "soft" },
  { id: "drink-sprite-zero", name: "ספרייט זירו", price: 0, category: "soft" },
  { id: "drink-blu", name: "בלו", price: 0, category: "soft" },
  { id: "drink-blu-mojito", name: "בלו מוחיטו", price: 0, category: "soft" },
  { id: "drink-blu-day", name: "בלו דיי", price: 0, category: "soft" },
  { id: "drink-goldstar", name: "גולדסטאר", price: 8, category: "beer" },
  { id: "drink-heineken", name: "הייניקן", price: 8, category: "beer" },
  { id: "drink-corona", name: "קורונה", price: 8, category: "beer" },
  { id: "drink-carlsberg", name: "קאלסברג", price: 8, category: "beer" },
  { id: "drink-laffe", name: "לאפ בראון", price: 12, category: "beer" },
  { id: "drink-unfiltered", name: "גולדסטאר אנפילטר", price: 12, category: "beer" },
  { id: "drink-guinness", name: "גינס", price: 12, category: "beer" },
];

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
    { id: "can-sprite", name: "ספרייט" },
    { id: "can-blu", name: "בלו" },
    { id: "can-wave", name: "הגל" },
    { id: "can-mojito", name: "מוחיטו" },
    { id: "can-watermelon", name: "אבטיח" },
    { id: "can-day", name: "ד׳י" },
  ],
  bottle: [
    { id: "bottle-grapes", name: "ענבים" },
    { id: "bottle-apples", name: "תפוחים" },
  ],
  "beer-regular": [
    { id: "beer-carlsberg", name: "קלסטברג" },
    { id: "beer-goldstar", name: "גולדסטאר" },
    { id: "beer-heineken", name: "הייניקן" },
    { id: "beer-corona", name: "קורונה" },
  ],
  "beer-premium": [
    { id: "beer-hoegaarden", name: "הוגרדן" },
    { id: "beer-laffe", name: "לאף" },
    { id: "beer-unfiltered", name: "גולדסטאר אנפילטר" },
  ],
};

export const dealDrinkOptions: DrinkOption[] = [
  { id: "deal-cola", name: "קולה", price: 0, category: "soft" },
  { id: "deal-zero", name: "זירו", price: 0, category: "soft" },
  { id: "deal-fanta", name: "פאנטה", price: 0, category: "soft" },
  { id: "deal-fanta-grape", name: "פאנטה ענבים", price: 0, category: "soft" },
  { id: "deal-fanta-exotic", name: "פאנטה אקזוטי", price: 0, category: "soft" },
  { id: "deal-sprite", name: "ספרייט", price: 0, category: "soft" },
  { id: "deal-sprite-zero", name: "ספרייט זירו", price: 0, category: "soft" },
  { id: "deal-blu", name: "בלו", price: 0, category: "soft" },
  { id: "deal-blu-mojito", name: "בלו מוחיטו", price: 0, category: "soft" },
  { id: "deal-blu-day", name: "בלו דיי", price: 0, category: "soft" },
  { id: "deal-grapes", name: "ענבים (בקבוק)", price: 2, category: "soft" },
  { id: "deal-oranges", name: "תפוזים (בקבוק)", price: 2, category: "soft" },
  { id: "deal-flavored-water", name: "מים בטעמים (בקבוק)", price: 2, category: "soft" },
  { id: "deal-goldstar", name: "גולדסטאר", price: 8, category: "beer" },
  { id: "deal-heineken", name: "הייניקן", price: 8, category: "beer" },
  { id: "deal-corona", name: "קורונה", price: 8, category: "beer" },
  { id: "deal-carlsberg", name: "קאלסברג", price: 8, category: "beer" },
  { id: "deal-laffe", name: "לאפ בראון", price: 12, category: "beer" },
  { id: "deal-unfiltered", name: "גולדסטאר אנפילטר", price: 12, category: "beer" },
  { id: "deal-guinness", name: "גינס", price: 12, category: "beer" },
];

export interface SauceOption {
  id: string;
  name: string;
  recommended?: boolean;
}

export const sauceOptions: SauceOption[] = [
  { id: "ketchup", name: "קטשופ" },
  { id: "mayo", name: "מיונז" },
  { id: "chili", name: "צ׳ילי חריף" },
  { id: "plum", name: "שזיפים", recommended: true },
];
