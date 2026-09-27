// "הזמן חייל/ת" — optional checkout donation to the soldier fund.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PRESETS = [5, 10, 20, 30, 40, 50, 60];
export const SOLDIER_DONATION_MAX = 1000;

export default function SoldierDonation({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [custom, setCustom] = useState("");
  const [stats, setStats] = useState<{ collected: number; meals: number } | null>(null);

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
      <div className="font-bold">🎖️ הזמן חייל/ת</div>
      <p className="text-xs text-muted-foreground">
        רוצים להוסיף סכום לקופת החיילים? בכסף הזה אנחנו מאכילים ומפנקים חיילים שמגיעים אלינו.
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
    </div>
  );
}
