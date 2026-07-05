import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, Home, CheckCircle2 } from "lucide-react";
import StepInstallGuide from "./StepInstallGuide";

interface Props {
  open: boolean;
  onClose: () => void;
  postInstallOpen?: boolean;
}

const IosInstallModal = ({ open, onClose, postInstallOpen = false }: Props) => {
  const [phase, setPhase] = useState<"guide" | "done">(postInstallOpen ? "done" : "guide");

  useEffect(() => {
    if (open) setPhase(postInstallOpen ? "done" : "guide");
  }, [open, postInstallOpen]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          dir="rtl"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-3xl shadow-2xl border border-border max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-card flex items-center justify-between px-4 py-3 border-b border-border">
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80"
                aria-label="סגור"
              >
                <X size={16} />
              </button>
              <h3 className="text-base font-black text-foreground">
                {phase === "guide" ? "הוספה למסך הבית 📲" : "מעולה! הותקן ✅"}
              </h3>
              <div className="w-8" />
            </div>

            <div className="p-4">
              {phase === "guide" ? (
                <StepInstallGuide
                  onDone={() => setPhase("done")}
                  onClose={onClose}
                />
              ) : (
                <div className="text-center space-y-4">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                    className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center"
                  >
                    <CheckCircle2 size={52} className="text-green-600" />
                  </motion.div>
                  <h2 className="text-xl font-black text-foreground">כל הכבוד! 🎉</h2>
                  <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-4 text-right space-y-2">
                    <p className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Home className="text-primary" size={18} />
                      צאו מהדפדפן ופתחו את האייקון החדש במסך הבית
                    </p>
                    <p className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Bell className="text-amber-500" size={18} />
                      אשרו התראות — כך תדעו מתי ההזמנה מוכנה 🍔
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-full bg-primary text-primary-foreground font-black py-3.5 rounded-xl text-sm shadow-lg shadow-primary/30"
                  >
                    הבנתי 👍
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IosInstallModal;
