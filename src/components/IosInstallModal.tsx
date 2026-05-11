import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import addToHomeImg from "@/assets/add-to-home-screen-ios.png";

interface Props {
  open: boolean;
  onClose: () => void;
}

const IosInstallModal = ({ open, onClose }: Props) => {
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
            className="bg-card rounded-3xl shadow-2xl border border-border max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80"
                aria-label="סגור"
              >
                <X size={16} />
              </button>
              <h3 className="text-base font-black text-foreground">הוספה למסך הבית 📲</h3>
              <div className="w-8" />
            </div>

            <div className="overflow-y-auto">
              {/* Why explanation — bold, prominent, with subtle wiggle */}
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
                onClick={onClose}
                className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm"
              >
                הבנתי, אוסיף עכשיו
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IosInstallModal;
