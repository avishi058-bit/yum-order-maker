import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface PrivacyModalProps {
  open: boolean;
  onClose: () => void;
  isKiosk?: boolean;
}

/**
 * Reusable Privacy Policy modal — used inside the checkout flow so the
 * customer can read the privacy policy without leaving the order. Sized
 * larger on kiosk for touch comfort. Mirrors the structure of TermsModal
 * for visual consistency.
 */
const PrivacyModal = ({ open, onClose, isKiosk = false }: PrivacyModalProps) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // z-[60] sits above the CheckoutForm overlay (z-50)
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 22, stiffness: 220 }}
            className={`relative bg-card rounded-2xl border border-border shadow-2xl w-full overflow-hidden flex flex-col ${
              isKiosk ? "max-w-2xl max-h-[85vh]" : "max-w-lg max-h-[85vh]"
            }`}
          >
            <div className="flex-none flex items-center justify-between px-6 py-4 border-b border-border bg-card">
              <h2 className={`font-black text-foreground ${isKiosk ? "text-3xl" : "text-2xl"}`}>
                מדיניות פרטיות
              </h2>
              <button
                onClick={onClose}
                aria-label="סגור"
                className={`rounded-full hover:bg-secondary transition-colors flex items-center justify-center ${
                  isKiosk ? "w-12 h-12" : "w-9 h-9"
                }`}
              >
                <X size={isKiosk ? 28 : 20} />
              </button>
            </div>

            <div className={`flex-1 overflow-y-auto px-6 py-5 space-y-4 text-foreground/90 ${isKiosk ? "text-lg" : "text-base"}`}>
              <p className="text-muted-foreground text-sm">עדכון אחרון: אפריל 2026</p>

              <h3 className="text-xl font-bold text-foreground">1. כללי</h3>
              <p>אתר "המבורגר הבקתה" (להלן: "האתר") מכבד את פרטיותך ומחויב להגן על המידע האישי שלך. מדיניות זו מסבירה אילו נתונים נאספים, כיצד הם משמשים ואיך אנחנו מגנים עליהם.</p>

              <h3 className="text-xl font-bold text-foreground">2. מידע שאנו אוספים</h3>
              <ul className="list-disc pr-6 space-y-1">
                <li>שם מלא ומספר טלפון – לצורך ביצוע הזמנות ויצירת קשר.</li>
                <li>פרטי הזמנה – מוצרים שנבחרו, תוספות, הערות, שיטת תשלום וסטטוס.</li>
                <li>נתוני שימוש טכניים – לצורך שיפור חוויית המשתמש.</li>
              </ul>

              <h3 className="text-xl font-bold text-foreground">3. שימוש במידע</h3>
              <ul className="list-disc pr-6 space-y-1">
                <li>עיבוד והכנת ההזמנה.</li>
                <li>יצירת קשר לגבי ההזמנה.</li>
                <li>שיפור השירות וחוויית המשתמש.</li>
                <li>עמידה בדרישות חוקיות.</li>
              </ul>

              <h3 className="text-xl font-bold text-foreground">4. שיתוף מידע</h3>
              <p>איננו מוכרים או משתפים מידע אישי עם צדדים שלישיים, למעט ספקי סליקה לצורך עיבוד תשלום, ספק שירותי הודעות (WhatsApp) לצורך אימות, או כנדרש על פי חוק.</p>

              <h3 className="text-xl font-bold text-foreground">5. אבטחת מידע</h3>
              <p>אנו נוקטים באמצעי אבטחה סבירים, אך לא ניתן להבטיח הגנה מוחלטת מפני גישה בלתי מורשית.</p>

              <h3 className="text-xl font-bold text-foreground">6. עוגיות (Cookies)</h3>
              <p>האתר עושה שימוש בעוגיות לצורך תפעול תקין, שיפור חוויית המשתמש וניתוח נתונים. למידע מלא ראו עמוד מדיניות העוגיות.</p>

              <h3 className="text-xl font-bold text-foreground">7. זכויותיך</h3>
              <p>באפשרותך לפנות אלינו לעיון, תיקון או מחיקת המידע האישי שלך.</p>

              <h3 className="text-xl font-bold text-foreground">8. יצירת קשר</h3>
              <p>
                📧 <a href="mailto:avishi058@gmail.com" className="text-primary hover:underline">avishi058@gmail.com</a>
                <br />
                📞 <a href="tel:058-4633555" className="text-primary hover:underline">058-4633555</a>
              </p>
            </div>

            <div className="flex-none px-6 py-4 border-t border-border bg-card">
              <button
                onClick={onClose}
                className={`w-full bg-primary text-primary-foreground font-bold rounded-full hover:opacity-90 transition-opacity ${
                  isKiosk ? "py-5 text-xl" : "py-3 text-base"
                }`}
              >
                הבנתי, חזרה להזמנה
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PrivacyModal;
