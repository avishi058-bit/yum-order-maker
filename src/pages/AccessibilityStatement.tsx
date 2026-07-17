/**
 * Accessibility Statement page — required by IS 5568 for the "הבקתה" website.
 * Links from the site footer and from the AccessibilityWidget panel.
 *
 * The wording still requires a final review by legal counsel before being
 * considered fully compliant — this file implements the structural requirements
 * (business identity, coordinator contact, accommodations list, limitations,
 * complaint path) mandated by the standard.
 */
const AccessibilityStatement = () => (
  <div className="min-h-screen bg-background py-12 px-4" dir="rtl">
    <div className="max-w-3xl mx-auto space-y-6 text-foreground/90 leading-relaxed">
      <header>
        <h1 className="text-3xl font-black text-foreground mb-2">הצהרת נגישות</h1>
        <p className="text-muted-foreground text-sm">עדכון אחרון: יולי 2026</p>
      </header>

      <section>
        <h2 className="text-xl font-bold text-foreground mb-2">1. פרטי בית העסק</h2>
        <p>
          אתר <b>"המבורגר הבקתה"</b> מופעל על ידי שלזינגר אבישי-אברהם, עוסק מורשה,
          ע.מ 213877103, שמקום עסקו בכתובת: ערבי הנחל 22, תושיה.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground mb-2">2. מחויבות לנגישות</h2>
        <p>
          "המבורגר הבקתה" רואה בהנגשת האתר חלק בלתי נפרד מהשירות ללקוחות ופועל
          להתאמת האתר להוראות תקנות שוויון זכויות לאנשים עם מוגבלות
          (התאמות נגישות לשירות), תשע"ג-2013, ולתקן הישראלי{" "}
          <b>ת"י 5568</b> ברמת AA, המבוסס על הנחיות <b>WCAG 2.1</b> ברמה AA.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground mb-2">3. רכז נגישות</h2>
        <p>
          בעל העסק, <b>אבישי שלזינגר</b>, משמש כרכז הנגישות של האתר. פניות
          בנוגע לנגישות האתר, קשיים או בקשות התאמה יטופלו על ידו:
        </p>
        <ul className="list-disc pr-6 mt-2 space-y-1">
          <li>📞 טלפון: <a href="tel:058-4633555" className="text-primary hover:underline">058-4633-555</a></li>
          <li>📧 דוא"ל: <a href="mailto:avishi058@gmail.com" className="text-primary hover:underline">avishi058@gmail.com</a></li>
          <li>📮 כתובת: ערבי הנחל 22, תושיה</li>
        </ul>
        <p className="mt-2">אנו משתדלים לחזור לכל פנייה תוך מספר ימי עסקים.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground mb-2">4. התאמות נגישות שבוצעו באתר</h2>
        <p>
          באתר מותקן <b>וידג'ט נגישות</b> (כפתור עגול בפינת המסך) המאפשר לגולש
          לבצע את ההתאמות הבאות באופן עצמאי, וההעדפות נשמרות בין ביקורים:
        </p>
        <ul className="list-disc pr-6 mt-2 space-y-1">
          <li>הגדלת גודל טקסט (שלוש רמות)</li>
          <li>מצב ניגודיות גבוהה (שחור על צהוב)</li>
          <li>היפוך צבעי האתר</li>
          <li>הדגשת קישורים</li>
          <li>סמן עכבר גדול</li>
          <li>עצירת אנימציות ומעברים</li>
          <li>מעבר לגופן קריא (Arial/Helvetica)</li>
          <li>הגדלת מרווח בין שורות</li>
          <li>הגדלת מרווח בין אותיות ומילים</li>
          <li>איפוס כל ההגדרות בלחיצה אחת</li>
        </ul>
        <p className="mt-2">בנוסף, האתר תוכנן כך שיאפשר:</p>
        <ul className="list-disc pr-6 mt-2 space-y-1">
          <li>ניווט מלא באמצעות המקלדת (מקש Tab) עם מסגרת מיקוד נראית לעין</li>
          <li>מבנה סמנטי (HTML5) עם כותרות היררכיות ותגי alt לתמונות המשמעותיות</li>
          <li>יחסי ניגודיות של לפחות 4.5:1 עבור טקסט רגיל, לפי דרישות AA</li>
          <li>תמיכה בקוראי מסך (screen readers) בעברית עם כיווניות RTL</li>
          <li>ממשק רספונסיבי המתאים למכשירים ניידים, טאבלטים ומחשבים</li>
          <li>אזורי מגע מוגדלים למכשירי מגע</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground mb-2">5. מגבלות נגישות ידועות</h2>
        <p>
          למרות המאמצים להנגיש את האתר במלואו, ייתכנו חלקים או תכנים שטרם הונגשו
          במלואם או שהנגישות שלהם חלקית:
        </p>
        <ul className="list-disc pr-6 mt-2 space-y-1">
          <li>
            <b>מסמכי PDF</b> — הסכמים וחשבוניות המופקים מהאתר (למשל הסכמי אירועים)
            עשויים שלא להיות נגישים במלואם. ניתן לפנות לרכז הנגישות לקבלת גרסה
            נגישה או חלופה טקסטואלית.
          </li>
          <li>
            <b>תמונות דקורטיביות</b> — חלק מהאייקונים הקישוטיים באתר אינם כוללים
            טקסט חלופי, לפי הנחיות ה-WCAG לתמונות "presentational".
          </li>
          <li>
            <b>ממשק מטבח פנימי</b> (כתובת <code className="text-xs bg-muted px-1 rounded">/kitchen</code>)
            ואזור האדמין הם ממשקי-צוות פנימיים ואינם נחשבים חלק מהשירות
            לציבור — לפיכך אין חובת הנגשה עליהם.
          </li>
          <li>
            <b>מצב קיוסק</b> — בקיוסק הפיזי במקום, וידג'ט הנגישות זמין לצוות
            הצמוד לעזרה ידנית לפי בקשה.
          </li>
        </ul>
        <p className="mt-2">
          אנו ממשיכים לפעול לצמצום המגבלות ולשיפור הנגישות באופן שוטף.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground mb-2">6. משוב ופניות בנושא נגישות</h2>
        <p>
          נתקלת בבעיית נגישות באתר? יש לך הצעה לשיפור, או שאתה זקוק להתאמה שאינה
          זמינה בווידג'ט? נשמח לשמוע ולסייע. פנה לרכז הנגישות דרך פרטי הקשר
          המפורטים בסעיף 3 לעיל, ואנו מתחייבים לטפל בפנייה בהקדם האפשרי.
        </p>
        <p className="mt-2">
          במקרה של סירוב או אי-מענה תוך זמן סביר, זכותך לפנות אל נציבות שוויון
          זכויות לאנשים עם מוגבלות במשרד המשפטים.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground mb-2">7. עדכון ההצהרה</h2>
        <p>
          הצהרה זו מתעדכנת מעת לעת בהתאם לשינויים באתר ובתקנות הנגישות. הנוסח
          המחייב הוא הנוסח המפורסם באתר במועד הצפייה.
        </p>
      </section>

      <div className="pt-4">
        <a href="/" className="text-primary hover:underline font-bold">← חזרה לדף הראשי</a>
      </div>
    </div>
  </div>
);

export default AccessibilityStatement;
