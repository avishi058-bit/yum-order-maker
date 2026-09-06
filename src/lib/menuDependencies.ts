/**
 * מיפוי תלויות בין מנות למרכיבים שלהן.
 * אם אחד מהמרכיבים אזל - המנה תכובה אוטומטית.
 * אם כל המרכיבים זמינים - המנה תוחזר אוטומטית, אלא אם המנהל כיבה אותה ידנית (manually_disabled).
 *
 * המפתח = ID של המנה (גם המבורגר וגם הארוחה המקבילה אם קיימת).
 * הערך = רשימת ה-item_ids של המרכיבים החיוניים.
 */
export const MENU_DEPENDENCIES: Record<string, string[]> = {
  // ספיישל הדגל - דורש טבעות בצל בטמפורה, קונפי שום וריבת בצל
  "special-hadegel": ["tempura-onion", "garlic-confit", "onion-jam"],
  "meal-special-hadegel": ["tempura-onion", "garlic-confit", "onion-jam"],

  // טבעות בצל בטמפורה - דורש טבעות בצל רגילות (אם אין טבעות בצל, אין גם טמפורה)
  "tempura-onion": ["onion-rings"],

  // טופינג שלוש טבעות בצל ביתיות - דורש טבעות בצל בטמפורה
  "onion-rings-topping": ["tempura-onion"],

  // מיקס חברים - צ'יפס רגיל, טבעות בצל רגילות, וופל ציפס
  "friends-mix": ["fries", "onion-rings", "sweet-potato-fries"],

  // סמאש דאבל ציז - דורש צ'דר טבעוני + קציצת סמאש
  "smash-double-cheese": ["vegan-cheddar", "smash-patty"],
  "meal-smash-double-cheese": ["vegan-cheddar", "smash-patty"],

  // סמאש של מושבניקים - דורש קציצת סמאש
  "smash-moshavnikim": ["smash-patty"],
  "meal-smash-moshavnikim": ["smash-patty"],

  // אבישי שחוט לי פרה - דורש רוסטביף וביצת עין
  avishai: ["roastbeef", "egg"],
  "meal-avishai": ["roastbeef", "egg"],

  // דילים משפחתי וחברים - דורשים צ'יפס רגיל
  "family-deal": ["fries"],
  "friends-deal": ["fries"],

  // קרייזי סמאש - דורש ריבת פלפלים חריפים, מייפל וקציצת סמאש
  "crazy-smash": ["hot-pepper-jam", "maple", "smash-patty"],
  "meal-crazy-smash": ["hot-pepper-jam", "maple", "smash-patty"],
};

/**
 * תלויות מסוג "לפחות אחד מהם" - המנה תכובה רק אם כל האפשרויות אזלו.
 * ארוחה עסקית חייבת סוג צ'יפס אחד לפחות.
 */
const MEAL_IDS = [
  "meal-classic",
  "meal-double",
  "meal-crispy-chicken",
  "meal-haf-mifsha",
  "meal-napoleon",
  "meal-avishai",
  "meal-special-hadegel",
  "meal-crazy-smash",
  "meal-smash-double-cheese",
  "meal-smash-moshavnikim",
];

export const MENU_ANY_DEPENDENCIES: Record<string, string[]> = Object.fromEntries(
  MEAL_IDS.map((id) => [
    id,
    ["fries", "sweet-potato-fries", "onion-rings", "tempura-onion"],
  ])
);

/** כל מנות הסמאש - לכיבוי מרוכז */
export const SMASH_DISH_IDS = [
  "crazy-smash",
  "meal-crazy-smash",
  "smash-double-cheese",
  "meal-smash-double-cheese",
  "smash-moshavnikim",
  "meal-smash-moshavnikim",
];

/**
 * מחזיר את רשימת המנות שתלויות במרכיב מסוים.
 */
export const getDependentDishes = (ingredientId: string): string[] => {
  const all = new Set<string>();
  Object.entries(MENU_DEPENDENCIES).forEach(([dishId, ingredients]) => {
    if (ingredients.includes(ingredientId)) all.add(dishId);
  });
  Object.entries(MENU_ANY_DEPENDENCIES).forEach(([dishId, ingredients]) => {
    if (ingredients.includes(ingredientId)) all.add(dishId);
  });
  return [...all];
};

/** האם המנה אמורה להיות זמינה לפי המרכיבים שלה */
export const isDishSatisfied = (
  dishId: string,
  isAvailable: (itemId: string) => boolean
): boolean => {
  const all = MENU_DEPENDENCIES[dishId] || [];
  if (!all.every(isAvailable)) return false;
  const any = MENU_ANY_DEPENDENCIES[dishId];
  if (any && any.length && !any.some(isAvailable)) return false;
  return true;
};

/** המרכיבים שאפשר לשאול עליהם כשמכבים מנה ידנית */
export const getDishIngredients = (dishId: string): string[] => [
  ...(MENU_DEPENDENCIES[dishId] || []),
  ...(MENU_ANY_DEPENDENCIES[dishId] || []),
];

/**
 * כל המרכיבים החיוניים של מנה, כולל מרכיבים של מרכיבים (רקורסיבי).
 * משמש להדלקה יזומה: אם מדליקים מנה מורכבת – כל מה שהיא צריכה זמין שוב.
 */
export const getAllRequiredIngredients = (dishId: string): string[] => {
  const out = new Set<string>();
  const walk = (id: string) => {
    for (const dep of MENU_DEPENDENCIES[id] || []) {
      if (out.has(dep)) continue;
      out.add(dep);
      walk(dep);
    }
  };
  walk(dishId);
  return [...out];
};
