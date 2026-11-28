import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, MessageSquare } from "lucide-react";
import { DAY_NAMES_HE } from "@/hooks/useBusinessHours";

interface ClosedOrderCardProps {
  /** Closed because of load while business hours say open: no countdown. */
  isManualClosure: boolean;
  minutesUntilOpen: number | null;
  nextOpenDay: number | null;
  nextOpenAt: string | null;
  todayIndex: number;
  onBuildOrder: () => void;
  /** Omitted on the station: the "notify me" button is customer-only. */
  onNotifyMe?: () => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Exact time of the next opening, in the same (browser-local) clock that
 * useBusinessHours uses for minutesUntilOpen, so both always agree.
 */
const nextOpeningTime = (day: number, hm: string, now: Date): Date => {
  const [h, m] = hm.split(":").map((v) => parseInt(v, 10) || 0);
  const t = new Date(now);
  t.setHours(h, m, 0, 0);
  t.setDate(t.getDate() + ((day - now.getDay() + 7) % 7));
  if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 7);
  return t;
};

/** One digit that slides in from above when it changes. */
const Digit = ({ value, reduce }: { value: string; reduce: boolean }) => (
  <span className="relative inline-block h-[1.1em] w-[0.62em] overflow-hidden">
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        key={value}
        initial={reduce ? false : { y: "-100%", opacity: 0 }}
        animate={{ y: "0%", opacity: 1 }}
        exit={reduce ? undefined : { y: "100%", opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 flex items-center justify-center"
      >
        {value}
      </motion.span>
    </AnimatePresence>
  </span>
);

const Tile = ({ value, label, accent, reduce }: { value: number; label: string; accent?: boolean; reduce: boolean }) => (
  <div
    className={`relative flex flex-1 flex-col items-center rounded-2xl border px-1 pb-2 pt-2.5 ${
      accent
        ? "border-primary/60 bg-gradient-to-b from-primary/25 to-primary/5 shadow-[0_0_24px_hsl(32_95%_52%/0.35)]"
        : "border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02]"
    }`}
  >
    <span
      className={`flex text-4xl sm:text-5xl font-black tabular-nums leading-none ${accent ? "text-primary" : "text-foreground"}`}
      dir="ltr"
    >
      {pad(value).split("").map((d, i) => (
        <Digit key={i} value={d} reduce={reduce} />
      ))}
    </span>
    <span className="mt-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground">{label}</span>
  </div>
);

/** When the kitchen is closed: when it opens, a live countdown, SMS on opening, and saving an order to send later. */
const ClosedOrderCard = ({
  isManualClosure,
  minutesUntilOpen,
  nextOpenDay,
  nextOpenAt,
  todayIndex,
  onBuildOrder,
  onNotifyMe,
}: ClosedOrderCardProps) => {
  const reduce = useReducedMotion() ?? false;
  const opensLabel =
    nextOpenAt && nextOpenDay !== null
      ? nextOpenDay === todayIndex
        ? `נפתחים היום ב-${nextOpenAt}`
        : nextOpenDay === (todayIndex + 1) % 7
          ? `נפתחים מחר ב-${nextOpenAt}`
          : `נפתחים ביום ${DAY_NAMES_HE[nextOpenDay]} ב-${nextOpenAt}`
      : null;

  const showCountdown = !isManualClosure && minutesUntilOpen !== null && nextOpenAt !== null && nextOpenDay !== null;

  const target = useMemo(
    () => (showCountdown ? nextOpeningTime(nextOpenDay!, nextOpenAt!, new Date()).getTime() : null),
    [showCountdown, nextOpenDay, nextOpenAt],
  );

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (target === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);

  const left = target === null ? 0 : Math.max(0, Math.floor((target - now) / 1000));
  const days = Math.floor(left / 86400);
  const units = [
    ...(days > 0 ? [{ value: days, label: "ימים" }] : []),
    { value: Math.floor((left % 86400) / 3600), label: "שעות" },
    { value: Math.floor((left % 3600) / 60), label: "דקות" },
    { value: left % 60, label: "שניות", accent: true },
  ];

  return (
    <section dir="rtl" className="mx-4 my-8 max-w-md sm:mx-auto rounded-[24px] border border-border bg-card p-5 sm:p-6 shadow-[0_12px_32px_rgba(0,0,0,0.35)] flex flex-col gap-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
        </span>
        <span>
          {isManualClosure ? "סגור כרגע עקב עומס · נחזור בקרוב" : opensLabel ? `סגור כרגע · ${opensLabel}` : "סגור כרגע"}
        </span>
      </div>

      {showCountdown && (
        <div className="flex flex-col gap-2.5">
          <p className="text-sm font-semibold text-muted-foreground">המטבח נפתח בעוד</p>
          {left > 0 ? (
            <div className="flex gap-2" dir="ltr" role="timer" aria-label={`נפתחים בעוד ${units.map((u) => `${u.value} ${u.label}`).join(" ")}`}>
              {/* ltr row reads days → seconds left to right, like a clock */}
              {units.map((u) => (
                <Tile key={u.label} value={u.value} label={u.label} accent={u.accent} reduce={reduce} />
              ))}
            </div>
          ) : (
            <p className="text-2xl font-black text-primary">נפתחים ממש עכשיו! 🎉</p>
          )}
        </div>
      )}

      {onNotifyMe && (
        <button
          type="button"
          onClick={onNotifyMe}
          className="group flex min-h-[72px] w-full items-center justify-center gap-3 rounded-2xl bg-green-600 px-4 py-3 text-white shadow-[0_10px_26px_rgba(22,163,74,0.4)] transition-[transform,background-color] hover:bg-green-700 active:scale-[0.98]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20">
            <Bell size={24} aria-hidden className="animate-wiggle-dance motion-reduce:animate-none" />
          </span>
          <span className="flex flex-col items-start text-right">
            <span className="whitespace-nowrap text-[17px] sm:text-xl font-black leading-tight">עדכנו אותי ב-SMS כשנפתח!</span>
            <span className="flex items-center gap-1 text-xs font-medium text-white/85">
              <MessageSquare size={12} aria-hidden />
              הודעה אחת בלבד, ברגע שפותחים
            </span>
          </span>
        </button>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4">
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
      </div>
    </section>
  );
};

export default ClosedOrderCard;
