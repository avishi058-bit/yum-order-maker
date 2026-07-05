import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SmartPushPromptProps {
  open: boolean;
  phone: string;
  orderId?: string | null;
  orderNumber: number;
  onAccept: () => void;
  onDismiss: () => void;
  /** When true, renders as an inline card instead of a full-screen modal. */
  inline?: boolean;
}

const logEvent = (action: "shown" | "accepted" | "dismissed" | "denied", phone: string, orderId?: string | null) => {
  try {
    const fp = localStorage.getItem("device_fp") || (() => {
      const f = crypto.randomUUID();
      localStorage.setItem("device_fp", f);
      return f;
    })();
    supabase.from("notification_prompts").insert({
      phone,
      device_fingerprint: fp,
      order_id: orderId ?? null,
      action,
    }).then(() => {}, () => {});
  } catch {}
};

const SmartPushPrompt = ({ open, phone, orderId, orderNumber, onAccept, onDismiss }: SmartPushPromptProps) => {
  useEffect(() => {
    if (open) logEvent("shown", phone, orderId);
  }, [open, phone, orderId]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          dir="rtl"
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            className="bg-card w-full sm:max-w-sm rounded-3xl shadow-2xl border border-border overflow-hidden"
          >
            <div className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-transparent px-6 pt-8 pb-6 text-center">
              <button
                onClick={() => {
                  logEvent("dismissed", phone, orderId);
                  onDismiss();
                }}
                className="absolute top-3 left-3 w-8 h-8 rounded-full bg-background/60 hover:bg-background flex items-center justify-center transition-colors"
                aria-label="סגור"
              >
                <X size={16} />
              </button>

              <motion.div
                animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2 }}
                className="inline-flex w-20 h-20 rounded-full bg-primary text-primary-foreground items-center justify-center mb-3 shadow-lg shadow-primary/40"
              >
                <Bell size={38} strokeWidth={2.2} />
              </motion.div>

              <h2 className="text-2xl font-black text-foreground leading-tight mb-1">
                נעדכן אותך רגע לפני שההמבורגר מוכן 🍔
              </h2>
              <p className="text-sm text-muted-foreground">
                בלי להסתכל על המסך — נשלח לך התראה כשהזמנה #{orderNumber} תהיה מוכנה לאיסוף
              </p>
            </div>

            <div className="px-6 py-4 space-y-2.5">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚡</span>
                <p className="text-sm text-foreground font-medium">התראה מיידית ברגע שמוכן</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl">🔕</span>
                <p className="text-sm text-foreground font-medium">רק לגבי ההזמנה שלך — בלי ספאם</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl">👋</span>
                <p className="text-sm text-foreground font-medium">אפשר לבטל בכל רגע</p>
              </div>
            </div>

            <div className="px-6 pb-6 pt-2 space-y-2">
              <button
                onClick={() => {
                  logEvent("accepted", phone, orderId);
                  onAccept();
                }}
                className="w-full bg-primary text-primary-foreground font-black py-4 rounded-2xl text-base shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-[0.98] transition-all"
              >
                כן, עדכנו אותי 🔔
              </button>
              <button
                onClick={() => {
                  logEvent("dismissed", phone, orderId);
                  onDismiss();
                }}
                className="w-full text-muted-foreground font-medium py-2 rounded-2xl text-sm hover:text-foreground transition-colors"
              >
                לא תודה, אבדוק לבד
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SmartPushPrompt;
