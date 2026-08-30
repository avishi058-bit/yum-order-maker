const About = () => (
  <div className="min-h-screen bg-background py-12 px-4" dir="rtl">
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-black text-foreground mb-6">אודות — המבורגר הבקתה</h1>

      <section className="space-y-5 text-foreground/90 leading-relaxed">
        <p>
          "המבורגר הבקתה" הוא עסק משפחתי במושב תושיה שבעוטף עזה, המתמחה בהמבורגרים טריים
          מבשר איכותי של שדות נגב, כשר בהשגחת הרבנות. כל מנה מוכנה במקום, טרייה, לפי ההזמנה.
        </p>
        <p>
          אנחנו מארחים לקוחות פרטיים, משפחות, קבוצות וסיורים באזור העוטף, ומספקים גם אירועים
          וארוחות קבוצתיות בתיאום מראש. הבקתה נמצאת בלב האזור החקלאי, עם ישיבה בחוץ, חניה נוחה
          ואווירה ביתית.
        </p>

        <h2 className="text-xl font-bold text-foreground pt-2">מה אנחנו מציעים</h2>
        <ul className="list-disc pr-6 space-y-1">
          <li>המבורגרים טריים, עראיס, מנות צד ומשקאות</li>
          <li>הזמנה מקוונת לאיסוף עצמי או ישיבה במקום</li>
          <li>אירועים פרטיים וארוחות לקבוצות וסיורים</li>
        </ul>

        <h2 className="text-xl font-bold text-foreground pt-2">פרטי העסק</h2>
        <ul className="list-none space-y-1">
          <li><strong>שם העסק:</strong> המבורגר הבקתה — שלזינגר אבישי-אברהם, עוסק מורשה</li>
          <li><strong>ח.פ / ע.מ:</strong> 213877103</li>
          <li><strong>כתובת:</strong> ערבי הנחל 22, תושיה</li>
          <li><strong>מדינה:</strong> ישראל</li>
          <li>
            <strong>טלפון:</strong>{" "}
            <a href="tel:0584633555" className="text-primary hover:underline">058-4633555</a>
          </li>
          <li>
            <strong>דוא״ל:</strong>{" "}
            <a href="mailto:avishi058@gmail.com" className="text-primary hover:underline">avishi058@gmail.com</a>
          </li>
        </ul>
      </section>

      <div className="mt-10">
        <a href="/" className="text-primary hover:underline font-bold">← חזרה לדף הראשי</a>
      </div>
    </div>
  </div>
);

export default About;
