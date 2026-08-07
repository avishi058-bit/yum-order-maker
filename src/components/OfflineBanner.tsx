import { WifiOff, RefreshCw } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Full-width red banner shown whenever the device loses its connection to the
 * server. Without it the screen simply stops updating and looks frozen.
 */
const OfflineBanner = () => {
  const { online, lastOkAt } = useOnlineStatus();

  if (online) return null;

  const secondsAgo = Math.max(0, Math.round((Date.now() - lastOkAt) / 1000));
  const since =
    secondsAgo < 60
      ? `${secondsAgo} שניות`
      : `${Math.round(secondsAgo / 60)} דקות`;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 inset-x-0 z-[100] bg-destructive text-destructive-foreground shadow-lg animate-pulse-slow"
      dir="rtl"
    >
      <div className="flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-bold">
        <WifiOff size={18} className="shrink-0" />
        <span>אין חיבור לאינטרנט — המסך לא מתעדכן ({since})</span>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded-lg bg-background/20 px-3 py-1 text-xs font-bold hover:bg-background/30 transition-colors"
        >
          <RefreshCw size={14} />
          רענן
        </button>
      </div>
    </div>
  );
};

export default OfflineBanner;
