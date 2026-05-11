import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Share, Plus, MoreVertical, Download, CheckCircle2, Smartphone } from "lucide-react";
import { isIos, isStandalonePwa } from "@/lib/push";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import addToHomeImg from "@/assets/add-to-home-screen-ios.jpeg";

const Install = () => {
  const iOS = typeof window !== "undefined" ? isIos() : false;
  const standalone = typeof window !== "undefined" ? isStandalonePwa() : false;
  const { canPrompt, promptInstall } = useInstallPrompt();
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    document.title = "התקנת היישום | הבקתה";
  }, []);

  useEffect(() => {
    const handler = () => setInstalled(true);
    window.addEventListener("appinstalled", handler);
    return () => window.removeEventListener("appinstalled", handler);
  }, []);

  const handleInstall = async () => {
    const result = await promptInstall();
    if (result === "accepted") setInstalled(true);
  };

  // Already installed — direct user to open from home screen
  if (standalone || installed) {
    return (
      <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card border-2 border-primary/40 rounded-3xl shadow-2xl max-w-md w-full p-6 text-center"
        >
          <CheckCircle2 className="mx-auto text-primary mb-3" size={64} />
          <h1 className="text-2xl font-black text-foreground mb-2">היישום מותקן! ✅</h1>
          <p className="text-base font-bold text-foreground leading-relaxed">
            צא/י מהדפדפן והיכנס/י ל<span className="text-primary">הבקתה</span> דרך האייקון במסך הבית 🏠
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            רק כך תוכל/י לאשר התראות ולקבל עדכון מתי ההזמנה מוכנה 🔔🍔
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 p-4">
      <div className="max-w-md mx-auto py-6 space-y-5">
        {/* Hero */}
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
            התקן/י את <span className="text-primary">הבקתה</span> 🍔
          </h1>
          <p className="text-base font-bold text-muted-foreground">
            הזמנות מהירות + התראות כשההמבורגר שלך מוכן 🔔
          </p>
        </motion.div>

        {/* Why install */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-gradient-to-br from-amber-500/15 via-primary/10 to-amber-500/5 border-2 border-amber-500/50 p-4 text-right shadow-lg"
        >
          <p className="text-sm font-bold text-foreground leading-relaxed">
            ⚡ גישה מהירה ממסך הבית
            <br />
            🔔 התראה רגעית כשההזמנה מוכנה
            <br />
            🍔 שמירת מועדפים והזמנה בלחיצה
          </p>
        </motion.div>

        {/* Instructions per platform */}
        {iOS ? (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-card border-2 border-border rounded-2xl overflow-hidden shadow-lg"
          >
            <div className="px-4 py-3 bg-primary/10 border-b border-border">
              <h2 className="text-base font-black text-foreground text-right">
                הוספה למסך הבית (אייפון) 📲
              </h2>
            </div>
            <div className="p-3 bg-white">
              <img
                src={addToHomeImg}
                alt="הוראות להוספת הבקתה למסך הבית באייפון"
                className="w-full h-auto rounded-xl"
              />
            </div>
            <div className="p-4 space-y-2 text-right">
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                <Share className="text-primary" size={18} />
                לחצ/י על כפתור השיתוף בסרגל התחתון
              </p>
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                <Plus className="text-primary" size={18} />
                בחר/י "הוסף למסך הבית"
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-card border-2 border-border rounded-2xl shadow-lg"
          >
            <div className="px-4 py-3 bg-primary/10 border-b border-border rounded-t-2xl">
              <h2 className="text-base font-black text-foreground text-right">
                התקנת היישום (אנדרואיד) 📲
              </h2>
            </div>
            <div className="p-4 space-y-3 text-right">
              {canPrompt ? (
                <>
                  <p className="text-sm font-bold text-foreground leading-relaxed">
                    לחצ/י על הכפתור למטה כדי להתקין את הבקתה ישירות במסך הבית 👇
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={handleInstall}
                    className="w-full bg-primary text-primary-foreground font-black py-4 rounded-xl text-base shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
                  >
                    <Download size={20} />
                    התקן/י עכשיו
                  </motion.button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-sm">1</div>
                    <p className="text-sm font-bold text-foreground leading-relaxed flex-1 flex items-center gap-1 flex-wrap">
                      לחצ/י על תפריט הדפדפן
                      <MoreVertical size={16} className="inline text-primary" />
                      (שלוש נקודות בפינה)
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-sm">2</div>
                    <p className="text-sm font-bold text-foreground leading-relaxed flex-1">
                      בחר/י <span className="text-primary">"הוסף למסך הבית"</span>
                      <Plus size={14} className="inline mx-1 text-primary" />
                      ואשר/י
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-sm">3</div>
                    <p className="text-sm font-bold text-foreground leading-relaxed flex-1">
                      פתח/י את הבקתה דרך <span className="text-primary">האייקון במסך הבית</span> 🏠
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-xs text-center text-muted-foreground leading-relaxed px-4"
        >
          💡 חובה להיכנס דרך האייקון במסך הבית כדי לקבל התראות מתי ההזמנה מוכנה
        </motion.p>
      </div>
    </div>
  );
};

export default Install;
