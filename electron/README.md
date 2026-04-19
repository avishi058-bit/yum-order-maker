# הבקתה Kiosk — Debug Build

מצב debug מלא לאבחון בעיית המקלדת של TabTip.

## איך להריץ ולאבחן

### 1. בנה מחדש במחשב הפיתוח
```bash
node electron/build.cjs win32
```

### 2. העתק למחשב הקיוסק
העתק את `electron-release/הבקתה-Kiosk-win32-x64/` למחשב Windows של הקיוסק.

### 3. הפעל מ-CMD (לא בלחיצה כפולה!)
פתח **Command Prompt**, נווט לתיקייה והרץ:
```cmd
cd C:\path\to\הבקתה-Kiosk-win32-x64
"הבקתה-Kiosk.exe"
```
ככה תראה את כל הלוגים גם ב-CMD.

### 4. צפה ב-Debug Overlay
האפליקציה תיפתח עם **חלונית debug ירוקה בפינה השמאלית-עליונה**.
היא מציגה בזמן אמת:
- אירועי focus / blur ועל איזה אלמנט
- פקודות שנשלחו ל-TabTip
- תוצאות (הצליח / נכשל)
- תוצאות הדיאגנוסטיקה

### 5. כפתורי בדיקה
- **Test Open TabTip** — מנסה לפתוח את TabTip ידנית, ללא קשר לפוקוס. **התחל מכאן!**
- **Kill TabTip** — סוגר את TabTip
- **Re-run diagnostics** — מריץ שוב את כל הבדיקות
- **Clear log** — מנקה את הלוג

### 6. קובץ לוג
לוג מלא נשמר ב:
```
%APPDATA%\hakata-kiosk\kiosk-debug.log
```
(הדבק `%APPDATA%\hakata-kiosk` ב-Run / סייר הקבצים)

### 7. קיצורים
- `Ctrl+Shift+D` — הסתר/הצג את ה-overlay
- `Ctrl+Shift+Esc` — צא מהאפליקציה

---

## איך לאבחן את הבעיה — סדר הבדיקות

### בדיקה 1: האם TabTip בכלל נפתח ידנית?
1. צא מהאפליקציה
2. ב-CMD: `"C:\Program Files\Common Files\microsoft shared\ink\TabTip.exe"`
3. **אם המקלדת לא קופצת** — הבעיה במערכת ההפעלה, לא באפליקציה. הפעל את `TabletInputService` (`services.msc`).

### בדיקה 2: האם TabTip נפתח מהאפליקציה?
1. הפעל את הקיוסק
2. לחץ על **"Test Open TabTip"** בחלונית הדיבוג
3. **אם המקלדת לא קופצת** אבל בדיקה 1 כן עבדה — בעיית הרשאות. נסה להפעיל את האפליקציה כ-Administrator (קליק ימני → Run as administrator).

### בדיקה 3: האם הפוקוס מזוהה?
1. לחץ על שדה הטלפון/שם בקיוסק
2. בחלונית צריך להופיע: `EVENT OPEN from INPUT[tel]` (או דומה)
3. **אם אין שורה כזו** — הקליק לא מגיע ל-input אמיתי. תצלם את החלונית ושלח.
4. **אם כן יש שורה** ואז `→ Spawning TabTip.exe` ואז `✓ TabTip spawn dispatched` — הקוד עובד. הבעיה ב-Windows.

### בדיקה 4: האם blur סוגר מיד?
אם אתה רואה רצף של `OPEN` → `CLOSE` תוך מילישניות — יש בעיה של פוקוס שעובר מיד. שלח לוג ונפתור.

---

## תרחישים נפוצים והפתרונות

| מה אתה רואה בלוג | המשמעות | הפתרון |
|---|---|---|
| `✗ TabTip.exe NOT FOUND` | הקובץ לא קיים במחשב | התקן Windows feature: Tablet PC Components |
| `✗ TabletInputService is NOT running` | השירות כבוי | `services.msc` → Start + Automatic |
| `TabTip spawn error: EACCES` | בעיית הרשאות | הרץ as Administrator |
| `→ Spawning` אבל אין מקלדת | TabTip רץ אבל לא מוצג | בדוק הגדרות "Touch keyboard" ב-Settings |
| אין `EVENT OPEN` בכלל | הפוקוס לא נתפס | תן לוג של ה-overlay כשאתה לוחץ |

---

## מה לשלוח אם עדיין לא עובד

1. צילום מסך של חלונית הדיבוג אחרי לחיצה על שדה
2. תוכן הקובץ `%APPDATA%\hakata-kiosk\kiosk-debug.log`
3. תוצאת בדיקה 1 (TabTip ידני מ-CMD)
