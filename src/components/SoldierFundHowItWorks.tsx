// "הזמן חייל/ת" — dialog: how it works + donor regulation (תקנון) and,
// from the entry page, a direct donation picker.
// Rendered as its own full-screen layer (very high z-index) so it always
// opens ABOVE the checkout window. Approval is logged server-side through
// create-order (consent_events) when the donation is actually charged.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export const SOLDIER_FUND_TERMS_VERSION = "soldier-fund-v1";
export const SOLDIER_FUND_PRESETS = [5, 10, 20, 30, 40, 50, 60];
export const SOLDIER_FUND_MAX = 1000;
/** sessionStorage handoff of a donation picked on the entry page. */
export const SOLDIER_PENDING_KEY = "soldier-pending-donation-v1";

// Full regulation shown in the dialog. NOTE: draft — replace with the final
// wording from the owner when provided.
export const SOLDIER_FUND_TERMS_TEXT = [
  "1. מהי הקופה — קופת 'הזמן חייל/ת' של המבורגר הבקתה נועדה להאכיל ולפנק חיילים וחיילות שמגיעים אלינו.",
  "2. אופן התרומה — בוחרים סכום (5, 10, 20, 30, 40, 50, 60 ₪ או סכום אחר עד 1,000 ₪), יחד עם הזמנה או כתשלום נפרד. הסכום מחויב באמצעי התשלום שנבחר.",
  "3. ייעוד הכסף — הכסף ישמש אך ורק לרכישת אוכל והטבות לחיילים וחיילות בהבקתה. חייל/ת שמגיע/ה לבקתה מקבל/ת אוכל מהקופה בהתאם לשיקול העסק.",
  "4. שקיפות — סך הכסף שנאסף ומספר החיילים שנהנו מוצגים לציבור באתר.",
  "5. חשוב לדעת — זו אינה תרומה לעמותה ואינה מוכרת לצרכי זיכוי מס. מדובר בתשלום מוקדם עבור ארוחות שיוגשו לחיילים.",
  "6. ביטול והחזר — ניתן לבקש ביטול של סכום שטרם נוצל בפנייה ישירה לעסק. סכום שכבר שימש להאכלת חיילים אינו ניתן להחזר.",
  "7. ניהול ובקרה — הקופה מנוהלת על ידי הבקתה בלבד; כל כניסה ויציאה של כספים נרשמת ומבוקרת.",
  "8. אישור — תרומה מתבצעת רק לאחר אישור תקנון זה. האישור נרשם ונשמר כהוכחה.",
].join("\n");

export const SOLDIER_FUND_APPROVAL_TEXT =
  "אני מאשר/ת שקראתי והבנתי את תקנון 'הזמן חייל/ת': הסכום שאבחר מתווסף לתשלום על ההזמנה, " +
  "יישמר בקופת 'הזמן חייל/ת' וישמש להאכלה ופינוק של חיילים שמגיעים לבקתה. זו אינה תרומה מוכרת לצרכי מס.";

interface DonateOptions {
  /** Whether the customer can currently place a food order. */
  canOrder: boolean;
  onContinueOrder: (amount: number) => void;
  onDonateOnly: (amount: number) => void;
}

interface SoldierFundHowItWorksProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approved: boolean;
  onApprove: () => void;
  /** When set, the dialog also lets the customer pick an amount and pay. */
  donate?: DonateOptions;
}

export default function SoldierFundHowItWorks({ open, onOpenChange, approved, onApprove, donate }: SoldierFundHowItWorksProps) {
  const [checked, setChecked] = useState(approved);
  const [amount, setAmount] = useState(0);
  const [custom, setCustom] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    if (open) setChecked(approved);
  }, [open, approved]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  const approve = (v: boolean) => {
    setChecked(v);
    if (v) onApprove();
  };
  const pick = (v: number) => { setCustom(""); setAmount(amount === v ? 0 : v); };
  const onCustom = (s: string) => {
    const clean = s.replace(/[^\d]/g, "").slice(0, 4);
    setCustom(clean);
    setAmount(Math.min(SOLDIER_FUND_MAX, Number(clean) || 0));
  };
  const isApproved = approved || checked;
  const canPay = amount > 0 && isApproved;

  return createPortal(
    <div
      className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/70 p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="הזמן חייל/ת"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl bg-background text-foreground p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="סגירה"
          className="absolute left-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-3xl font-black text-center">🫡 הזמן חייל/ת</h2>

        {/* צעדים גדולים ושיווקיים — בלי כיתוב מיותר */}
        <div className="py-3 text-center space-y-1">
          {[
            "בוחרים סכום",
            "הכסף נשמר בקופה מיוחדת לחיילים",
            "חייל/ת שמגיע/ה אלינו מקבל/ת אוכל 💚",
          ].map((step, i) => (
            <div key={step}>
              <div className="text-2xl md:text-3xl font-black leading-snug">{step}</div>
              {i < 2 && <div className="text-xl font-black text-primary py-0.5">⬇️</div>}
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowAbout((v) => !v)}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
          >
            מה זה המיזם? 💚
          </button>
          {showAbout && (
            <p className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm leading-relaxed text-right">
              מיזם "הזמן חייל/ת" מאפשר ללקוחות להוסיף סכום לקופת החיילים, אשר מיועדת למימון אוכל עבור חיילים וחיילות המגיעים לבקתה.
            </p>
          )}
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowTerms((v) => !v)}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
          >
            {showTerms ? "הסתרת התקנון" : "רוצים לקרוא את התקנון? 📜"}
          </button>
          {showTerms && (
            <div className="mt-2 rounded-xl border bg-muted/40 p-3 whitespace-pre-line text-xs leading-relaxed max-h-48 overflow-y-auto text-right">
              {SOLDIER_FUND_TERMS_TEXT}
            </div>
          )}
        </div>

        <label className={`flex items-start gap-2 cursor-pointer text-sm rounded-xl border-2 p-3 ${isApproved ? "border-primary/40 bg-primary/5" : "border-destructive/50 bg-destructive/5"}`}>
          <input
            type="checkbox"
            checked={isApproved}
            disabled={approved}
            onChange={(e) => approve(e.target.checked)}
            className="mt-1 w-5 h-5 accent-primary shrink-0"
          />
          <span>
            {SOLDIER_FUND_APPROVAL_TEXT}
            {!isApproved && <span className="text-destructive font-bold"> — חובה</span>}
          </span>
        </label>

        {donate ? (
          <div className="space-y-3">
            <div className="font-bold">כמה להוסיף?</div>
            <div className="grid grid-cols-4 gap-2">
              {SOLDIER_FUND_PRESETS.map((v) => (
                <button key={v} type="button" onClick={() => pick(v)}
                  className={`rounded-lg border py-2 font-bold ${amount === v && !custom ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                  ₪{v}
                </button>
              ))}
              <input
                type="text" inputMode="numeric" placeholder="אחר"
                value={custom} onChange={(e) => onCustom(e.target.value)}
                className="rounded-lg border bg-background p-2 text-center"
                aria-label={`סכום אחר עד ₪${SOLDIER_FUND_MAX}`}
              />
            </div>
            {!canPay && (
              <p className="text-xs text-center text-muted-foreground">
                {amount === 0 ? "בחרו סכום" : "יש לאשר את התקנון כדי להמשיך"}
              </p>
            )}
            {donate.canOrder && (
              <button
                type="button" disabled={!canPay}
                onClick={() => donate.onContinueOrder(amount)}
                className="w-full py-3 rounded-full font-black text-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              >
                הוסיפו ₪{amount || 0} והמשיכו להזמנה 🍔
              </button>
            )}
            <button
              type="button" disabled={!canPay}
              onClick={() => donate.onDonateOnly(amount)}
              className="w-full py-3 rounded-full font-black text-lg border-2 border-primary text-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              רק 'הזמן חייל/ת' — לתשלום ₪{amount || 0} 💳
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full py-3 rounded-full font-black text-lg bg-primary text-primary-foreground"
          >
            {isApproved ? "סגירה ✓" : "סגירה"}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
