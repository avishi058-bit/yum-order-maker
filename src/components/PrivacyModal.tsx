import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import PrivacyContent from "./PrivacyContent";

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

            <div className={`flex-1 overflow-y-auto px-6 py-5 ${isKiosk ? "text-lg" : "text-base"}`}>
              <p className="text-muted-foreground text-sm mb-4">עדכון אחרון: אפריל 2026</p>
              <PrivacyContent />
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
