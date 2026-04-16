const CookiePolicy = () => (
  <div className="min-h-screen bg-background py-12 px-4" dir="rtl">
    <div className="max-w-3xl mx-auto prose prose-invert">
      <h1 className="text-3xl font-black text-foreground mb-8">מדיניות עוגיות</h1>
      <p className="text-muted-foreground text-sm mb-6">עדכון אחרון: אפריל 2026</p>

      <section className="space-y-4 text-foreground/90">
        <h2 className="text-xl font-bold text-foreground">1. מהן עוגיות?</h2>
        <p>עוגיות (Cookies) הן קבצי טקסט קטנים שנשמרים על המכשיר שלך בעת ביקור באתר. הן מסייעות לאתר לזכור את ההעדפות שלך ולשפר את חוויית השימוש.</p>

        <h2 className="text-xl font-bold text-foreground">2. סוגי עוגיות בשימוש</h2>
        
        <h3 className="text-lg font-bold text-foreground">עוגיות הכרחיות</h3>
        <p>עוגיות אלו נדרשות לתפעול התקין של האתר:</p>
        <ul className="list-disc pr-6 space-y-1">
          <li><strong>אימות משתמש</strong> – שמירת מצב ההתחברות למערכת הניהול.</li>
          <li><strong>הגדרות נגישות</strong> – שמירת העדפות נגישות שבחרת (גודל טקסט, ניגודיות וכו').</li>
          <li><strong>מעקב הזמנה</strong> – שמירת מספר ההזמנה שלך לצורך מעקב בזמן אמת.</li>
        </ul>

        <h3 className="text-lg font-bold text-foreground">אחסון מקומי (Local Storage)</h3>
        <p>האתר משתמש באחסון מקומי של הדפדפן לשמירת:</p>
        <ul className="list-disc pr-6 space-y-1">
          <li>העדפות נגישות.</li>
          <li>סטטוס מעקב הזמנה פעילה.</li>
          <li>הסכמת עוגיות.</li>
        </ul>

        <h2 className="text-xl font-bold text-foreground">3. עוגיות צד שלישי</h2>
        <p>האתר אינו משתמש בעוגיות שיווקיות או פרסומיות. עוגיות צד שלישי מוגבלות לשירותי תשלום מאובטחים בלבד.</p>

        <h2 className="text-xl font-bold text-foreground">4. ניהול עוגיות</h2>
        <p>באפשרותך למחוק או לחסום עוגיות דרך הגדרות הדפדפן שלך. שים לב שחסימת עוגיות הכרחיות עלולה לפגוע בתפקוד האתר.</p>

        <h2 className="text-xl font-bold text-foreground">5. יצירת קשר</h2>
        <p>לשאלות בנושא עוגיות: <a href="tel:058-4633-555" className="text-primary hover:underline">058-4633-555</a></p>
      </section>

      <div className="mt-10">
        <a href="/" className="text-primary hover:underline font-bold">← חזרה לדף הראשי</a>
      </div>
    </div>
  </div>
);

export default CookiePolicy;
