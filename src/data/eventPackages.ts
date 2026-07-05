export interface EventAddon {
  id: string;
  name: string;
  pricePerPerson: number;
  emoji?: string;
  /** partial addon: applies only to selected portion of guests (e.g., vegan / gluten-free) */
  partial?: boolean;
}

export interface EventPackage {
  id: string;
  name: string;
  emoji: string;
  pricePerPerson: number;
  description: string;
  items: string[];
  highlight?: boolean;
}

export const EVENT_PACKAGES: EventPackage[] = [
  {
    id: "classic",
    name: "המסלול הקלאסי",
    emoji: "🍔",
    pricePerPerson: 69,
    description: "המבורגר עסיסי, צ׳יפס קלאסי, ירקות ורטבים",
    items: [
      "המבורגר 220 גרם",
      "צ׳יפס קלאסי 🍟",
      "ירקות טריים: חסה, עגבנייה, בצל, חמוצים",
      "רטבים בסקוויזרים",
    ],
  },
  {
    id: "upgraded",
    name: "המסלול המשודרג",
    emoji: "🎉",
    pricePerPerson: 82,
    description: "שדרוג עם מטוגנים ושתייה קרה",
    items: [
      "המבורגר 220 גרם",
      "צ׳יפס, טבעות בצל, וופל צ׳יפס 🧇",
      "פחית שתייה קרה לבחירה 🥤",
      "כד מים קרים עם קרח ❄️",
      "ירקות טריים + רטבים",
    ],
  },
  {
    id: "premium",
    name: "המסלול המפנק",
    emoji: "🤤",
    pricePerPerson: 109,
    description: "חוויה עשירה עם תוספות שולחן וקינוח",
    items: [
      "המבורגר 220 גרם",
      "שילוב מטוגנים עשיר",
      "פחית + כד מים קרים 🥤❄️",
      "תוספות שולחן: בצל מטוגן, ריבת בצל, פלפלים, שום קונפי",
      "קינוח: סלט פירות עונתיים 🍉",
    ],
    highlight: true,
  },
  {
    id: "all-inclusive",
    name: "הכל כלול",
    emoji: "💎",
    pricePerPerson: 139,
    description: "חוויית פרימיום מושלמת ובלתי נשכחת",
    items: [
      "המבורגר 220 גרם",
      "פתיחה: סוכריות עראיס על טחינה 🫓",
      "שילוב מטוגנים מלא",
      "שתייה חופשית 🥤❄️",
      "תוספות שולחן: ביצת עין, בצל מטוגן, ריבת בצל, פלפלים, שום קונפי",
      "קינוח: סלט פירות עונתיים",
    ],
  },
  {
    id: "meat-bar",
    name: "מסלול הבשרים",
    emoji: "🥩",
    pricePerPerson: 250,
    description: "בישול על מנגל פחמים במקום – ~½ ק״ג בשר לאדם",
    items: [
      "אנטריקוט, פיקניה, חצאי עראיס",
      "קבבים במתכון אישי, לבבות עוף, פרגית",
      "צ׳יפס, וופל צ׳יפס, טבעות בצל",
      "צ׳ימיצ׳ורי, קונפי שום, פלפלים חריפים",
      "סלטים: כרוב לבן, ערבי",
      "שתייה מתוקה + כד מים קרים",
    ],
  },
];

export const EVENT_ADDONS: EventAddon[] = [
  { id: "unlimited-drinks", name: "שתייה קלה ללא הגבלה", pricePerPerson: 9, emoji: "🥤" },
  { id: "roastbeef", name: "רצועות רוסטביף", pricePerPerson: 18, emoji: "🥓" },
  { id: "tempura-onion", name: "שדרוג טבעות בצל בטמפורה", pricePerPerson: 5, emoji: "🧅" },
  { id: "vegan", name: "המבורגר צמחוני/טבעוני (חלקי)", pricePerPerson: 4, emoji: "🌱", partial: true },
  { id: "gluten-free", name: "לחמנייה ללא גלוטן (חלקי)", pricePerPerson: 4, emoji: "🌾", partial: true },
];

export const EVENT_TYPES = [
  { value: "wedding", label: "חתונה" },
  { value: "bar-mitzvah", label: "בר/בת מצווה" },
  { value: "birthday", label: "יום הולדת" },
  { value: "conference", label: "כנס / אירוע חברה" },
  { value: "brit", label: "ברית / בריתה" },
  { value: "other", label: "אחר" },
];

/** מסלולים שכוללים שתייה במחיר. במסלול הקלאסי אין שתייה. */
export const PACKAGES_WITH_DRINKS = new Set(["upgraded", "premium", "all-inclusive", "meat-bar"]);

export interface DrinkOption {
  id: string;
  name: string;
  emoji?: string;
}

/** רשימת השתייה שהלקוח בוחר ממנה באירועי חוץ. */
export const EVENT_DRINK_OPTIONS: DrinkOption[] = [
  { id: "cola", name: "קוקה קולה", emoji: "🥤" },
  { id: "cola-zero", name: "קולה זירו", emoji: "🥤" },
  { id: "sprite", name: "ספרייט", emoji: "🥤" },
  { id: "fanta", name: "פאנטה", emoji: "🍊" },
  { id: "grape-juice", name: "מיץ ענבים", emoji: "🍇" },
  { id: "orange-juice", name: "מיץ תפוזים", emoji: "🍊" },
  { id: "flavored-water-apple", name: "מים בטעם תפוח", emoji: "🍏" },
  { id: "flavored-water-grape", name: "מים בטעם ענבים", emoji: "🍇" },
  { id: "soda", name: "סודה", emoji: "💧" },
  { id: "water", name: "מים מינרליים", emoji: "💧" },
];
