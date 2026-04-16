const PrivacyPolicy = () => (
  <div className="min-h-screen bg-background py-12 px-4" dir="rtl">
    <div className="max-w-3xl mx-auto prose prose-invert">
      <h1 className="text-3xl font-black text-foreground mb-8">מדיניות פרטיות</h1>
      <p className="text-muted-foreground text-sm mb-6">עדכון אחרון: אפריל 2026</p>

      <section className="space-y-4 text-foreground/90">
        <h2 className="text-xl font-bold text-foreground">1. כללי</h2>
        <p>אתר "הבקתה" (להלן: "האתר") מכבד את פרטיותך ומחויב להגן על המידע האישי שלך. מדיניות זו מסבירה אילו נתונים נאספים, כיצד הם משמשים ואיך אנחנו מגנים עליהם.</p>

        <h2 className="text-xl font-bold text-foreground">2. מידע שאנו אוספים</h2>
        <ul className="list-disc pr-6 space-y-1">
          <li>שם מלא ומספר טלפון – לצורך ביצוע הזמנות ויצירת קשר.</li>
          <li>פרטי הזמנה – מוצרים שנבחרו, תוספות, הערות, שיטת תשלום וסטטוס.</li>
          <li>כתובת (במידה ורלוונטי) – לצורך משלוח.</li>
          <li>נתוני שימוש טכניים – כגון סוג דפדפן, מערכת הפעלה ורזולוציית מסך, לצורך שיפור חוויית המשתמש.</li>
        </ul>

        <h2 className="text-xl font-bold text-foreground">3. שימוש במידע</h2>
        <p>המידע שנאסף משמש אך ורק למטרות הבאות:</p>
        <ul className="list-disc pr-6 space-y-1">
          <li>עיבוד והכנת ההזמנה שלך.</li>
          <li>יצירת קשר לגבי ההזמנה.</li>
          <li>שיפור השירות וחוויית המשתמש באתר.</li>
          <li>עמידה בדרישות חוקיות.</li>
        </ul>

        <h2 className="text-xl font-bold text-foreground">4. שיתוף מידע</h2>
        <p>איננו מוכרים, משכירים או משתפים מידע אישי עם צדדים שלישיים, למעט:</p>
        <ul className="list-disc pr-6 space-y-1">
          <li>ספקי שירות תשלום מאובטחים לצורך עיבוד תשלומים בכרטיס אשראי.</li>
          <li>ספק שירותי הודעות (WhatsApp) לצורך שליחת קוד אימות.</li>
          <li>כנדרש על פי חוק.</li>
        </ul>

        <h2 className="text-xl font-bold text-foreground">5. אבטחת מידע</h2>
        <p>אנו נוקטים באמצעי אבטחה מתקדמים כדי להגן על המידע שלך, לרבות הצפנת נתונים, גישה מוגבלת למידע ושימוש בפרוטוקולי אבטחה מקובלים.</p>

        <h2 className="text-xl font-bold text-foreground">6. שמירת מידע</h2>
        <p>מידע אישי נשמר למשך הזמן הנדרש לצורך מתן השירות ובהתאם לדרישות החוק. קודי אימות נמחקים אוטומטית לאחר שעה.</p>

        <h2 className="text-xl font-bold text-foreground">7. זכויותיך</h2>
        <p>באפשרותך לפנות אלינו בכל עת כדי לבקש עיון, תיקון או מחיקת המידע האישי שלך.</p>

        <h2 className="text-xl font-bold text-foreground">8. יצירת קשר</h2>
        <p>לשאלות בנושא פרטיות, ניתן ליצור קשר בטלפון: <a href="tel:058-4633-555" className="text-primary hover:underline">058-4633-555</a></p>
      </section>

      <div className="mt-10">
        <a href="/" className="text-primary hover:underline font-bold">← חזרה לדף הראשי</a>
      </div>
    </div>
  </div>
);

export default PrivacyPolicy;
