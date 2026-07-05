import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { motion } from "framer-motion";

interface GoogleReviewCardProps {
  url: string;
  className?: string;
  /** ISO timestamp of when the order was completed. The review prompt only
   *  appears ~30 minutes after this time, so customers get a chance to eat
   *  before being asked to rate. If omitted, the prompt shows immediately. */
  completedAt?: string | null;
  /** Delay in minutes before the prompt appears. Defaults to 30. */
  delayMinutes?: number;
}

/**
 * Prompt shown a while after an order is completed, linking to the
 * restaurant's Google Business review page. Hidden when no review URL is
 * configured or when the delay hasn't elapsed yet.
 */
export const GoogleReviewCard = ({
  url,
  className = "",
  completedAt,
  delayMinutes = 30,
}: GoogleReviewCardProps) => {
  const [ready, setReady] = useState(() => {
    if (!completedAt) return true;
    return Date.now() - new Date(completedAt).getTime() >= delayMinutes * 60_000;
  });

  useEffect(() => {
    if (ready || !completedAt) return;
    const remaining = new Date(completedAt).getTime() + delayMinutes * 60_000 - Date.now();
    if (remaining <= 0) {
      setReady(true);
      return;
    }
    const t = setTimeout(() => setReady(true), remaining);
    return () => clearTimeout(t);
  }, [completedAt, delayMinutes, ready]);

  if (!url || !ready) return null;

  return (
    <motion.a
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        block w-full bg-[#4285F4]/10 hover:bg-[#4285F4]/20
        border border-[#4285F4]/30 rounded-2xl p-5 text-center
        transition-colors ${className}
      `}
    >
      <div className="flex items-center justify-center gap-1 mb-2">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            size={20}
            className="fill-yellow-400 text-yellow-400"
          />
        ))}
      </div>
      <p className="text-base font-black text-foreground">אהבתם? דרגו אותנו בגוגל</p>
      <p className="text-xs text-muted-foreground mt-1">לחצו כאן לדירוג מהיר — זה עוזר לנו מאוד</p>
    </motion.a>
  );
};

export default GoogleReviewCard;
