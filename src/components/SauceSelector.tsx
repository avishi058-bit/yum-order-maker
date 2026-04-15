import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Star } from "lucide-react";
import { sauceOptions, SauceOption } from "@/data/menu";

interface SauceSelectorProps {
  open: boolean;
  freeSauces: number;
  onClose: () => void;
  onConfirm: (sauces: { id: string; name: string; quantity: number }[]) => void;
}

const SauceSelector = ({ open, freeSauces, onClose, onConfirm }: SauceSelectorProps) => {
  const [sauces, setSauces] = useState<Record<string, number>>({});

  const totalSelected = Object.values(sauces).reduce((sum, q) => sum + q, 0);
  const extraSauces = Math.max(0, totalSelected - freeSauces);
  const extraCost = extraSauces * 1;

  const updateSauce = (id: string, delta: number) => {
    setSauces((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const handleConfirm = () => {
    const result = Object.entries(sauces)
      .filter(([, q]) => q > 0)
      .map(([id, quantity]) => ({
        id,
        name: sauceOptions.find((s) => s.id === id)?.name || id,
        quantity,
      }));
    onConfirm(result);
    setSauces({});
  };

  const handleClose = () => {
    setSauces({});
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black z-50"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl max-h-[85vh] flex flex-col"
            dir="rtl"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1.5 rounded-full bg-muted" />
            </div>

            <div className="flex items-center justify-between px-5 pb-4 border-b border-border">
              <button onClick={handleClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <X size={18} />
              </button>
              <h2 className="text-lg font-bold flex-1 text-center">בחירת רטבים בצד 🥫</h2>
              <div className="w-9" />
            </div>

            <div className="px-5 py-3 bg-secondary/50 text-center">
              <p className="text-sm text-muted-foreground">
                מגיע לך <span className="text-primary font-bold">{freeSauces}</span> רטבים בחינם!
                {extraSauces > 0 && (
                  <span className="text-foreground"> · תוספת: <span className="text-primary font-bold">₪{extraCost}</span></span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">כל רוטב מעבר ל-{freeSauces} — ₪1</p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-0">
                {sauceOptions.map((sauce: SauceOption) => {
                  const qty = sauces[sauce.id] || 0;
                  return (
                    <div
                      key={sauce.id}
                      className="flex items-center justify-between py-3.5 border-b border-border/50 last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateSauce(sauce.id, -1)}
                          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-border transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="font-bold text-lg w-6 text-center">{qty}</span>
                        <button
                          onClick={() => updateSauce(sauce.id, 1)}
                          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-border transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-base">{sauce.name}</span>
                        {sauce.recommended && (
                          <span className="text-[10px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            <Star size={8} fill="currentColor" className="inline mb-0.5" /> מומלץ
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-5 border-t border-border space-y-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleConfirm}
                className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl text-lg shadow-lg shadow-primary/20"
              >
                {totalSelected > 0
                  ? `אישור${extraCost > 0 ? ` (+₪${extraCost})` : ""}`
                  : "בלי רטבים"}
              </motion.button>
              <button
                onClick={() => { onConfirm([]); setSauces({}); }}
                className="w-full text-muted-foreground text-sm py-2"
              >
                דלג
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SauceSelector;
