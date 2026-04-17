/**
 * Shared Privacy Policy content — single source of truth, used both in
 * the standalone /privacy page and inside the PrivacyModal during checkout.
 */
const PrivacyContent = () => (
  <div className="space-y-4 text-foreground/90 leading-relaxed" dir="rtl">
    <p>
      אתר "המבורגר הבקתה" (להלן: "האתר") מופעל על ידי שלזינגר אבישי-אברהם, עוסק מורשה,
      ע.מ 213877103, שמקום עסקו בכתובת: ערבי הנחל 22, תושיה (להלן: "העסק").
    </p>
    <p>
      העסק מכבד את פרטיות המשתמשים באתר ורואה חשיבות רבה בהגנה על המידע האישי שלהם.
      השימוש באתר מהווה הסכמה למדיניות פרטיות זו.
    </p>

    <h3 className="text-xl font-bold text-foreground pt-2">1. סוגי המידע הנאסף</h3>
    <p>בעת השימוש באתר, ייתכן וייאסף מידע כגון:</p>
    <ul className="list-disc pr-6 space-y-1">
      <li>שם מלא</li>
      <li>מספר טלפון</li>
      <li>פרטי הזמנה</li>
      <li>מידע טכני (כגון כתובת IP, סוג מכשיר, דפדפן)</li>
      <li>מידע על פעילות באתר (דפים נצפים, פעולות, זמן שימוש וכדומה)</li>
    </ul>
    <p>המידע נאסף באופן ישיר מהמשתמש או באופן אוטומטי במהלך השימוש באתר.</p>

    <h3 className="text-xl font-bold text-foreground pt-2">2. מטרות השימוש במידע</h3>
    <p>המידע נאסף ומשמש לצורך:</p>
    <ul className="list-disc pr-6 space-y-1">
      <li>ביצוע וניהול הזמנות</li>
      <li>יצירת קשר עם הלקוח</li>
      <li>שליחת עדכונים לגבי הזמנה (לרבות SMS או וואטסאפ)</li>
      <li>מתן שירות ותמיכה</li>
      <li>שיפור חוויית המשתמש</li>
      <li>ניתוח נתונים ושיפור ביצועי האתר</li>
      <li>מניעת הונאות ושימוש לרעה</li>
    </ul>

    <h3 className="text-xl font-bold text-foreground pt-2">3. מסירת מידע לצדדים שלישיים</h3>
    <p>
      העסק לא ימכור מידע אישי לצדדים שלישיים.
      מידע עשוי להיות מועבר לגורמים חיצוניים רק במקרים הבאים:
    </p>
    <ul className="list-disc pr-6 space-y-1">
      <li>לצורך השלמת השירות (כגון שליחים, חברות סליקה, מערכות תפעול)</li>
      <li>כאשר הדבר נדרש על פי חוק</li>
      <li>לצורך הגנה על זכויות העסק</li>
    </ul>

    <h3 className="text-xl font-bold text-foreground pt-2">4. דיוור והודעות</h3>
    <p>
      העסק רשאי לשלוח ללקוח הודעות הקשורות להזמנה ולשירות, לרבות באמצעות SMS או וואטסאפ.
    </p>
    <p>
      שליחת הודעות שיווקיות תתבצע רק לאחר קבלת הסכמה מפורשת מהמשתמש, וניתן לבטל הסכמה זו בכל עת.
    </p>

    <h3 className="text-xl font-bold text-foreground pt-2">5. שימוש בכלים חיצוניים</h3>
    <p>
      ייתכן והאתר יעשה שימוש בכלי ניתוח נתונים ושירותים חיצוניים (כגון שירותי אנליטיקה),
      לצורך שיפור השירות והבנת השימוש באתר.
      כלים אלו עשויים לאסוף מידע סטטיסטי שאינו מזהה את המשתמש באופן אישי.
    </p>

    <h3 className="text-xl font-bold text-foreground pt-2">6. שמירת מידע ואבטחה</h3>
    <p>
      המידע נשמר במערכות מאובטחות, והעסק נוקט באמצעים סבירים לשמירה על המידע.
      עם זאת, אין אפשרות להבטיח אבטחה מוחלטת מפני גישה בלתי מורשית.
    </p>

    <h3 className="text-xl font-bold text-foreground pt-2">7. עוגיות (Cookies)</h3>
    <p>
      האתר עושה שימוש בעוגיות לצורך תפעול תקין, שיפור חוויית המשתמש וניתוח נתונים.
      מידע נוסף ניתן למצוא ב
      <a href="/cookie-policy" className="text-primary hover:underline">מדיניות העוגיות</a>
      {" "}באתר.
    </p>

    <h3 className="text-xl font-bold text-foreground pt-2">8. זכויות המשתמש</h3>
    <p>למשתמש הזכות:</p>
    <ul className="list-disc pr-6 space-y-1">
      <li>לעיין במידע שנשמר עליו</li>
      <li>לבקש תיקון או מחיקה של מידע</li>
      <li>לבטל הסכמה לשימוש במידע</li>
    </ul>
    <p>פניות בנושא ניתן לשלוח לכתובת הדוא״ל המפורטת להלן.</p>

    <h3 className="text-xl font-bold text-foreground pt-2">9. שמירת מידע</h3>
    <p>
      המידע יישמר למשך הזמן הנדרש לצורך מתן השירות, תפעול העסק ולפי דרישות החוק.
    </p>

    <h3 className="text-xl font-bold text-foreground pt-2">10. שינויים במדיניות</h3>
    <p>
      העסק רשאי לעדכן מדיניות זו מעת לעת.
      הגרסה המחייבת היא זו המפורסמת באתר במועד השימוש.
    </p>

    <h3 className="text-xl font-bold text-foreground pt-2">11. יצירת קשר</h3>
    <p>
      📧 <a href="mailto:avishi058@gmail.com" className="text-primary hover:underline">avishi058@gmail.com</a>
      <br />
      📞 <a href="tel:058-4633555" className="text-primary hover:underline">058-4633555</a>
    </p>
  </div>
);

export default PrivacyContent;
