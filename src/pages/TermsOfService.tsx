import TermsContent from "@/components/TermsContent";

const TermsOfService = () => (
  <div className="min-h-screen bg-background py-12 px-4" dir="rtl">
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-black text-foreground mb-8">תנאי שימוש</h1>
      <TermsContent />
      <div className="mt-10">
        <a href="/" className="text-primary hover:underline font-bold">← חזרה לדף הראשי</a>
      </div>
    </div>
  </div>
);

export default TermsOfService;
