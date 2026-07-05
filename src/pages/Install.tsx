import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Smartphone } from "lucide-react";
import { isStandalonePwa } from "@/lib/push";
import StepInstallGuide from "@/components/StepInstallGuide";

const Install = () => {
  const standalone = typeof window !== "undefined" ? isStandalonePwa() : false;
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    document.title = "התקנת היישום | הבקתה";
  }, []);

  if (standalone) {
    return <Navigate to="/" replace />;
  }

  if (installed) {
    return (
      <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card border-2 border-primary/40 rounded-3xl shadow-2xl max-w-md w-full p-6 text-center"
        >
          <CheckCircle2 className="mx-auto text-primary mb-3" size={64} />
          <h1 className="text-2xl font-black text-foreground mb-2">כל הכבוד! 🎉</h1>
          <p className="text-base font-bold text-foreground leading-relaxed">
            צאו מהדפדפן ופתחו את <span className="text-primary">הבקתה</span> דרך האייקון החדש במסך הבית 🏠
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            כך תוכלו לאשר התראות ולקבל עדכון מתי ההזמנה מוכנה 🔔🍔
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 p-4">
      <div className="max-w-md mx-auto py-6 space-y-5">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-amber-500 shadow-xl shadow-primary/40 mb-3"
          >
            <Smartphone className="text-primary-foreground" size={40} />
          </motion.div>
          <h1 className="text-3xl font-black text-foreground mb-2">
            התקינו את <span className="text-primary">הבקתה</span> 🍔
          </h1>
          <p className="text-base font-bold text-muted-foreground">
            נלווה אתכם שלב-שלב — קל, מהיר וברור 👌
          </p>
        </motion.div>

        <StepInstallGuide onDone={() => setInstalled(true)} />

        <p className="text-xs text-center text-muted-foreground leading-relaxed px-4">
          💡 מהאייקון החדש תקבלו התראות מתי ההזמנה מוכנה
        </p>
      </div>
    </div>
  );
};

export default Install;
