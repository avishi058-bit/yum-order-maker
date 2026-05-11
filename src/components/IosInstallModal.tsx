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
              {/* Why explanation — visible immediately */}
              <div className="px-4 pt-4 pb-3 bg-gradient-to-b from-primary/10 to-transparent space-y-2 text-right">
                <p className="text-sm font-bold text-foreground">
                  למה כדאי להוסיף למסך הבית? 🤔
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  באייפון, התראות יגיעו אליך <b>רק</b> אם פתחת את הבקתה דרך האייקון במסך הבית 📱
                  אחרת, לא תדע מתי ההמבורגר שלך מוכן לאיסוף 🍔🔔
                </p>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 mt-2">
                  <p className="text-xs text-foreground leading-relaxed">
                    ⚠️ <b>חשוב:</b> אחרי ההוספה — היכנס בפעם הבאה דרך האייקון של <b>הבקתה</b> במסך הבית, ולא דרך הדפדפן.
                  </p>
                </div>
              </div>

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
