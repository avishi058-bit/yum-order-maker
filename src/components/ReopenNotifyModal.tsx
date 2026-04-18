import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";

interface ReopenNotifyModalProps {
  open: boolean;
  onClose: () => void;
}

const ReopenNotifyModal = ({ open, onClose }: ReopenNotifyModalProps) => {
  const { customer } = useCustomerAuth();
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [name, setName] = useState(customer?.name ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    const cleaned = phone.replace(/[\s-]/g, "");
    if (!/^0\d{8,9}$/.test(cleaned) && !/^\+?\d{9,15}$/.test(cleaned)) {
      toast.error("מספר טלפון לא תקין");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("reopen_notifications").insert({
      phone: cleaned,
      name: name.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("שגיאה ברישום, נסו שוב");
      return;
    }
    setDone(true);
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

            {done ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check size={32} className="text-green-600" />
                </div>
                <h3 className="text-xl font-black mb-2">נרשמת בהצלחה! 🎉</h3>
                <p className="text-muted-foreground text-sm">
                  נשלח לכם הודעה בוואטסאפ ברגע שנפתח שוב להזמנות
                </p>
                <button
                  onClick={handleClose}
                  className="mt-6 w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl"
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
                    <p className="text-xs text-muted-foreground">נשלח הודעה בוואטסאפ ברגע שנפתח</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">שם (אופציונלי)</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="השם שלכם"
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">מספר טלפון *</label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="050-1234567"
                      type="tel"
                      dir="ltr"
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-right"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !phone.trim()}
                  className="mt-5 w-full bg-primary text-primary-foreground font-black py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Bell size={18} />}
                  עדכנו אותי כשנפתח
                </button>
                <p className="text-[11px] text-muted-foreground text-center mt-3">
                  נשתמש במספר רק כדי להודיע על פתיחה מחדש
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
