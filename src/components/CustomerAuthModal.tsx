import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, UserPlus, Loader2 } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { toast } from "@/hooks/use-toast";
import { validateIsraeliPhone } from "@/lib/utils";
import { modalAnimations } from "@/config/uiConfig";

interface CustomerAuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CustomerAuthModal = ({ open, onClose, onSuccess }: CustomerAuthModalProps) => {
  const { register, login } = useCustomerAuth();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setPhone("");
    setName("");
    setTermsAccepted(false);
    setMarketingConsent(false);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const cleaned = phone.replace(/[-\s]/g, "");
    if (cleaned.length < 9) {
      toast({ title: "אנא הכנס מספר טלפון תקין", variant: "destructive" });
      return;
    }
    if (!name.trim()) {
      toast({ title: "אנא הכנס שם מלא", variant: "destructive" });
      return;
    }
    if (!termsAccepted) {
      toast({ title: "יש לאשר את תנאי השימוש", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Always register — backend validates that phone matches the name
      // (returning users with the same name are treated as login).
      await register(phone, name.trim(), termsAccepted, marketingConsent);
      toast({ title: `ברוך הבא, ${name.trim().split(" ")[0]}! 🎉` });
      handleClose();
      onSuccess?.();
    } catch (err: any) {
      toast({ title: err.message || "שגיאה בהתחברות", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const anim = modalAnimations.default;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" dir="rtl">
          <motion.div
            {...anim.overlay}
            className="absolute inset-0 bg-black"
            onClick={handleClose}
          />
          <motion.div
            {...anim.content}
            transition={anim.content.transition}
            className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">התחברות לאזור האישי</h2>
              <button onClick={handleClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">הכנס מספר טלפון ושם כדי להיכנס ולצפות בהיסטוריית ההזמנות שלך</p>

              <div className="relative">
                <Phone size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="050-1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 rounded-xl border border-border bg-background text-foreground text-right"
                  autoFocus
                />
              </div>

              <div className="relative">
                <UserPlus size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="שם מלא"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 rounded-xl border border-border bg-background text-foreground text-right"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-border accent-primary"
                />
                <span className="text-sm text-foreground">
                  אני מאשר/ת את{" "}
                  <a href="/terms" target="_blank" className="text-primary hover:underline">תנאי השימוש</a>
                  {" "}ו
                  <a href="/privacy" target="_blank" className="text-primary hover:underline">מדיניות הפרטיות</a>
                  {" "}<span className="text-destructive">*</span>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-border accent-primary"
                />
                <span className="text-sm text-muted-foreground">
                  אני מאשר/ת קבלת עדכונים, מבצעים והנחות ב-WhatsApp (אופציונלי)
                </span>
              </label>

              <button
                onClick={handleSubmit}
                disabled={loading || !termsAccepted || !name.trim() || !phone.trim()}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                {loading ? "מתחבר..." : "כניסה"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CustomerAuthModal;
