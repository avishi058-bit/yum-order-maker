import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Star } from "lucide-react";
import { sauceOptions, SauceOption } from "@/data/menu";

interface SauceSelectorProps {
  open: boolean;
  freeSauces: number;
  onClose: () => void;
  onConfirm: (sauces: { id: string; name: string; quantity: number }[]) => void;
  isAvailable?: (id: string) => boolean;
  isKiosk?: boolean;
}

const SauceSelector = ({ open, freeSauces, onClose, onConfirm, isAvailable, isKiosk }: SauceSelectorProps) => {
  // Hide sauces the kitchen has marked out-of-stock so customers can't pick them.
  const visibleSauces = sauceOptions.filter((s) =>
    isAvailable ? isAvailable(s.id) : true,
  );

  const [sauces, setSauces] = useState<Record<string, number>>({});

  // Split premium (priced) sauces from regular ones. Premium sauces never
  // consume the free-sauce quota — they always cost their fixed price.
  const isPremium = (id: string) => {
    const s = sauceOptions.find((x) => x.id === id);
    return !!(s && typeof s.price === "number" && s.price > 0);
  };
  const regularSelected = Object.entries(sauces)
    .filter(([id]) => !isPremium(id))
    .reduce((sum, [, q]) => sum + q, 0);
  const premiumCost = Object.entries(sauces).reduce((sum, [id, q]) => {
    const s = sauceOptions.find((x) => x.id === id);
    return sum + (s?.price ? s.price * q : 0);
  }, 0);
  const totalSelected = Object.values(sauces).reduce((sum, q) => sum + q, 0);
  const extraSauces = Math.max(0, regularSelected - freeSauces);
  const extraCost = extraSauces * 1 + premiumCost;

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

  // Kiosk uses a light theme for readability on the kiosk screen.
  const surfaceBg = isKiosk ? "bg-white" : "bg-card";
  const textMain = isKiosk ? "text-gray-900" : "text-foreground";
  const textMuted = isKiosk ? "text-gray-500" : "text-muted-foreground";
  const mutedBg = isKiosk ? "bg-gray-100" : "bg-muted";
  const borderColor = isKiosk ? "border-gray-200" : "border-border";
  const secondaryBg = isKiosk ? "bg-gray-50" : "bg-secondary/50";
  const hoverBg = isKiosk ? "hover:bg-gray-200" : "hover:bg-border";
  const skipText = isKiosk ? "text-gray-500" : "text-muted-foreground";

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
            className={`fixed bottom-0 left-0 right-0 z-50 ${surfaceBg} rounded-t-3xl max-h-[85vh] flex flex-col`}
            dir="rtl"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className={`w-10 h-1.5 rounded-full ${mutedBg}`} />
            </div>

            <div className={`flex items-center justify-between px-5 pb-4 border-b ${borderColor}`}>
              <button onClick={handleClose} className={`w-9 h-9 rounded-full ${mutedBg} flex items-center justify-center`}>
                <X size={18} />
              </button>
              <h2 className={`text-lg font-bold flex-1 text-center ${textMain}`}>בחירת רטבים בצד 🥫</h2>
              <div className="w-9" />
            </div>

            <div className={`px-5 py-3 ${secondaryBg} text-center`}>
              <p className={`text-sm ${textMuted}`}>
                מגיע לך <span className="text-primary font-bold">{freeSauces}</span> רטבים בחינם!
                {extraSauces > 0 && (
                  <span className={textMain}> · תוספת: <span className="text-primary font-bold">₪{extraCost}</span></span>
                )}
              </p>
              <p className={`text-xs ${textMuted} mt-1`}>כל רוטב מעבר ל-{freeSauces} — ₪1</p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-0">
                {(() => {
                  const regularSauces = visibleSauces.filter((s) => !isPremium(s.id));
                  const premiumSauces = visibleSauces.filter((s) => isPremium(s.id));
                  const renderSauce = (sauce: SauceOption) => {
                    const qty = sauces[sauce.id] || 0;
                    return (
                      <div
                        key={sauce.id}
                        className={`flex items-center justify-between py-3.5 border-b ${isKiosk ? "border-gray-200/50" : "border-border/50"} last:border-b-0`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => updateSauce(sauce.id, -1)}
                            className={`w-8 h-8 rounded-full ${mutedBg} flex items-center justify-center ${hoverBg} transition-colors`}
                          >
                            <Minus size={14} />
                          </button>
                          <span className={`font-bold text-lg w-6 text-center ${textMain}`}>{qty}</span>
                          <button
                            onClick={() => updateSauce(sauce.id, 1)}
                            className={`w-8 h-8 rounded-full ${mutedBg} flex items-center justify-center ${hoverBg} transition-colors`}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium text-base ${textMain}`}>{sauce.name}</span>
                          {sauce.price ? (
                            <span className="text-[11px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full whitespace-nowrap">
                              +₪{sauce.price}
                            </span>
                          ) : null}
                          {sauce.recommended && (
                            <span className="text-[10px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              <Star size={8} fill="currentColor" className="inline mb-0.5" /> מומלץ
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  };
                  return (
                    <>
                      {regularSauces.length > 0 && (
                        <div className="mb-1">
                          <h3 className={`text-sm font-bold ${textMuted} text-right py-2`}>רטבים חינמיים</h3>
                          <div className={`divide-y ${isKiosk ? "divide-gray-200/50" : "divide-border/50"}`}>{regularSauces.map(renderSauce)}</div>
                        </div>
                      )}
                      {regularSauces.length > 0 && premiumSauces.length > 0 && (
                        <div className={`my-3 border-t ${borderColor}`} />
                      )}
                      {premiumSauces.length > 0 && (
                        <div className="mb-1">
                          <h3 className={`text-sm font-bold ${textMuted} text-right py-2`}>רטבים בתשלום</h3>
                          <div className={`divide-y ${isKiosk ? "divide-gray-200/50" : "divide-border/50"}`}>{premiumSauces.map(renderSauce)}</div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className={`p-5 border-t ${borderColor} space-y-3`}>
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
                className={`w-full ${skipText} text-sm py-2`}
              >
                דלג — לא צריך רטבים בצד
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SauceSelector;
