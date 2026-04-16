import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, KeyRound, UserPlus, Loader2 } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { toast } from "@/hooks/use-toast";
import { modalAnimations } from "@/config/uiConfig";

interface CustomerAuthModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after successful auth (register or login) */
  onSuccess?: () => void;
}

type Step = "phone" | "otp" | "register";

const CustomerAuthModal = ({ open, onClose, onSuccess }: CustomerAuthModalProps) => {
  const { register, login } = useCustomerAuth();
  const [devMode, setDevMode] = useState(false);
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isExisting, setIsExisting] = useState(false);
  const [name, setName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep("phone");
    setPhone("");
    setOtpCode("");
    setIsExisting(false);
    setName("");
    setTermsAccepted(false);
    setMarketingConsent(false);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const sendOtp = async () => {
    const cleaned = phone.replace(/[-\s]/g, "");
    if (cleaned.length < 9) {
      toast({ title: "אנא הכנס מספר טלפון תקין", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-otp?action=send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ phone }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה בשליחת הקוד");

      setIsExisting(!!data.customerName);
      if (data.customerName) setName(data.customerName);
      toast({ title: "הקוד נשלח לוואטסאפ! 📱" });
      setStep("otp");
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otpCode.length !== 4) {
      toast({ title: "אנא הכנס קוד בן 4 ספרות", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-otp?action=verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ phone, code: otpCode }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "קוד שגוי");

      if (isExisting) {
        // Returning user — login directly
        await login(phone);
        toast({ title: `ברוך הבא בחזרה! 😊` });
        handleClose();
        onSuccess?.();
      } else {
        // New user — show registration form
        setStep("register");
      }
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
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
      await register(phone, name.trim(), termsAccepted, marketingConsent);
      toast({ title: `ברוך הבא, ${name.trim().split(" ")[0]}! 🎉` });
      handleClose();
      onSuccess?.();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
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
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">
                {step === "phone" && "התחברות"}
                {step === "otp" && "אימות"}
                {step === "register" && "הרשמה"}
              </h2>
              <button onClick={handleClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Phone step */}
              {step === "phone" && (
                <>
                  <p className="text-sm text-muted-foreground">הכנס מספר טלפון ונשלח לך קוד אימות בוואטסאפ</p>
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
                  <button
                    onClick={sendOtp}
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Phone size={18} />}
                    {loading ? "שולח..." : "שלח קוד אימות"}
                  </button>
                </>
              )}

              {/* OTP step */}
              {step === "otp" && (
                <>
                  <p className="text-sm text-muted-foreground">
                    הקוד נשלח ל-{phone}
                  </p>
                  <div className="relative">
                    <KeyRound size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="קוד 4 ספרות"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="w-full pl-4 pr-10 py-3 rounded-xl border border-border bg-background text-foreground text-center text-2xl tracking-[0.5em] font-bold"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={verifyOtp}
                    disabled={loading || otpCode.length !== 4}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
                    {loading ? "מאמת..." : "אמת קוד"}
                  </button>
                  <button
                    onClick={() => setStep("phone")}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    שנה מספר טלפון
                  </button>
                </>
              )}

              {/* Register step */}
              {step === "register" && (
                <>
                  <p className="text-sm text-muted-foreground">כמעט סיימנו! נשאר למלא כמה פרטים</p>
                  <div className="relative">
                    <UserPlus size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="שם מלא"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 rounded-xl border border-border bg-background text-foreground text-right"
                      autoFocus
                    />
                  </div>

                  {/* Terms checkbox */}
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
                      {" "}
                      <span className="text-destructive">*</span>
                    </span>
                  </label>

                  {/* Marketing checkbox */}
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
                    onClick={handleRegister}
                    disabled={loading || !termsAccepted || !name.trim()}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                    {loading ? "נרשם..." : "הרשמה וכניסה"}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CustomerAuthModal;
