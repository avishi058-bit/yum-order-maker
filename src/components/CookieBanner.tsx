import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";

const COOKIE_KEY = "habakta_cookie_consent";

const CookieBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(COOKIE_KEY, "declined");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 inset-x-0 z-[100] p-4"
          dir="rtl"
        >
          <div className="max-w-lg mx-auto bg-card border border-border rounded-2xl shadow-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Cookie size={20} className="text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-foreground text-sm mb-1">האתר משתמש בעוגיות 🍪</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  אנו משתמשים בעוגיות הכרחיות לתפעול האתר ולשמירת ההעדפות שלך. 
                  <a href="/cookie-policy" className="text-primary hover:underline mr-1">מדיניות עוגיות</a>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={accept}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    אישור
                  </button>
                  <button
                    onClick={decline}
                    className="px-4 py-2 bg-muted text-muted-foreground rounded-xl text-xs font-medium hover:bg-secondary transition-colors"
                  >
                    דחייה
                  </button>
                </div>
              </div>
              <button onClick={decline} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieBanner;
