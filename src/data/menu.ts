export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: "burger" | "side" | "drink";
}

export interface Topping {
  id: string;
  name: string;
  price: number;
}

export const menuItems: MenuItem[] = [
  {
    id: "classic",
    name: "קלאסי",
    description: "200 גרם בקר טרי, חסה, עגבנייה, בצל ומלפפון חמוץ",
    price: 52,
    image: "🍔",
    category: "burger",
  },
  {
    id: "cheese",
    name: "צ'יזבורגר",
    description: "200 גרם בקר, צ'דר מותך, חסה, עגבנייה ורוטב מיוחד",
    price: 58,
    image: "🧀",
    category: "burger",
  },
  {
    id: "double",
    name: "דאבל סמאש",
    description: "2 קציצות סמאש 150 גרם, גבינה אמריקאית, בצל מטוגן",
    price: 68,
    image: "🔥",
    category: "burger",
  },
  {
    id: "bbq",
    name: "BBQ ספיישל",
    description: "200 גרם בקר, בייקון, טבעות בצל, רוטב BBQ מעושן",
    price: 65,
    image: "🥓",
    category: "burger",
  },
  {
    id: "fries",
    name: "צ'יפס",
    description: "צ'יפס פריך עם תיבול מיוחד",
    price: 18,
    image: "🍟",
    category: "side",
  },
  {
    id: "onion-rings",
    name: "טבעות בצל",
    description: "טבעות בצל פריכות בציפוי זהוב",
    price: 22,
    image: "🧅",
    category: "side",
  },
  {
    id: "cola",
    name: "קולה",
    description: "330 מ\"ל",
    price: 12,
    image: "🥤",
    category: "drink",
  },
  {
    id: "lemonade",
    name: "לימונדה",
    description: "לימונדה טרייה בהכנה ביתית",
    price: 16,
    image: "🍋",
    category: "drink",
  },
];

export const toppings: Topping[] = [
  { id: "extra-cheese", name: "גבינה נוספת", price: 5 },
  { id: "jalapeno", name: "חלפיניו", price: 4 },
  { id: "mushrooms", name: "פטריות", price: 5 },
  { id: "egg", name: "ביצת עין", price: 6 },
  { id: "avocado", name: "אבוקדו", price: 7 },
  { id: "caramelized-onion", name: "בצל מקורמל", price: 4 },
];
