import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/** Detects the digit-pair 6→7 anywhere in the string, even when broken up
 *  by spaces / dashes / letters / emojis (e.g. "6 7", "6-7", "67677"). */
export const containsSixtySeven = (input: string): boolean => {
  const digitsOnly = (input ?? "").replace(/\D+/g, "");
  return digitsOnly.includes("67");
};

interface SkibidiGuardContextValue {
  /** Returns true when the overlay animation was actually shown.
   *  Returns false when the 67 attempt is silently blocked (already shown once this session). */
  trigger: () => boolean;
  /** Manually reset the "shown once" flag — e.g. when a new order starts. */
  reset: () => void;
}

const SkibidiGuardContext = createContext<SkibidiGuardContextValue | null>(null);

export const useSkibidiGuard = (): SkibidiGuardContextValue => {
  const ctx = useContext(SkibidiGuardContext);
  if (!ctx) return { trigger: () => false, reset: () => {} };
  return ctx;
};

export const SkibidiGuardProvider = ({ children }: { children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [topPx, setTopPx] = useState<number | null>(null);
  const shownRef = useRef(false);

  const trigger = useCallback(() => {
    if (shownRef.current) return false;
    shownRef.current = true;

    // Position the message at the vertical center of the *visible* viewport,
    // so it isn't hidden behind an open on-screen keyboard.
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (vv) {
      setTopPx(vv.offsetTop + vv.height / 2);
    } else {
      setTopPx(typeof window !== "undefined" ? window.innerHeight / 2 : null);
    }

    setVisible(true);
    return true;
  }, []);

  const reset = useCallback(() => {
    shownRef.current = false;
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <SkibidiGuardContext.Provider value={{ trigger, reset }}>
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm px-6"
            role="alert"
            aria-live="assertive"
          >
            <motion.div
              initial={{ scale: 0.6, rotate: -6, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              style={{
                position: "absolute",
                left: "50%",
                top: topPx !== null ? `${topPx}px` : "50%",
                transform: "translate(-50%, -50%)",
              }}
              className="text-center w-[min(32rem,calc(100%-3rem))]"
            >
              <div className="text-7xl mb-4">😂😂😂</div>
              <div className="text-white font-black text-3xl md:text-4xl leading-tight">
                לא הפעם סקיבידי טויילט
              </div>
              <div className="text-white/70 font-bold text-base mt-3">
                נחסמת מלכתוב 67 🚽
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </SkibidiGuardContext.Provider>
  );
};
