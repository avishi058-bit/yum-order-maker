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
     →  { "ok": true, "printer": "Printer001-352C", "connected": true, "version": "1.0.0" }

POST /print-raw
     Content-Type: application/json
     Body: { "b64": "<base64-of-escpos-bytes>" }
     →  { "ok": true, "bytes": 12345 }   או   HTTP 502 + { "error": "..." }
```

האתר שולח את אותם בייטים שה-Bluetooth driver הפנימי מייצר (כולל ה-raster לעברית) — לכן עיצוב הבון לא משתנה.

## בנייה (Android Studio)

1. `File → Open` ובחר את התיקייה `android-print-agent/`.
2. המתן ל-Gradle sync.
3. ערוך את `app/src/main/java/co/habakta/printagent/Config.kt` והגדר את **שם המדפסת** המזווגת (`PRINTER_NAME = "Printer001-352C"`).
4. `Build → Build APK(s)` — ה-APK יישמר ב-`app/build/outputs/apk/release/`.
5. העבר את ה-APK לטאבלט (USB / Google Drive / `adb install`).

## התקנה על הטאבלט

1. ודא שהמדפסת מזווגת ב-Android: `Settings → Bluetooth → Pair new device → Printer001-352C`.
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
