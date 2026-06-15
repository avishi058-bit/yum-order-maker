# הוספת תוספות לכל המבורגר בדיל חברים ודיל משפחתי

מוסיף אופציה לבחור תוספות (toppings) בתשלום על כל המבורגר בנפרד בתוך דיל חברים (3 המבורגרים) ובדיל משפחתי (5 המבורגרים). מימוש מקצה לקצה: UI, מחירים, שרת, מטבח, קבלות, מלאי.

## שינויים

### 1. Frontend — UI
- **`DealBurgerConfig`** (CartDrawer.tsx): הוספת שדה `toppings: string[]` (מערך מזהי תוספות).
- **`DealCustomizer.tsx`** + **`FamilyDealCustomizer.tsx`**: אחרי שלב בחירת המנה (חוסרים+שם) — מסך תוספות אופציונליות לאותו המבורגר עם המחירים מ-`TOPPINGS_PRICING`. שימוש באותו רכיב טוגלים כמו `ItemCustomizer`.
- **`CartDrawer.tsx`** + **`KioskCartDrawer.tsx`** + **`OrderHistoryModal.tsx`**: הצגת תוספות מתחת לכל המבורגר בדיל ("בורגר 1: ריבת בצל, ביצת עין").

### 2. תמחור
- **`src/lib/cartPricing.ts`**: עבור פריט עם `dealBurgers`, להוסיף סכום תוספות לכל בורגר על המחיר הבסיסי של הדיל (במקום `return item.price` היבש).
- **`supabase/functions/create-order/index.ts`**: הרחבת `dealBurgers` ב-zod — הוספת `toppings: string[]`, חישוב מחיר תוספות בשרת לכל בורגר (source of truth), שמירת שמות תוספות ב-jsonb.

### 3. בסיס נתונים
- אין צורך במיגרציה לסכמה — `order_items.deal_burgers` הוא JSONB גמיש. כל בורגר ישמר כ-`{name, removals:[שמות], toppings:[שמות]}`.

### 4. טריגרים (מלאי)
- **`apply_order_item_to_fridge`**: כיום שולף `fridge_qty` עבור `id`/`name` של כל deal_burger. נוסיף לולאה פנימית על `toppings` של כל בורגר כדי למשוך גם תוספות מהמקרר (למשל ביצה, בצל).
- **`apply_order_to_inventory`** (כאשר order עובר ל-`ready`): אותה הרחבה לקליטת תוספות הדיל כצריכת מלאי מהמחסן.
- **`restore_fridge_for_order_item`** (עריכת/ביטול הזמנה): אותה הרחבה להחזרת תוספות.

### 5. מטבח וקבלות
- **`src/pages/Kitchen.tsx`**: הצגת תוספות לכל בורגר בדיל.
- **`src/lib/kitchenReceipt.ts`** + **`src/lib/btReceiptOps.ts`** + **`src/lib/bluetoothPrinter.ts`**: הדפסת שורת תוספות לכל בורגר בדיל בקבלת המטבח.

### 6. עריכת הזמנה
- **`edit-order`** edge function ו-**`EditOrderModal.tsx`**: כבר מעבירים את `deal_burgers` כ-jsonb — יעבוד אוטומטית עם הפורמט החדש. נוודא שהשרת לא מאבד את שדה ה-toppings.

## פתיחות
- **מקסימום תוספות לבורגר בדיל**: ללא הגבלה מיוחדת (משתמש באותה הגבלת `.max(20)` של פריט רגיל).
- **תוספות זמינות**: כל הרשימה מ-`TOPPINGS_PRICING` (זהה לבורגר רגיל), כולל "תוספת קציצה", "+ קציצת סמאש", "לחמנייה ללא גלוטן" וכו'.
- **מחיר נוסף**: מצטבר על מחיר הדיל הקבוע (216₪ דיל חברים, 300₪ משפחתי).

מאשר/ת? אתחיל לממש את כל הצעדים ברצף.
