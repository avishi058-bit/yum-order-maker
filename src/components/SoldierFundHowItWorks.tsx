// "הזמן חייל/ת" - dialog: how it works + donor regulation (תקנון) and,
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

// Final regulation text provided by the owner.
export const SOLDIER_FUND_TERMS_TEXT = "תקנון מיזם “הזמן חייל/ת” - הבקתה\n\n1. מהות המיזם\n\nמיזם “הזמן חייל/ת” מאפשר ללקוחות להוסיף סכום לקופת החיילים, המיועדת למימון אוכל עבור חיילים וחיילות המגיעים לבקתה.\n\nכל הסכומים שנצברים במסגרת המיזם מצטרפים ליתרה משותפת אחת ואינם משויכים ללקוח, לחייל או להזמנה מסוימת.\n\n2. שימוש בכספים\n\nמלוא הסכום ששולם במסגרת המיזם מיועד להאכלת חיילים וחיילות בבקתה.\n\nהכספים שבקופה ישמשו למימון חלקי או מלא של רכישות מזון של חיילים, בהתאם ליתרה הקיימת בקופה ולשיקול דעת הבקתה.\n\n3. אופן הסבסוד\n\nהבקתה רשאית, לפי שיקול דעתה הבלעדי, לקבוע את גובה הסבסוד בכל עסקה - החל מסבסוד חלקי ועד סבסוד מלא.\n\nאין התחייבות לשיעור סבסוד קבוע, לסכום קבוע או להטבה מסוימת.\n\nהקופה אינה יכולה לרדת מתחת לאפס.\n\n4. מחירי המנות\n\nהמנות הניתנות לחיילים במסגרת המיזם מחושבות לפי מחירי התפריט הרגילים של הבקתה, כפי שהם נהוגים במועד המימוש.\n\nמיזם “הזמן חייל/ת” אינו מהווה הנחה או מבצע מצד הבקתה. הסבסוד ממומן מהיתרה שנצברה בקופת החיילים מתשלומי לקוחות.\n\n5. זכאות\n\nהבקתה תקבע מי זכאי ליהנות מהמיזם ואת התנאים לקבלת הסבסוד, לרבות אופן זיהוי הזכאים והיקף ההטבה.\n\nהזכאות במסגרת המיזם אינה מקנה זכות לקבלת כסף מזומן או להחזר כספי.\n\n6. קופת החיילים\n\nכל התשלומים במסגרת המיזם מצטרפים לקופה משותפת אחת.\n\nהיתרה בקופה עשויה לעלות ולרדת באופן שוטף בהתאם לתשלומים המתקבלים ולמימושים המתבצעים על ידי חיילים.\n\nללקוח אין זכות לקבוע עבור מי, מתי או באיזה אופן ישמש הסכום ששילם.\n\n7. ביטולים והחזרים\n\nביטול, שינוי או החזר של תשלום במסגרת המיזם ייעשו בהתאם להוראות הדין ולמדיניות הבקתה כפי שתהיה בתוקף במועד התשלום.\n\n8. שינויים בתנאי המיזם\n\nהבקתה רשאית לעדכן את תנאי המיזם, את אופן המימוש ואת אופן ניהול הקופה, בכפוף להוראות הדין.\n\n9. הפסקת המיזם\n\nגם במקרה שבו מיזם “הזמן חייל/ת” יופסק מכל סיבה שהיא, הבקתה מתחייבת להשתמש במלוא היתרה הקיימת בקופת החיילים למטרת האכלת חיילים וחיילות בבקתה, בהתאם למחירי התפריט הרגילים והמעודכנים במועד המימוש.\n\n10. כללי\n\nהשתתפות במיזם מהווה אישור לכך שהלקוח קרא את תנאי המיזם והסכים להם.\n\nבמקרה של סתירה בין תקנון זה לבין הוראת דין מחייבת, תגבר הוראת הדין.";

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
  onApprove: (accepted: boolean) => void;
  /** When set, the dialog also lets the customer pick an amount and pay. */
  donate?: DonateOptions;
  isKiosk?: boolean;
}

export default function SoldierFundHowItWorks({ open, onOpenChange, approved, onApprove, donate, isKiosk = false }: SoldierFundHowItWorksProps) {
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
    onApprove(v);
    // At checkout (no donate picker) approving is the only step - close right away.
    if (v && !donate) onOpenChange(false);
  };
  const pick = (v: number) => { setCustom(""); setAmount(amount === v ? 0 : v); };
  const onCustom = (s: string) => {
    const clean = s.replace(/[^\d]/g, "").slice(0, 4);
    setCustom(clean);
    setAmount(Math.min(SOLDIER_FUND_MAX, Number(clean) || 0));
  };
  const isApproved = checked;
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
        className={`relative w-full overflow-y-auto rounded-2xl shadow-2xl ${isKiosk ? "max-w-3xl max-h-[94vh] border border-border bg-kiosk-nav p-8 text-kiosk-nav-foreground space-y-6" : "max-w-lg max-h-[88vh] bg-background p-5 text-foreground space-y-4"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="סגירה"
          className={`absolute left-3 top-3 rounded-full p-1.5 ${isKiosk ? "border border-border bg-kiosk-nav text-kiosk-nav-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className={`${isKiosk ? "text-5xl" : "text-3xl"} font-black text-center`}>🫡 הזמן חייל/ת</h2>

        {/* צעדים גדולים ושיווקיים - בלי כיתוב מיותר */}
        <div className="py-3 text-center space-y-1">
          {[
            "בוחרים סכום",
            "הכסף נשמר בקופה מיוחדת לחיילים",
            "חייל/ת שמגיע/ה אלינו מקבל/ת פינוק/סבסוד עליכם :)",
          ].map((step, i) => (
            <div key={step}>
              <div className={`${isKiosk ? "text-3xl" : "text-2xl md:text-3xl"} font-black leading-snug`}>{step}</div>
              {i < 2 && <div className="text-xl font-black text-primary py-0.5">⬇️</div>}
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowAbout((v) => !v)}
            className={`${isKiosk ? "text-xl text-kiosk-nav-foreground" : "text-sm text-muted-foreground hover:text-foreground"} underline underline-offset-4 transition-colors`}
          >
            מה זה המיזם? 💚
          </button>
          {showAbout && (
            <p className={`mt-2 rounded-xl border border-primary/20 p-3 text-right leading-relaxed ${isKiosk ? "bg-kiosk-nav text-xl text-kiosk-nav-foreground" : "bg-primary/5 text-sm"}`}>
              מיזם "הזמן חייל/ת" מאפשר ללקוחות להוסיף סכום לקופת החיילים, אשר מיועדת למימון אוכל עבור חיילים וחיילות המגיעים לבקתה.
            </p>
          )}
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowTerms((v) => !v)}
            className={`${isKiosk ? "text-xl text-kiosk-nav-foreground" : "text-sm text-muted-foreground hover:text-foreground"} underline underline-offset-4 transition-colors`}
          >
            {showTerms ? "הסתרת התקנון" : "רוצים לקרוא את התקנון? 📜"}
          </button>
          {showTerms && (
            <div className={`mt-2 max-h-48 overflow-y-auto whitespace-pre-line rounded-xl border p-3 text-right leading-relaxed ${isKiosk ? "bg-kiosk-nav text-lg text-kiosk-nav-foreground" : "bg-muted/40 text-xs"}`}>
              {SOLDIER_FUND_TERMS_TEXT}
            </div>
          )}
        </div>

        <label className={`flex items-start gap-3 cursor-pointer rounded-xl border-2 p-3 ${isKiosk ? "bg-kiosk-nav text-xl text-kiosk-nav-foreground" : "text-sm"} ${isApproved ? "border-primary/40" : "border-destructive/50"}`}>
          <input
            type="checkbox"
            checked={isApproved}
            onChange={(e) => approve(e.target.checked)}
            className={`${isKiosk ? "w-8 h-8" : "w-5 h-5"} mt-1 accent-primary shrink-0`}
          />
          <span>
            {SOLDIER_FUND_APPROVAL_TEXT}
            {!isApproved && <span className="text-destructive font-bold"> - חובה</span>}
          </span>
        </label>

        {donate ? (
          <div className="space-y-3">
            <div className={`${isKiosk ? "text-2xl" : ""} font-bold`}>כמה להוסיף?</div>
            <div className="grid grid-cols-4 gap-2">
              {SOLDIER_FUND_PRESETS.map((v) => (
                <button key={v} type="button" onClick={() => pick(v)}
                  aria-pressed={amount === v && !custom}
                  className={`rounded-lg border font-bold ${isKiosk ? "py-4 text-2xl" : "py-2"} ${amount === v && !custom ? "border-primary bg-primary text-primary-foreground" : isKiosk ? "border-border bg-kiosk-nav text-kiosk-nav-foreground" : "bg-background"}`}>
                  ₪{v}
                </button>
              ))}
              <input
                type="text" inputMode="numeric" placeholder="אחר"
                value={custom} onChange={(e) => onCustom(e.target.value)}
                className={`rounded-lg border p-2 text-center ${isKiosk ? "border-border bg-kiosk-nav text-2xl text-kiosk-nav-foreground placeholder:text-muted-foreground" : "bg-background"}`}
                aria-label={`סכום אחר עד ₪${SOLDIER_FUND_MAX}`}
              />
            </div>
            {!canPay && (
              <p className={`${isKiosk ? "text-lg font-bold text-kiosk-nav-foreground" : "text-xs text-muted-foreground"} text-center`}>
                {amount === 0 ? "בחרו סכום" : "יש לאשר את התקנון כדי להמשיך"}
              </p>
            )}
            {donate.canOrder && (
              <button
                type="button" disabled={!canPay}
                onClick={() => donate.onContinueOrder(amount)}
                className={`w-full rounded-full bg-primary py-3 font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40 ${isKiosk ? "min-h-16 text-2xl" : "text-lg"}`}
              >
                הוסיפו ₪{amount || 0} והמשיכו להזמנה 🍔
              </button>
            )}
            <button
              type="button" disabled={!canPay}
              onClick={() => donate.onDonateOnly(amount)}
              className={`w-full rounded-full border-2 border-primary py-3 font-black text-primary disabled:cursor-not-allowed disabled:opacity-40 ${isKiosk ? "min-h-16 bg-kiosk-nav text-2xl" : "text-lg"}`}
            >
              רק 'הזמן חייל/ת' - לתשלום ₪{amount || 0} 💳
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
