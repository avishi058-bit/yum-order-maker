import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

/** Detects the digit-pair 6→7 anywhere in the string, even when broken up
 *  by spaces / dashes / letters / emojis (e.g. "6 7", "6-7", "67677"). */
export const containsSixtySeven = (input: string): boolean => {
  const digitsOnly = (input ?? "").replace(/\D+/g, "");
  return digitsOnly.includes("67");
};

interface SkibidiGuardContextValue {
  trigger: () => void;
}

const SkibidiGuardContext = createContext<SkibidiGuardContextValue | null>(null);

export const useSkibidiGuard = (): SkibidiGuardContextValue => {
  const ctx = useContext(SkibidiGuardContext);
  if (!ctx) return { trigger: () => {} };
  return ctx;
};

export const SkibidiGuardProvider = ({ children }: { children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);

  const trigger = useCallback(() => {
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <SkibidiGuardContext.Provider value={{ trigger }}>
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm px-6"
            role="alert"
            aria-live="assertive"
          >
            <motion.div
              initial={{ scale: 0.6, rotate: -6 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="text-center max-w-lg"
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
