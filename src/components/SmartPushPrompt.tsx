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

const SmartPushPrompt = ({ open, phone, orderId, orderNumber, onAccept, onDismiss, inline = false }: SmartPushPromptProps) => {
  useEffect(() => {
    if (open) logEvent("shown", phone, orderId);
  }, [open, phone, orderId]);

  const card = (
    <motion.div
      initial={{ y: 20, opacity: 0, scale: 0.97 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 20, opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", damping: 24, stiffness: 320 }}
      className={
        inline
          ? "bg-card w-full rounded-2xl shadow-lg border border-border overflow-hidden"
          : "bg-card w-full sm:max-w-sm rounded-3xl shadow-2xl border border-border overflow-hidden"
      }
    >
      <div className={`relative bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-center ${inline ? "px-5 pt-5 pb-4" : "px-6 pt-8 pb-6"}`}>
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
          className={`inline-flex rounded-full bg-primary text-primary-foreground items-center justify-center shadow-lg shadow-primary/40 ${inline ? "w-14 h-14 mb-2" : "w-20 h-20 mb-3"}`}
        >
          <Bell size={inline ? 26 : 38} strokeWidth={2.2} />
        </motion.div>

        <h2 className={`font-black text-foreground leading-tight mb-1 ${inline ? "text-lg" : "text-2xl"}`}>
          לקבל התראה כשההזמנה מוכנה? 🍔
        </h2>
        <p className={`text-muted-foreground ${inline ? "text-xs" : "text-sm"}`}>
          נעדכן אותך רגע לפני שהזמנה #{orderNumber} מוכנה לאיסוף
        </p>
      </div>

      {!inline && (
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
      )}

      <div className={`space-y-2 ${inline ? "px-5 pb-5 pt-1" : "px-6 pb-6 pt-2"}`}>
        <button
          onClick={() => {
            logEvent("accepted", phone, orderId);
            onAccept();
          }}
          className={`w-full bg-primary text-primary-foreground font-black rounded-2xl shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-[0.98] transition-all ${inline ? "py-3 text-sm" : "py-4 text-base"}`}
        >
          כן, עדכנו אותי 🔔
        </button>
        <button
          onClick={() => {
            logEvent("dismissed", phone, orderId);
            onDismiss();
          }}
          className={`w-full text-muted-foreground font-medium rounded-2xl hover:text-foreground transition-colors ${inline ? "py-1.5 text-xs" : "py-2 text-sm"}`}
        >
          לא תודה, אבדוק לבד
        </button>
      </div>
    </motion.div>
  );

  if (inline) {
    return (
      <AnimatePresence>
        {open && <div dir="rtl">{card}</div>}
      </AnimatePresence>
    );
  }

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
          {card}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SmartPushPrompt;
