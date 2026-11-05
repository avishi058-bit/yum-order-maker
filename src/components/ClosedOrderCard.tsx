import { Bell } from "lucide-react";
import { DAY_NAMES_HE } from "@/hooks/useBusinessHours";

interface ClosedOrderCardProps {
  /** Closed because of load while business hours say open: no countdown. */
  isManualClosure: boolean;
  minutesUntilOpen: number | null;
  nextOpenDay: number | null;
  nextOpenAt: string | null;
  todayIndex: number;
  onBuildOrder: () => void;
  /** Omitted on the station: the "notify me" link is customer-only. */
  onNotifyMe?: () => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** When the kitchen is closed: when it opens, a countdown, and saving an order to send later. */
const ClosedOrderCard = ({
  isManualClosure,
  minutesUntilOpen,
  nextOpenDay,
  nextOpenAt,
  todayIndex,
  onBuildOrder,
  onNotifyMe,
}: ClosedOrderCardProps) => {
  const opensLabel =
    nextOpenAt && nextOpenDay !== null
      ? nextOpenDay === todayIndex
        ? `נפתחים היום ב-${nextOpenAt}`
        : nextOpenDay === (todayIndex + 1) % 7
          ? `נפתחים מחר ב-${nextOpenAt}`
          : `נפתחים ביום ${DAY_NAMES_HE[nextOpenDay]} ב-${nextOpenAt}`
      : null;

  const showCountdown = !isManualClosure && minutesUntilOpen !== null;
  const total = minutesUntilOpen ?? 0;
  const units = total >= 24 * 60
    ? [
        { value: Math.floor(total / 1440), label: "ימים" },
        { value: Math.floor((total % 1440) / 60), label: "שעות" },
        { value: total % 60, label: "דקות" },
      ]
    : [
        { value: Math.floor(total / 60), label: "שעות" },
        { value: total % 60, label: "דקות" },
      ];

  return (
    <section dir="rtl" className="mx-4 my-8 max-w-md sm:mx-auto rounded-[20px] border border-border bg-card p-5 sm:p-6 shadow-[0_12px_32px_rgba(0,0,0,0.35)] flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
        <span>
          {isManualClosure ? "סגור כרגע עקב עומס · נחזור בקרוב" : opensLabel ? `סגור כרגע · ${opensLabel}` : "סגור כרגע"}
        </span>
      </div>

      {showCountdown && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">המטבח נפתח בעוד</p>
          <div className="flex gap-2.5" aria-live="off">
            {units.map((u) => (
              <div key={u.label} className="flex min-w-16 flex-col items-center rounded-xl bg-background py-2">
                <span className="text-3xl font-black tabular-nums">{pad(u.value)}</span>
                <span className="text-xs text-muted-foreground">{u.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-base leading-relaxed text-foreground">
        אפשר כבר עכשיו להרכיב הזמנה ולשמור אותה. כשנפתחים, חוזרים לאתר ושולחים אותה בלחיצה.
      </p>

      <button
        type="button"
        onClick={onBuildOrder}
        className="h-14 rounded-full bg-gradient-to-b from-[hsl(32_100%_62%)] to-primary text-primary-foreground text-lg font-black shadow-[0_8px_22px_hsl(32_95%_52%/0.35)] transition-transform active:scale-[0.98]"
      >
        הרכיבו ושמרו הזמנה
      </button>

      {onNotifyMe && (
        <button
          type="button"
          onClick={onNotifyMe}
          className="inline-flex items-center justify-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <Bell size={16} aria-hidden />
          עדכנו אותי כשנפתח שוב
        </button>
      )}
    </section>
  );
};

export default ClosedOrderCard;
