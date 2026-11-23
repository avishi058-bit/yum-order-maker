// Header sign-in: phone -> SMS code -> (name, only when we don't know it) -> welcome.
// Once signed in the customer stays signed in on this device until logout.
import { useEffect, useState } from "react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { toast } from "@/hooks/use-toast";
import { validateIsraeliPhone } from "@/lib/utils";
import { sendPhoneCode, verifyPhoneCode } from "@/lib/sms";
import { SignInSheet, SheetTitle, SheetSub, SheetButton, SheetFine, CodeBoxes, ResendLine } from "@/components/auth/SignInSheet";

interface CustomerAuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = "phone" | "code" | "name" | "done";

const CustomerAuthModal = ({ open, onClose, onSuccess }: CustomerAuthModalProps) => {
  const { register, signInVerified } = useCustomerAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sentAt, setSentAt] = useState(0);
  const [verified, setVerified] = useState(false);
  const [returning, setReturning] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) { setStep("phone"); setPhone(""); setName(""); setCode(""); setVerified(false); setReturning(false); setLoading(false); }
  }, [open]);

  if (!open) return null;

  const close = () => { onClose(); };
  const done = (finalName: string) => {
    if (verified) signInVerified(phone, finalName);
    else void register(phone, finalName, true, false);
    setName(finalName);
    setStep("done");
  };

  const send = async () => {
    const check = validateIsraeliPhone(phone);
    if (!check.valid) { toast({ title: check.error, variant: "destructive" }); return; }
    setLoading(true);
    try {
      const r = await sendPhoneCode(phone);
      if (r.result === "error") toast({ title: r.error, variant: "destructive" });
      else if (r.result === "sent") { if (!r.cooldown || !sentAt) setSentAt(Date.now()); setCode(""); setStep("code"); }
      else setStep("name"); // SMS unavailable right now: sign in on this device without the check
    } finally { setLoading(false); }
  };

  const verify = async (value: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const r = await verifyPhoneCode(phone, value);
      if (!r.ok) { toast({ title: r.error, variant: "destructive" }); setCode(""); return; }
      setVerified(true);
      const known = (r.name ?? "").trim();
      if (known) { signInVerified(phone, known); setName(known); setReturning(true); setStep("done"); }
      else setStep("name");
    } finally { setLoading(false); }
  };

  return (
    <SignInSheet labelledBy="signin-title" onClose={step === "done" ? undefined : close}>
      {step === "phone" && (
        <>
          <div className="w-14 h-14 rounded-2xl bg-[#f59e0b] mx-auto mb-4 flex items-center justify-center text-3xl" aria-hidden>🍔</div>
          <SheetTitle id="signin-title">מה המספר שלך?</SheetTitle>
          <SheetSub>נשלח קוד קצר ב-SMS, פעם אחת בלבד.<br />מאז נזכור אותך בכל הזמנה.</SheetSub>
          <label className="flex items-center mt-6 bg-white border border-[#e7e2dc] rounded-2xl px-4 py-3.5">
            <span className="text-[14px] text-[#a8a29e] w-14">נייד</span>
            <input type="tel" inputMode="tel" autoComplete="tel" autoFocus value={phone}
              onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="050-000-0000" dir="ltr"
              className="flex-1 bg-transparent text-[18px] text-right tracking-wide outline-none placeholder:text-[#c2bcb5]" />
          </label>
          <SheetButton onClick={send} disabled={loading || phone.replace(/\D/g, "").length < 10}>
            {loading ? "שולחים..." : "שליחת קוד"}
          </SheetButton>
          <SheetFine>
            בהמשך את/ה מאשר/ת את <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline text-[#78716c]">תנאי השימוש</a> ו<a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline text-[#78716c]">מדיניות הפרטיות</a>
          </SheetFine>
        </>
      )}

      {step === "code" && (
        <>
          <SheetTitle id="signin-title">הזן את הקוד</SheetTitle>
          <SheetSub>שלחנו 6 ספרות ל-<b dir="ltr" className="text-[#1c1917]">{phone}</b></SheetSub>
          <CodeBoxes value={code} onChange={setCode} onComplete={verify} disabled={loading} />
          {loading && <p className="text-[14px] text-[#a8a29e] text-center mt-4">מאמתים...</p>}
          <button type="button" onClick={() => setStep("phone")} className="block mx-auto text-[15px] font-semibold text-[#b45309] mt-5">שינוי מספר</button>
          <ResendLine sentAt={sentAt} onResend={() => { setSentAt(Date.now()); void send(); }} busy={loading} />
          <SheetFine>בהזנת הקוד את/ה מאשר/ת שנשמור את השם והטלפון שלך כדי לזכור אותך ולשלוח לך SMS כשההזמנה מוכנה. אפשר להתנתק בכל רגע ולבקש מחיקה.</SheetFine>
        </>
      )}

      {step === "name" && (
        <>
          <SheetTitle id="signin-title">נעים להכיר! איך קוראים לך?</SheetTitle>
          <SheetSub>השם יופיע על ההזמנות שלך.</SheetSub>
          <label className="flex items-center mt-6 bg-white border border-[#e7e2dc] rounded-2xl px-4 py-3.5">
            <span className="text-[14px] text-[#a8a29e] w-14">שם</span>
            <input type="text" autoComplete="name" autoFocus value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))} onKeyDown={(e) => e.key === "Enter" && name.trim() && done(name.trim())}
              placeholder="שם מלא"
              className="flex-1 bg-transparent text-[18px] outline-none placeholder:text-[#c2bcb5]" />
          </label>
          <SheetButton onClick={() => done(name.trim())} disabled={!name.trim()}>המשך</SheetButton>
        </>
      )}

      {step === "done" && (
        <>
          <div className="w-16 h-16 rounded-full bg-[#16a34a] text-white text-4xl mx-auto mb-4 flex items-center justify-center" aria-hidden>✓</div>
          <SheetTitle id="signin-title">{returning ? "ברוך שובך" : "ברוך הבא"}, {name.split(" ")[0]}</SheetTitle>
          <SheetSub>נשארת מחובר/ת במכשיר הזה.</SheetSub>
          <div className="flex items-center gap-3 mt-6 bg-white border border-[#e7e2dc] rounded-2xl px-4 py-3.5">
            <div className="w-10 h-10 rounded-full bg-[#fde7c4] text-[#b45309] font-black flex items-center justify-center">{name.trim()[0]}</div>
            <div>
              <div className="font-bold text-[16px]">{name}</div>
              <div className="text-[13px] text-[#a8a29e]" dir="ltr">{phone}</div>
            </div>
          </div>
          <SheetButton onClick={() => { close(); onSuccess?.(); }}>המשך להזמנה</SheetButton>
        </>
      )}
    </SignInSheet>
  );
};

export default CustomerAuthModal;
