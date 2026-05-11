import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, Home } from "lucide-react";
import addToHomeImg from "@/assets/add-to-home-screen-ios.jpeg";

interface Props {
  open: boolean;
  onClose: () => void;
  postInstallOpen?: boolean;
}

const IosInstallModal = ({ open, onClose, postInstallOpen = false }: Props) => {
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (open) setStep(postInstallOpen ? 2 : 1);
  }, [open, postInstallOpen]);

  const handleClose = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          dir="rtl"
        >
          <motion.div
            key={step}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-3xl shadow-2xl border border-border max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80"
                aria-label="סגור"
              >
                <X size={16} />
              </button>
              <h3 className="text-base font-black text-foreground">
                {step === 1 ? "הוספה למסך הבית 📲" : "כמעט סיימנו! 🔔"}
              </h3>
              <div className="w-8" />
            </div>

            {step === 1 ? (
              <>
                <div className="overflow-y-auto">
                  <motion.div
                    animate={{ rotate: [0, -1.2, 1.2, -1, 1, 0], scale: [1, 1.015, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }}
                    className="mx-3 mt-3 mb-2 rounded-2xl bg-gradient-to-br from-amber-500/20 via-primary/15 to-amber-500/10 border-2 border-amber-500/60 p-4 text-right shadow-lg"
                  >
                    <p className="text-base font-black text-foreground leading-tight mb-2">
                      ⚠️ חשוב שתדע! 👇
                    </p>
                    <p className="text-sm font-bold text-foreground leading-relaxed">
                      בלי להוסיף את <span className="text-primary">הבקתה</span> למסך הבית —
                      <span className="underline decoration-2 decoration-amber-500"> לא יגיעו אליך התראות</span> כשההזמנה מוכנה! 🍔🔔
                    </p>
                    <p className="text-sm font-bold text-foreground leading-relaxed mt-2 bg-amber-500/20 rounded-lg p-2">
                      📲 ואחרי ההוספה — <u>חובה להיכנס דרך האייקון</u> במסך הבית, ולא דרך הדפדפן!
                    </p>
                  </motion.div>

                  <div className="p-2 bg-white">
                    <img
                      src={addToHomeImg}
                      alt="הוראות להוספת הבקתה למסך הבית באייפון"
                      className="w-full h-auto rounded-2xl"
                    />
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-border">
                  <button
                    onClick={() => {
                      onClose();
                      window.setTimeout(() => {
                        window.dispatchEvent(new CustomEvent("open-post-install-instructions"));
                      }, 120);
                    }}
                    className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm"
                  >
                    הבנתי, אוסיף עכשיו
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="overflow-y-auto p-4 space-y-4 text-right">
                  <motion.div
                    animate={{ scale: [1, 1.03, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                    className="rounded-2xl bg-gradient-to-br from-primary/20 via-amber-500/15 to-primary/10 border-2 border-primary/60 p-5 shadow-lg"
                  >
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Home className="text-primary" size={28} />
                      <Bell className="text-amber-500" size={28} />
                    </div>
                    <p className="text-lg font-black text-foreground leading-tight mb-3 text-center">
                      לאחר שהוספתם את הבקתה למסך הבית 🏡
                    </p>
                    <p className="text-base font-extrabold text-foreground leading-relaxed bg-amber-500/20 rounded-xl p-3">
                      👉 <u className="decoration-2 decoration-primary">היכנסו דווקא דרך האייקון החדש</u> במסך הבית
                      <br />
                      <span className="block mt-2">
                        ✅ ו<span className="text-primary">אשרו את ההתראות</span> כשנשאלים!
                      </span>
                    </p>
                    <p className="text-sm font-bold text-foreground leading-relaxed mt-3 text-center">
                      וכך תוכלו להתעדכן <span className="text-primary">בזמן אמת</span> מה קורה עם ההזמנה שלכם 🍔⏱️
                    </p>
                  </motion.div>
                </div>
                <div className="px-4 py-3 border-t border-border flex gap-2">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 bg-muted text-foreground font-bold py-3 rounded-xl text-sm"
                  >
                    חזרה
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm"
                  >
                    הבנתי, תודה! 🙌
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IosInstallModal;
