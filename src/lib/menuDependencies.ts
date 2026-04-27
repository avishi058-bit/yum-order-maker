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

  // סמאש דאבל ציז - דורש צ'דר טבעוני
  "smash-double-cheese": ["vegan-cheddar"],
  "meal-smash-double-cheese": ["vegan-cheddar"],

  // אבישי שחוט לי פרה - דורש רוסטביף וביצת עין
  avishai: ["roastbeef", "egg"],
  "meal-avishai": ["roastbeef", "egg"],
};

/**
 * מחזיר את רשימת המנות שתלויות במרכיב מסוים.
 */
export const getDependentDishes = (ingredientId: string): string[] => {
  return Object.entries(MENU_DEPENDENCIES)
    .filter(([, ingredients]) => ingredients.includes(ingredientId))
    .map(([dishId]) => dishId);
};
