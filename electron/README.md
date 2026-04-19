# הבקתה — Kiosk Electron Wrapper

עוטף את אתר הקיוסק באפליקציית Electron שפותחת וסוגרת את **TabTip.exe**
(המקלדת המגעית של Windows) אוטומטית לפי focus/blur של שדות הקלט.

## איך זה עובד

1. `electron/main.cjs` — תהליך ראשי. מקבל אירועי `input-focus` / `input-blur`
   מהדף, ומפעיל/הורג את `TabTip.exe`.
2. `electron/preload.cjs` — רץ בתוך הדף, מאזין ל-`focusin`/`focusout` על כל
   ה-inputים והטקסט-אריאות, ושולח הודעה ל-main דרך IPC.
3. הדפדוס מוגדר עם debounce של 120ms כדי שמעבר בין שדות לא יגרום לרפרוף.

## הרצה במחשב הקיוסק (Windows)

### פעם ראשונה — Build

על מחשב פיתוח (Windows / Mac / Linux):

```bash
npm install
npm run electron:build:win
```

הפלט נוצר ב-`electron-release/הבקתה-Kiosk-win32-x64/`. העתק את כל התיקייה
למחשב הקיוסק.

### הרצה

הפעל `הבקתה-Kiosk.exe` מתוך התיקייה. האפליקציה תיפתח במסך מלא ותטען את
האתר. כשתלחץ על שדה — המקלדת תיפתח. כשתצא — היא תיסגר.

### יציאה ממצב קיוסק

`Ctrl + Shift + Esc` (לתחזוקה).

## הגדרות

- כתובת ברירת מחדל: `https://yum-order-maker.lovable.app/kiosk`
- לשנות בלי לבנות מחדש: הגדר משתנה סביבה `KIOSK_URL` לפני ההרצה.
- נתיב TabTip מוגדר ב-`electron/main.cjs` (קבוע סטנדרטי של Windows).

## הפעלה אוטומטית בעלייה (אופציונלי)

ב-Windows: הוסף קיצור דרך לאקזה ל-
`shell:startup` (Win+R → `shell:startup` → Enter).

## דרישות

- Windows 10/11 עם המקלדת המגעית מותקנת (ברירת מחדל).
- שירות "Touch Keyboard and Handwriting Panel Service" צריך להיות מאופשר
  (Automatic). ראה הוראות בצ'אט אם לא.
