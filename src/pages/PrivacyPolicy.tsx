import PrivacyContent from "@/components/PrivacyContent";

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-background py-12 px-4" dir="rtl">
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-black text-foreground mb-2">מדיניות פרטיות</h1>
      <p className="text-muted-foreground text-sm mb-8">עדכון אחרון: אפריל 2026</p>

      <PrivacyContent />

      <div className="mt-10">
        <a href="/" className="text-primary hover:underline font-bold">← חזרה לדף הראשי</a>
      </div>
    </div>
  </div>
);

export default PrivacyPolicy;
