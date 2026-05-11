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
              <h3 className="text-base font-black text-foreground">הוספה למסך הבית</h3>
              <div className="w-8" />
            </div>
            <div className="overflow-y-auto p-2 bg-white">
              <img
                src={addToHomeImg}
                alt="הוראות להוספת הבקתה למסך הבית באייפון"
                className="w-full h-auto rounded-2xl"
              />
            </div>
            <div className="px-4 py-3 border-t border-border space-y-3">
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-right">
                <p className="text-sm font-bold text-foreground">💡 טיפ קטן</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  אחרי שתוסיף — בפעם הבאה היכנס דרך האייקון של <b>הבקתה</b> במסך הבית.
                  ככה תקבל התראה ברגע שההזמנה שלך מוכנה לאיסוף 🔔
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm"
              >
                הבנתי
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IosInstallModal;
