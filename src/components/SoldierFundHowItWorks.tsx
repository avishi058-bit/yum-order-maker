// "הזמן חייל/ת" — entry-point dialog: how it works + donor regulation (תקנון).
// The donor MUST approve the regulation; approval is logged server-side
// through create-order (consent_events) when the donation is actually charged.
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const SOLDIER_FUND_TERMS_VERSION = "soldier-fund-v1";

// Full regulation shown in the dialog. NOTE: draft — replace with the final
// wording from the owner when provided.
export const SOLDIER_FUND_TERMS_TEXT = [
  "1. מהי הקופה — קופת 'הזמן חייל/ת' של המבורגר הבקתה נועדה להאכיל ולפנק חיילים וחיילות שמגיעים אלינו.",
  "2. אופן התרומה — בקופה, בסיום ההזמנה, בוחרים סכום (5, 10, 20, 30, 40, 50, 60 ₪ או סכום אחר עד 1,000 ₪). הסכום מתווסף לחשבון ההזמנה ומחויב באמצעי התשלום שנבחר.",
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

interface SoldierFundHowItWorksProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approved: boolean;
  onApprove: () => void;
}

export default function SoldierFundHowItWorks({ open, onOpenChange, approved, onApprove }: SoldierFundHowItWorksProps) {
  const [checked, setChecked] = useState(approved);
  const [justApproved, setJustApproved] = useState(false);

  useEffect(() => {
    if (open) {
      setChecked(approved);
      setJustApproved(false);
    }
  }, [open, approved]);

  const isDone = approved || justApproved;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogTitle className="text-2xl font-black flex items-center gap-2">
          🫡 הזמן חייל/ת
        </DialogTitle>
        <DialogDescription className="sr-only">
          הסבר על 'הזמן חייל/ת' ותקנון התרומה של המבורגר הבקתה
        </DialogDescription>

        <div className="space-y-4 text-sm leading-relaxed">
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-2">
            <div className="font-bold">איך זה עובד?</div>
            <ol className="list-decimal pr-5 space-y-1 text-muted-foreground">
              <li>בקופה, לפני התשלום, בוחרים כמה כסף להוסיף ל'הזמן חייל/ת' — 5 עד 60 ₪ בלחיצה, או סכום אחר.</li>
              <li>הסכום מתווסף לתשלום על ההזמנה ומחויב יחד איתה.</li>
              <li>הכסף נשמר בקופה מיוחדת שמנוהלת ומבוקרת.</li>
              <li>חייל/ת שמגיע/ה אלינו מקבל/ת אוכל מהקופה — ואפשר לראות באתר כמה נאסף וכמה חיילים פונקו 💚</li>
            </ol>
          </div>

          <div>
            <div className="font-bold mb-1">תקנון 'הזמן חייל/ת'</div>
            <div className="rounded-xl border bg-muted/40 p-3 whitespace-pre-line text-xs leading-relaxed max-h-56 overflow-y-auto">
              {SOLDIER_FUND_TERMS_TEXT}
            </div>
          </div>

          {isDone ? (
            <div className="rounded-xl bg-primary/10 border border-primary/30 p-3 text-center font-bold">
              {approved ? "התקנון כבר אושר ✓" : "תודה רבה! 🫡"}<br />
              <span className="text-sm font-medium text-muted-foreground">
                בקופה בסיום ההזמנה פשוט בוחרים כמה להוסיף ל'הזמן חייל/ת'.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="flex items-start gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="mt-1 w-4 h-4"
                />
                <span>{SOLDIER_FUND_APPROVAL_TEXT}</span>
              </label>
              <button
                type="button"
                disabled={!checked}
                onClick={() => {
                  onApprove();
                  setJustApproved(true);
                }}
                className="w-full py-3 rounded-full font-black text-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              >
                אישור התקנון 🫡
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
