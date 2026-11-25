// The frame of the deal sheets (דיל חברים / דיל משפחתי): the same sheet as
// ordering a single burger (ItemCustomizer) - full screen on the site, the
// admin-set height on the kiosk, pull handle, round close button, big title,
// and the same bottom bar. Each step's content is the children.
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

type Props = {
  open: boolean;
  isKiosk: boolean;
  title: string;
  stepLabel: string;
  progress: { current: number; total: number };
  stepKey: string;
  onClose: () => void;
  onScroll: () => void;
  footer: { label: string; onClick: () => void; disabled?: boolean; note?: string };
  children: ReactNode;
};

const DealSheet = ({ open, isKiosk, title, stepLabel, progress, stepKey, onClose, onScroll, footer, children }: Props) => {
  useBodyScrollLock(open);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-50"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320, mass: 0.9 }}
            className={`fixed left-0 right-0 z-50 bg-white text-black flex flex-col rounded-t-3xl shadow-2xl overflow-hidden ${
              isKiosk ? "bottom-0" : "inset-0 pwa-safe-screen"
            }`}
            style={isKiosk ? { top: "auto", height: "var(--kiosk-modal-h, 70vh)", maxHeight: "var(--kiosk-modal-h, 70vh)" } : undefined}
            dir="rtl"
          >
            <div className="shrink-0">
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 rounded-full bg-gray-300" />
              </div>
              <div className={`flex items-center justify-between ${isKiosk ? "px-8 pb-4" : "px-5 pb-3"}`}>
                <button
                  onClick={onClose}
                  aria-label="סגירה"
                  className={`rounded-full bg-gray-100 flex items-center justify-center ${isKiosk ? "w-16 h-16" : "w-10 h-10"}`}
                >
                  <X size={isKiosk ? 32 : 20} />
                </button>
                <div className="flex-1 text-center">
                  <h2 className={`font-black ${isKiosk ? "text-[34px]" : "text-xl"}`}>{title}</h2>
                  <p className={`text-gray-500 font-bold ${isKiosk ? "text-[20px]" : "text-sm"}`}>{stepLabel}</p>
                </div>
                <div className={isKiosk ? "w-16" : "w-10"} />
              </div>
              <div className={`flex gap-1 ${isKiosk ? "px-8 pb-4" : "px-5 pb-3"}`}>
                {Array.from({ length: progress.total }, (_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= progress.current ? "bg-primary" : "bg-gray-200"}`} />
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={stepKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex-1 overflow-y-auto overscroll-contain"
                onScroll={onScroll}
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {children}
                <div className="h-4" />
              </motion.div>
            </AnimatePresence>

            <div className={`border-t border-gray-200 bg-white pwa-safe-bottom ${isKiosk ? "px-8 py-6" : "px-5 py-4"}`}>
              {footer.note && (
                <p className={`text-destructive text-center font-bold ${isKiosk ? "text-[20px] mb-3" : "text-sm mb-2"}`}>{footer.note}</p>
              )}
              <button
                onClick={footer.onClick}
                disabled={footer.disabled}
                className={`w-full font-black rounded-xl transition-transform ${isKiosk ? "py-5 text-[22px]" : "py-4 text-lg"} ${
                  footer.disabled
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-primary text-primary-foreground shadow-lg shadow-primary/20 active:scale-[0.98]"
                }`}
              >
                {footer.label}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DealSheet;
