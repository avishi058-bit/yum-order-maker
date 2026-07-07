## מערכת משלוחים - תוכנית מפורטת

### 1. מסד נתונים

**עדכון `restaurant_status`:**
- `delivery_enabled` (bool, default false) - מתג הפעלה כללי

**טבלה חדשה `delivery_zones`:**
- `id`, `name` (שם אזור), `price` (מחיר), `keywords` (text[] - מילות זיהוי בכתובת: "תושיה", "ערבי הנחל", "כפר תבור" וכו'), `active` (bool)
- קריאה: anon+authenticated. עריכה: מטבח/אדמין

**טבלה חדשה `delivery_requests`:**
- `id`, `customer_name`, `customer_phone`, `address`, `lat/lng` (nullable), `zone_id`, `price`, `status` (pending/approved/rejected/completed), `order_id` (nullable), `created_at`
- Realtime enabled

### 2. הגדרות מטבח (Kitchen)

בסרגל העליון של Kitchen.tsx, ליד "הזמנה מראש":
- **מתג "משלוחים פעילים"** - מעדכן `restaurant_status.delivery_enabled`
- **כפתור "אזורי משלוח"** → dialog לניהול `delivery_zones` (הוספה/עריכה: שם, מחיר, מילות חיפוש)

### 3. כרטיסי בקשות משלוח במטבח

מעל רשימת ההזמנות בקיטשן, sections חדש: **"בקשות משלוח ממתינות"**
מוצג כל `delivery_request` בסטטוס `pending`:
- שם + טלפון
- כתובת מלאה
- מחיר משלוח שחושב
- כפתור **"הצג QR"** → dialog עם QR של `https://waze.com/ul?q=<address>` (משתמש בספריית qrcode.react)
- כפתור **"אשר משלוח"** → status=approved
- כפתור **"דחה"** → status=rejected

Realtime subscription על `delivery_requests`.

### 4. אתר ההזמנות - זרימה

**Index.tsx - מסך פתיחה:**
- מוסיף אפשרות שלישית "משלוח" (מוצג רק כש-`delivery_enabled=true`)
- לחיצה → מעבר למסך כתובת

**מסך חדש `DeliveryAddress` (בתוך Index או route חדש):**
1. שדה כתובת (input טקסטואלי)
2. בלחיצה על "חשב עלות" - מתאים לאזור לפי keywords ב-`delivery_zones`
3. מציג "עלות המשלוח: X₪" + הודעה על תשלום לשליח
4. Checkbox חובה "קראתי והבנתי..."
5. כפתור **"חפש לי שליח"** - יוצר `delivery_request` (pending)
6. הכפתור נעלם → מציג "מחפשים עבורך שליח... 🔍" עם spinner
7. **Polling / realtime** על status הבקשה:
   - `approved` → פותח את מסך התפריט (dineType=delivery, מזין phone/name/address מהבקשה)
   - `rejected` → מציג "מצטערים, לא נמצא שליח כרגע"

**אם הכתובת לא תואמת לאזור:** מציג "לצערנו איננו מגיעים לאזור זה"

### 5. תפריט + עגלה + Checkout

- מצב חדש `dineType='delivery'` (בנוסף ל-sit/take)
- **בעגלה/checkout:** אם delivery ומסכום ההזמנה < 300₪ → חוסם עם הודעה "מינימום 300₪"
- **ב-CheckoutForm:** אם delivery, מציג בלוק גדול לפני תשלום:
  > שים לב: באתר זה אתה משלם רק על ההזמנה. את דמי המשלוח משלמים ישירות לשליח (Bit או מזומן).
  
  + Checkbox חובה + לא ניתן לשלם ללא סימון
- ההזמנה נשמרת עם `delivery_request_id` ו-`delivery_address`
- לאחר יצירת ההזמנה: `delivery_request.order_id` מתעדכן

### 6. עדכוני schema ל-orders

- `delivery_request_id` (uuid, nullable, FK)
- `delivery_address` (text, nullable)
- `delivery_fee` (numeric, nullable) - לתצוגה בלבד, לא נגבה

### 7. קיוסק - ללא שינוי

הקוד של הקיוסק (`KioskMode`/עמדה) לא יציג את אפשרות המשלוח בכלל - הבדיקה תהיה `if (!isKiosk && delivery_enabled)`.

### טכני

- QR: `qrcode.react` (כבר קיים? אבדוק, אם לא - `bun add qrcode.react`)
- Realtime על `delivery_requests` בצד לקוח (המתנה לשליח) ובצד מטבח
- כל הטבלאות החדשות עם RLS + GRANTs

**הערה:** לא מבצע חישוב מרחק/Google Maps - רק התאמת keywords לאזור מוגדר. תוכל להוסיף אזורים דרך dialog במטבח.

מאשר להתחיל?
