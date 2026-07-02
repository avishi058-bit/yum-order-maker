# הבקתה — Android Print Agent

אפליקציית Android קטנה שרצה ברקע על טאבלט המטבח, מחזיקה חיבור Bluetooth קבוע אל מדפסת התרמלית, ומקבלת הזמנות הדפסה מאתר `/kitchen` דרך HTTP מקומי על `127.0.0.1:9100`.

## מה היא עושה

- **HTTP server מקומי** (NanoHTTPD) על פורט 9100 — האזנה ל-localhost בלבד.
- **חיבור Bluetooth קבוע** עם reconnect אוטומטי. Pairing נעשה פעם אחת מהגדרות Android.
- **Foreground Service** עם notification — אנדרואיד לא יהרוג אותה.
- **Auto-start ב-boot** של הטאבלט.

## אנדפוינטים

```
GET  /health
     →  {
          "ok": true,
          "connected": true,
          "printer": "Printer001-352C",
          "printerType": "Generic",           // או "StarLineMode"
          "printerTypeLabel": "ESC/POS (Generic)",
          "version": "1.1.0"
        }

POST /print-raw
     Content-Type: application/json
     Body: { "b64": "<base64-of-escpos-bytes>" }
     →  { "ok": true, "bytes": 12345, "sourceBytes": 12345, "printerType": "Generic" }
        או   HTTP 502 + { "error": "..." }
```

האתר שולח **תמיד** ESC/POS — בדיוק אותם בייטים שה-Bluetooth driver הפנימי מייצר (כולל raster לעברית). ה-Agent מזהה לבד את סוג המדפסת:

- **Generic (ברירת מחדל, ללא שינוי)** — Xprinter/ESC/POS. הבייטים עוברים as-is.
- **Star Line Mode** — Star Micronics **mC-Print3 (MCP31LB)**. ה-Agent מתרגם את אותו payload על-הזבוב לפורמט Star Line Mode (`ESC * r A ... b n1 n2 ... ESC * r B`, `ESC GS a` alignment, `ESC d 3` cut) ושולח דרך SPP/RFCOMM.

הזיהוי הוא לפי שם ה-Bluetooth של המכשיר המזווג — הראשון שמתאים ל-`KNOWN_PRINTERS` ב-`Config.kt` זוכה (Star קודם ל-Generic). לכן ה-Xprinter הקיים ממשיך לעבוד בדיוק כמו קודם.

## בנייה (Android Studio)

1. `File → Open` ובחר את התיקייה `android-print-agent/`.
2. המתן ל-Gradle sync.
3. אופציונלי — ערוך את `app/src/main/java/co/habakta/printagent/Config.kt` והוסף/הסר entries ב-`KNOWN_PRINTERS` אם שם ה-Bluetooth של המדפסת שלך לא מתחיל ב-`Printer`, `mC-Print3`, `MCP31` או `STAR`.
4. `Build → Build APK(s)` — ה-APK יישמר ב-`app/build/outputs/apk/release/`.
5. העבר את ה-APK לטאבלט (USB / Google Drive / `adb install`).

## התקנה על הטאבלט

1. ודא שהמדפסת מזווגת ב-Android: `Settings → Bluetooth → Pair new device`.
   - Xprinter: `Printer001-352C`.
   - Star mC-Print3: יופיע בשם `mC-Print3-XXXXX` או `STAR-XXXXX` (וודא ש-**Bluetooth Classic / SPP** מופעל במדפסת — לא BLE).
2. התקן את ה-APK (יידרש "Install from unknown sources" אם זה לא מ-Play Store).
3. פתח את האפליקציה פעם אחת — תאשר Bluetooth permissions + Notification permission.
4. סמן ✅ "Start on boot".
5. ה-Service נדלק אוטומטית, ההתראה הקבועה תופיע ("Print Agent פעיל").
6. בדפדפן: `/kitchen` → בחר מצב "Agent" בסלקטור ההדפסה → האינדיקטור ירוק = מוכן.

## בדיקה מהירה מ-ADB

```bash
adb shell curl -s http://127.0.0.1:9100/health
```

## בעיות נפוצות

- **Health אדום (Agent ✗)**: האפליקציה לא רצה. פתח אותה ידנית פעם אחת.
- **Health צהוב (ללא מדפסת)**: ה-Service רץ אבל לא הצליח להתחבר. בדוק שהמדפסת דלוקה ומזווגת.
- **תיקיית הפלט ריקה**: `./gradlew assembleRelease` במקום ה-IDE.

## מבנה הפרויקט

```
android-print-agent/
├── README.md
├── settings.gradle.kts
├── build.gradle.kts
├── gradle.properties
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── res/values/strings.xml
│       └── java/co/habakta/printagent/
│           ├── Config.kt
│           ├── MainActivity.kt
│           ├── PrintAgentService.kt
│           ├── BluetoothPrinterClient.kt
│           ├── HttpServer.kt
│           └── BootReceiver.kt
```

## רשיון / שונות

Internal tool. NanoHTTPD (BSD-3).
