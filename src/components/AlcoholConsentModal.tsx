import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface AlcoholConsentModalProps {
  open: boolean;
  isKiosk?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const AlcoholConsentModal = ({ open, isKiosk = false, onConfirm, onCancel }: AlcoholConsentModalProps) => {
  const [checked, setChecked] = useState(false);

  const handleConfirm = () => {
    if (!checked) return;
    setChecked(false);
    onConfirm();
  };

  const handleCancel = () => {
    setChecked(false);
    onCancel();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          dir="rtl"
          onClick={handleCancel}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
            className={`bg-card rounded-3xl shadow-2xl border border-border w-full ${
              isKiosk ? "max-w-xl p-10" : "max-w-md p-7"
            }`}
          >
            <div className="flex flex-col items-center text-center mb-5">
              <div className={`rounded-full bg-destructive/10 flex items-center justify-center mb-4 ${
                isKiosk ? "w-20 h-20" : "w-14 h-14"
              }`}>
                <AlertTriangle className={`text-destructive ${isKiosk ? "w-10 h-10" : "w-7 h-7"}`} />
              </div>
              <h2 className={`font-black text-foreground ${isKiosk ? "text-3xl" : "text-xl"}`}>
                אישור רכישת אלכוהול
              </h2>
            </div>

            <p className={`text-foreground/90 leading-relaxed mb-6 ${
              isKiosk ? "text-xl" : "text-sm"
            }`}>
              אני מאשר/ת כי אני מעל גיל 18 וקראתי והבנתי כי מסירת האלכוהול מותנית בהצגת תעודת זהות פיזית, ולא תתאפשר לאחר השעה 23:00.
            </p>

            <label
              className={`flex items-start gap-3 cursor-pointer select-none rounded-xl border-2 transition-colors ${
                checked ? "border-primary bg-primary/5" : "border-border bg-secondary/40"
              } ${isKiosk ? "p-5" : "p-4"}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className={`flex-none mt-0.5 accent-primary cursor-pointer ${
                  isKiosk ? "w-7 h-7" : "w-5 h-5"
                }`}
              />
              <span className={`text-foreground font-medium ${isKiosk ? "text-lg" : "text-sm"}`}>
                אני מאשר/ת את האמור לעיל
              </span>
            </label>

            <div className={`flex gap-3 ${isKiosk ? "mt-8" : "mt-6"}`}>
              <button
                onClick={handleCancel}
                className={`flex-1 rounded-xl border border-border bg-secondary/50 text-foreground font-bold hover:bg-secondary transition-colors ${
                  isKiosk ? "py-5 text-xl" : "py-3 text-base"
                }`}
              >
                ביטול
              </button>
              <button
                onClick={handleConfirm}
                disabled={!checked}
                className={`flex-1 rounded-xl font-black transition-all ${
                  checked
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:opacity-90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                } ${isKiosk ? "py-5 text-xl" : "py-3 text-base"}`}
              >
                המשך
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AlcoholConsentModal;
