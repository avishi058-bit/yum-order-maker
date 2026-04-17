/**
 * Shared Terms of Service content.
 * Used by both the standalone /terms page and the in-checkout TermsModal,
 * so the legal text stays in one place.
 */
const TermsContent = () => (
  <div className="space-y-4 text-foreground/90 leading-relaxed">
    <p className="text-muted-foreground text-sm">עדכון אחרון: אפריל 2026</p>

    <h2 className="text-xl font-bold text-foreground">1. כללי</h2>
    <p>ברוכים הבאים לאתר "הבקתה". השימוש באתר מהווה הסכמה לתנאים אלה. אם אינך מסכים לתנאים, אנא הימנע משימוש באתר.</p>

    <h2 className="text-xl font-bold text-foreground">2. השירות</h2>
    <p>האתר מאפשר הזמנת מנות ממסעדת הבקתה באופן מקוון. ההזמנות מותנות בזמינות המסעדה ובשעות הפעילות.</p>

    <h2 className="text-xl font-bold text-foreground">3. הזמנות ותשלום</h2>
    <ul className="list-disc pr-6 space-y-1">
      <li>המחירים באתר כוללים מע"מ כחוק.</li>
      <li>ההזמנה נחשבת סופית לאחר אישור המסעדה.</li>
      <li>התשלום מתבצע באמצעות כרטיס אשראי או מזומן, בהתאם לאפשרויות הזמינות.</li>
      <li>המסעדה רשאית לסרב להזמנה מכל סיבה שהיא.</li>
    </ul>

    <h2 className="text-xl font-bold text-foreground">4. ביטול הזמנה</h2>
    <p>ניתן לבטל הזמנה רק לפני שהמסעדה החלה בהכנתה. לאחר תחילת ההכנה, לא ניתן לבטל את ההזמנה.</p>

    <h2 className="text-xl font-bold text-foreground">5. אחריות</h2>
    <p>המסעדה אחראית לאיכות המוצרים המוגשים. האתר אינו אחראי לתקלות טכניות, עיכובים או נזקים שנגרמו עקב שימוש באתר.</p>

    <h2 className="text-xl font-bold text-foreground">6. קניין רוחני</h2>
    <p>כל התכנים באתר, כולל לוגו, תמונות, טקסטים ועיצוב, הם קניינה הבלעדי של הבקתה ואין להעתיקם ללא אישור.</p>

    <h2 className="text-xl font-bold text-foreground">7. שינויים בתנאים</h2>
    <p>הבקתה רשאית לעדכן תנאים אלה מעת לעת. שימוש באתר לאחר עדכון מהווה הסכמה לתנאים המעודכנים.</p>

    <h2 className="text-xl font-bold text-foreground">8. יצירת קשר</h2>
    <p>לשאלות בנושא תנאי השימוש: <a href="tel:058-4633-555" className="text-primary hover:underline">058-4633-555</a></p>
  </div>
);

export default TermsContent;
