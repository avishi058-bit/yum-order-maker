// "הזמן חייל/ת" — optional checkout donation.
// The donor must approve the regulation (תקנון) before the donation applies;
// the regulation window opens automatically when an amount is picked, and the
// approval is logged server-side in consent_events via create-order.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SoldierFundHowItWorks, {
  SOLDIER_FUND_APPROVAL_TEXT,
  SOLDIER_FUND_PRESETS as PRESETS,
  SOLDIER_FUND_MAX,
} from "@/components/SoldierFundHowItWorks";

export const SOLDIER_DONATION_MAX = SOLDIER_FUND_MAX;

export default function SoldierDonation({
  value,
  onChange,
  termsAcceptedAt,
  onTermsAccept,
  donationOnly = false,
}: {
  value: number;
  onChange: (v: number) => void;
  termsAcceptedAt: string | null;
  onTermsAccept: (accepted: boolean) => void;
  donationOnly?: boolean;
}) {
  const [custom, setCustom] = useState(() => (value > 0 && !PRESETS.includes(value) ? String(value) : ""));
  const [stats, setStats] = useState<{ collected: number; meals: number } | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    (supabase as any).rpc("soldier_fund_public_stats").then(({ data }: any) => data && setStats(data));
  }, []);

  const set = (v: number) => {
    onChange(v);
    if (v > 0 && !termsAcceptedAt) setTermsOpen(true);
  };
  const pick = (v: number) => { setCustom(""); set(value === v && !donationOnly ? 0 : v); };
  const onCustom = (s: string) => {
    const clean = s.replace(/[^\d]/g, "").slice(0, 4);
    setCustom(clean);
    onChange(Math.min(SOLDIER_DONATION_MAX, Number(clean) || 0));
  };

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3 space-y-2" dir="rtl">
      <div className="font-bold">🫡 הזמן חייל/ת</div>
      <p className="text-xs text-muted-foreground">
        {donationOnly
          ? "תשלום על 'הזמן חייל/ת' בלבד — בלי הזמנת אוכל."
          : "רוצים להוסיף סכום ל'הזמן חייל/ת'? בכסף הזה אנחנו מאכילים ומפנקים חיילים שמגיעים אלינו."}
      </p>
      {stats && Number(stats.collected) > 0 && (
        <p className="text-xs font-medium text-primary">
          נאספו עד היום ₪{Math.round(Number(stats.collected)).toLocaleString()} · {stats.meals} חיילים קיבלו אוכל 💚
        </p>
      )}
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((v) => (
          <button key={v} type="button" onClick={() => pick(v)}
            className={`rounded-lg border py-2 font-bold ${value === v && !custom ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
            ₪{v}
          </button>
        ))}
        {!donationOnly && (
          <button type="button" onClick={() => { setCustom(""); onChange(0); }}
            className={`rounded-lg border py-2 text-sm ${value === 0 ? "bg-muted font-bold" : "bg-background"}`}>
            לא הפעם
          </button>
        )}
      </div>
      <input
        type="text" inputMode="numeric" placeholder={`סכום אחר (עד ₪${SOLDIER_DONATION_MAX})`}
        value={custom} onChange={(e) => onCustom(e.target.value)}
        onBlur={() => { if (value > 0 && !termsAcceptedAt) setTermsOpen(true); }}
        className="w-full rounded-lg border bg-background p-2 text-center"
      />
      {value > 0 && !donationOnly && <p className="text-xs text-center font-medium">₪{value} יתווספו לתשלום — תודה! 🙏</p>}

      {value > 0 && (
        <div className={`rounded-lg border-2 p-2 space-y-2 ${termsAcceptedAt ? "border-primary/30 bg-primary/5" : "border-destructive/60 bg-destructive/10"}`}>
          <label className="flex items-start gap-2 cursor-pointer text-xs leading-relaxed">
            <input
              type="checkbox"
              checked={!!termsAcceptedAt}
              onChange={(e) => onTermsAccept(e.target.checked)}
              className="mt-0.5 w-5 h-5 accent-primary shrink-0"
            />
            <span>
              {SOLDIER_FUND_APPROVAL_TEXT}{" "}
              <button type="button" onClick={(e) => { e.preventDefault(); setTermsOpen(true); }}
                className="underline font-bold">
                צפייה בתקנון 📜
              </button>
              {!termsAcceptedAt && <span className="text-destructive font-bold block mt-1">⚠️ אי אפשר להמשיך לתשלום בלי אישור התקנון</span>}
            </span>
          </label>
        </div>
      )}

      <SoldierFundHowItWorks
        open={termsOpen}
        onOpenChange={setTermsOpen}
        approved={!!termsAcceptedAt}
        onApprove={onTermsAccept}
      />
    </div>
  );
}
