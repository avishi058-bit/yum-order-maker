import { useState } from "react";
import { Clock, ChevronDown, Flame } from "lucide-react";
import { useBusinessHours, DAY_NAMES_HE, formatCountdown } from "@/hooks/useBusinessHours";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const BusinessStatusBar = () => {
  const { hours, status, loading } = useBusinessHours();
  const { status: restaurantStatus } = useRestaurantStatus();
  const [open, setOpen] = useState(false);

  if (loading) return null;

  const todayLabel = status.todayHours.open
    ? `היום ${status.todayHours.from}–${status.todayHours.to}`
    : "היום סגור";

  return (
    <div dir="rtl" className="sticky top-0 z-40 w-full">
      {restaurantStatus.high_load && (
        <div className="w-full bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 text-white px-3 py-2 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md animate-pulse">
          <Flame size={16} className="shrink-0" />
          <span>עומס במטבח כרגע — זמני המתנה ארוכים מהרגיל, סבלנות ותודה 🙏</span>
          <Flame size={16} className="shrink-0" />
        </div>
      )}
      <div className="w-full border-b border-border bg-card/95 backdrop-blur-md">

      <div className="mx-auto flex max-w-screen-lg items-center justify-between gap-2 px-3 py-1.5 text-xs sm:text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
              status.isOpen ? "bg-green-500 animate-pulse" : "bg-destructive"
            }`}
            aria-hidden
          />
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className={`font-bold ${status.isOpen ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
              {status.isOpen ? "פתוחים עכשיו להזמנות" : "כרגע סגור"}
            </span>
            {!status.isOpen && status.minutesUntilOpen !== null && (
              <span className="text-muted-foreground">
                · נפתח בעוד {formatCountdown(status.minutesUntilOpen)}
              </span>
            )}
            <span className="text-muted-foreground truncate">· {todayLabel}</span>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Clock size={12} />
              <span>שעות פעילות</span>
              <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle>שעות פעילות</DialogTitle>
            </DialogHeader>
            <ul className="divide-y divide-border">
              {DAY_NAMES_HE.map((name, idx) => {
                const day = hours[String(idx)];
                const isToday = new Date().getDay() === idx;
                return (
                  <li
                    key={idx}
                    className={`flex items-center justify-between py-2.5 text-sm ${
                      isToday ? "font-bold text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <span>
                      {name}
                      {isToday && <span className="mr-2 text-xs text-primary">(היום)</span>}
                    </span>
                    <span>
                      {day.open ? `${day.from} – ${day.to}` : "סגור"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default BusinessStatusBar;
