import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, UserPlus, Loader2 } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { toast } from "@/hooks/use-toast";
import { validateIsraeliPhone } from "@/lib/utils";
import { modalAnimations } from "@/config/uiConfig";
import { sendPhoneCode, verifyPhoneCode, isPhoneVerified } from "@/lib/sms";

interface CustomerAuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CustomerAuthModal = ({ open, onClose, onSuccess }: CustomerAuthModalProps) => {
  const { register, signInVerified } = useCustomerAuth();
  // Sign-in asks for an SMS code (once; it stays signed in until logout). A
  // returning customer gets his name back from his last order.
  const [codeStep, setCodeStep] = useState(false);
  const [code, setCode] = useState("");
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
    setCodeStep(false);
    setCode("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const finish = async (finalName: string, verified: boolean) => {
    if (verified) {
      signInVerified(phone, finalName);
      try {
        if (marketingConsent) localStorage.setItem("habakta_marketing_pending", JSON.stringify({ phone, consent: true }));
      } catch { /* optional */ }
    } else {
      // SMS not available right now: device-only sign-in, as before.
      await register(phone, finalName, termsAccepted, marketingConsent);
    }
    toast({ title: `ברוך הבא, ${finalName.split(" ")[0]}! 🎉` });
    handleClose();
    onSuccess?.();
  };

  const handleSubmit = async () => {
    const phoneCheck = validateIsraeliPhone(phone);
    if (!phoneCheck.valid) {
      toast({ title: phoneCheck.error, variant: "destructive" });
      return;
    }
    if (!termsAccepted) {
      toast({ title: "יש לאשר את תנאי השימוש", variant: "destructive" });
      return;
    }
    if (isPhoneVerified(phone) && name.trim()) {
      await finish(name.trim(), true);
      return;
    }
    setLoading(true);
    try {
      const r = await sendPhoneCode(phone);
      if (r.result === "error") {
        toast({ title: r.error, variant: "destructive" });
      } else if (r.result === "sent") {
        setCodeStep(true);
      } else if (name.trim()) {
        await finish(name.trim(), false);
      } else {
        toast({ title: "אנא הכנס שם מלא", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (value = code) => {
    if (value.length !== 6 || loading) return;
    setLoading(true);
    try {
      const r = await verifyPhoneCode(phone, value);
      if (!r.ok) {
        toast({ title: r.error, variant: "destructive" });
        return;
      }
      const finalName = name.trim() || (r.name ?? "").trim();
      if (!finalName) {
        // New customer who left the name empty: ask for it, the phone is already checked.
        setCodeStep(false);
        toast({ title: "המספר אומת ✅ נשאר רק להכניס שם", variant: "default" });
        return;
      }
      await finish(finalName, true);
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
              <h2 className="text-lg font-bold text-foreground">חיבור חד-פעמי לאפליקציה</h2>
              <button onClick={handleClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            {codeStep ? (
              <div className="p-5 space-y-4 text-center">
                <p aria-hidden className="text-5xl">📱</p>
                <p className="text-lg font-black text-foreground">שלחנו לך קוד ב-SMS</p>
                <p className="text-sm text-muted-foreground">הקלד/י את 6 הספרות שנשלחו למספר <span dir="ltr" className="font-bold">{phone}</span></p>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setCode(v);
                    if (v.length === 6) handleVerify(v);
                  }}
                  dir="ltr"
                  placeholder="______"
                  aria-label="קוד אימות"
                  className="w-full py-3 rounded-xl border border-border bg-background text-foreground text-center text-2xl tracking-[0.5em] font-bold"
                />
                <button
                  onClick={() => handleVerify()}
                  disabled={loading || code.length !== 6}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={18} className="animate-spin" />}
                  {loading ? "מאמת..." : "אימות וכניסה"}
                </button>
                <button onClick={() => { setCodeStep(false); setCode(""); }} className="text-sm text-muted-foreground underline">
                  חזרה / שינוי מספר
                </button>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  בהזנת הקוד את/ה מאשר/ת שנשמור את השם והטלפון שלך כדי לזכור אותך ולשלוח לך SMS כשההזמנה מוכנה. אפשר להתנתק בכל רגע ולבקש מחיקה.
                </p>
              </div>
            ) : (
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-foreground font-medium">
                  כדי שנוכל לעדכן אותך מתי ההמבורגר מוכן 🍔
                </p>
                <p className="text-sm text-muted-foreground">
                  נשלח לך קוד ב-SMS לאימות חד-פעמי, ומאז תישאר/י מחובר/ת והפרטים יתמלאו לבד בכל הזמנה :)
                </p>
              </div>

              <div className="relative">
                <Phone size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="0501234567"
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
                  placeholder="שם מלא (הזמנת אצלנו בעבר? נמלא לבד)"
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
                disabled={loading || !termsAccepted || !phone.trim()}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                {loading ? "מתחבר..." : "כניסה"}
              </button>
            </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CustomerAuthModal;
