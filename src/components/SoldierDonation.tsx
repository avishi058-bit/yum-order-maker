// "הזמן חייל/ת" — optional checkout donation to the soldier fund.
// The donor must approve the regulation (תקנון) before the donation applies;
// the approval is logged server-side in consent_events via create-order.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SoldierFundHowItWorks, { SOLDIER_FUND_APPROVAL_TEXT } from "@/components/SoldierFundHowItWorks";

const PRESETS = [5, 10, 20, 30, 40, 50, 60];
export const SOLDIER_DONATION_MAX = 1000;

export default function SoldierDonation({
  value,
  onChange,
  termsAcceptedAt,
  onTermsAccept,
}: {
  value: number;
  onChange: (v: number) => void;
  termsAcceptedAt: string | null;
  onTermsAccept: (accepted: boolean) => void;
}) {
  const [custom, setCustom] = useState("");
  const [stats, setStats] = useState<{ collected: number; meals: number } | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    (supabase as any).rpc("soldier_fund_public_stats").then(({ data }: any) => data && setStats(data));
  }, []);

  const pick = (v: number) => { setCustom(""); onChange(value === v ? 0 : v); };
  const onCustom = (s: string) => {
    const clean = s.replace(/[^\d]/g, "").slice(0, 4);
    setCustom(clean);
    onChange(Math.min(SOLDIER_DONATION_MAX, Number(clean) || 0));
  };

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3 space-y-2" dir="rtl">
      <div className="font-bold">🫡 הזמן חייל/ת</div>
      <p className="text-xs text-muted-foreground">
        רוצים להוסיף סכום ל'הזמן חייל/ת'? בכסף הזה אנחנו מאכילים ומפנקים חיילים שמגיעים אלינו.
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
        <button type="button" onClick={() => { setCustom(""); onChange(0); }}
          className={`rounded-lg border py-2 text-sm ${value === 0 ? "bg-muted font-bold" : "bg-background"}`}>
          לא הפעם
        </button>
      </div>
      <input
        type="text" inputMode="numeric" placeholder={`סכום אחר (עד ₪${SOLDIER_DONATION_MAX})`}
        value={custom} onChange={(e) => onCustom(e.target.value)}
        className="w-full rounded-lg border bg-background p-2 text-center"
      />
      {value > 0 && <p className="text-xs text-center font-medium">₪{value} יתווספו לתשלום — תודה! 🙏</p>}

      {value > 0 && (
        <div className={`rounded-lg border p-2 space-y-2 ${termsAcceptedAt ? "border-primary/30 bg-primary/5" : "border-destructive/50 bg-destructive/5"}`}>
          <label className="flex items-start gap-2 cursor-pointer text-xs leading-relaxed">
            <input
              type="checkbox"
              checked={!!termsAcceptedAt}
              onChange={(e) => onTermsAccept(e.target.checked)}
              className="mt-0.5 w-4 h-4"
            />
            <span>
              {SOLDIER_FUND_APPROVAL_TEXT}{" "}
              <button type="button" onClick={(e) => { e.preventDefault(); setTermsOpen(true); }}
                className="underline font-bold">
                צפייה בתקנון 📜
              </button>
              {!termsAcceptedAt && <span className="text-destructive font-bold"> — חובה לתרומה</span>}
            </span>
          </label>
        </div>
      )}

      <SoldierFundHowItWorks
        open={termsOpen}
        onOpenChange={setTermsOpen}
        approved={!!termsAcceptedAt}
        onApprove={() => onTermsAccept(true)}
      />
    </div>
  );
}
