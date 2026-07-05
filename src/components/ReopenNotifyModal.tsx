import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Check, Loader2, Download, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  isPushSupported,
  iosNeedsInstall,
  isStandalonePwa,
  subscribeReopenToPush,
} from "@/lib/push";

interface ReopenNotifyModalProps {
  open: boolean;
  onClose: () => void;
}

const STORAGE_KEY = "habakta_reopen_notify_registered";

const ReopenNotifyModal = ({ open, onClose }: ReopenNotifyModalProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    if (!open) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        setAlreadyRegistered(true);
      }
    } catch {}
    setNeedsInstall(iosNeedsInstall() || (!isStandalonePwa() && !isPushSupported()));
    setUnsupported(!isPushSupported() && !iosNeedsInstall());
  }, [open]);

  const handleEnable = async () => {
    setSubmitting(true);
    const res = await subscribeReopenToPush();
    setSubmitting(false);

    if (res.ok) {
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
      setDone(true);
      return;
    }
    if (res.reason === "ios_needs_install") {
      setNeedsInstall(true);
      return;
    }
    if (res.reason === "denied") {
      toast.error("צריך לאשר התראות בהגדרות הדפדפן");
      return;
    }
    if (res.reason === "unsupported") {
      setUnsupported(true);
      return;
    }
    toast.error("שגיאה בהפעלת ההתראות, נסו שוב");
  };

  const handleClose = () => {
    setDone(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleClose}
          dir="rtl"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-card rounded-2xl p-6 max-w-md w-full border border-border relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleClose}
              className="absolute top-3 left-3 p-2 rounded-full hover:bg-secondary transition-colors"
              aria-label="סגור"
            >
              <X size={18} />
            </button>

            {done || alreadyRegistered ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check size={32} className="text-green-600" />
                </div>
                <h3 className="text-xl font-black mb-2">
                  {alreadyRegistered && !done ? "כבר רשומים 🎉" : "הכל מוכן! 🎉"}
                </h3>
                <p className="text-muted-foreground text-sm">
                  נשלח לכם התראה למכשיר ברגע שנפתח שוב להזמנות
                </p>
                <button
                  onClick={handleClose}
                  className="mt-6 w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl"
                >
                  סגור
                </button>
              </div>
            ) : needsInstall ? (
              <>
                <div className="flex items-center gap-3 mb-4 pl-8">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-none">
                    <Smartphone size={22} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">קודם מתקינים את האפליקציה</h3>
                    <p className="text-xs text-muted-foreground">
                      כדי לקבל התראה כשנפתח שוב, צריך להתקין את הבקתה במסך הבית ולאשר התראות
                    </p>
                  </div>
                </div>
                <ol className="text-sm text-muted-foreground space-y-2 mb-5 mr-4 list-decimal">
                  <li>לחצו על הכפתור למטה כדי לפתוח את דף ההתקנה</li>
                  <li>הוסיפו את האפליקציה למסך הבית</li>
                  <li>פתחו אותה מהאייקון החדש וחזרו לכאן ללחוץ "הפעילו התראות"</li>
                </ol>
                <Link
                  to="/install"
                  onClick={handleClose}
                  className="w-full bg-primary text-primary-foreground font-black py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  להורדת האפליקציה
                </Link>
              </>
            ) : unsupported ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  הדפדפן הזה לא תומך בהתראות. נסו לפתוח את האתר בדפדפן אחר (Chrome / Safari עדכני).
                </p>
                <button
                  onClick={handleClose}
                  className="mt-6 w-full bg-secondary text-foreground font-bold py-3 rounded-xl"
                >
                  סגור
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4 pl-8">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-none">
                    <Bell size={22} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">עדכנו אותי כשנפתח שוב</h3>
                    <p className="text-xs text-muted-foreground">
                      נשלח התראה ישירות למכשיר ברגע שנפתח להזמנות — פעם אחת בלבד
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleEnable}
                  disabled={submitting}
                  className="mt-2 w-full bg-primary text-primary-foreground font-black py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Bell size={18} />}
                  הפעילו התראות
                </button>
                <p className="text-[11px] text-muted-foreground text-center mt-3">
                  לא נשמור מספר טלפון — רק התראה אחת כשהאתר נפתח שוב
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReopenNotifyModal;
