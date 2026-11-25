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
  // consume the free-sauce quota - they always cost their fixed price.
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
  // Kiosk: a centered window in front of the customer's eyes, big bold text.
  const k = (kiosk: string, site: string) => (isKiosk ? kiosk : site);

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
            initial={isKiosk ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
            animate={isKiosk ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={isKiosk ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
            transition={isKiosk ? { duration: 0.2 } : { type: "spring", damping: 30, stiffness: 300 }}
            className={`fixed z-50 ${surfaceBg} flex flex-col ${
              isKiosk
                ? "inset-0 m-auto h-fit w-[92vw] max-w-3xl max-h-[85vh] rounded-3xl shadow-2xl"
                : "bottom-0 left-0 right-0 rounded-t-3xl max-h-[85vh]"
            }`}
            dir="rtl"
          >
            {!isKiosk && (
              <div className="flex justify-center pt-3 pb-1">
                <div className={`w-10 h-1.5 rounded-full ${mutedBg}`} />
              </div>
            )}

            <div className={`flex items-center justify-between border-b ${borderColor} ${k("px-8 pt-6 pb-5", "px-5 pb-4")}`}>
              <button onClick={handleClose} aria-label="סגירה" className={`rounded-full ${mutedBg} flex items-center justify-center ${k("w-14 h-14", "w-9 h-9")}`}>
                <X size={isKiosk ? 28 : 18} />
              </button>
              <h2 className={`flex-1 text-center ${textMain} ${k("text-[36px] font-black", "text-lg font-bold")}`}>בחירת רטבים בצד 🥫</h2>
              <div className={k("w-14", "w-9")} />
            </div>

            <div className={`${secondaryBg} text-center ${k("px-8 py-4", "px-5 py-3")}`}>
              <p className={`${textMuted} ${k("text-[24px] font-bold", "text-sm")}`}>
                מגיע לך <span className="text-primary font-bold">{freeSauces}</span> רטבים בחינם!
                {extraSauces > 0 && (
                  <span className={textMain}> · תוספת: <span className="text-primary font-bold">₪{extraCost}</span></span>
                )}
              </p>
              <p className={`${textMuted} mt-1 ${k("text-[20px]", "text-xs")}`}>כל רוטב מעבר ל-{freeSauces} - ₪1</p>
            </div>

            <div className={`flex-1 overflow-y-auto ${k("px-8 py-4", "px-5 py-4")}`}>
              <div className="space-y-0">
                {(() => {
                  const regularSauces = visibleSauces.filter((s) => !isPremium(s.id));
                  const premiumSauces = visibleSauces.filter((s) => isPremium(s.id));
                  const renderSauce = (sauce: SauceOption) => {
                    const qty = sauces[sauce.id] || 0;
                    return (
                      <div
                        key={sauce.id}
                        className={`flex items-center justify-between border-b ${isKiosk ? "border-gray-200/50 py-5" : "border-border/50 py-3.5"} last:border-b-0`}
                      >
                        <div className={`flex items-center ${k("gap-4", "gap-3")}`}>
                          <button
                            onClick={() => updateSauce(sauce.id, -1)}
                            aria-label="פחות"
                            className={`rounded-full ${mutedBg} flex items-center justify-center ${hoverBg} transition-colors ${k("w-14 h-14", "w-8 h-8")}`}
                          >
                            <Minus size={isKiosk ? 26 : 14} />
                          </button>
                          <span className={`text-center ${textMain} ${k("font-black text-[34px] w-12", "font-bold text-lg w-6")}`}>{qty}</span>
                          <button
                            onClick={() => updateSauce(sauce.id, 1)}
                            aria-label="עוד"
                            className={`rounded-full flex items-center justify-center transition-colors ${k("w-14 h-14 bg-primary text-primary-foreground", `w-8 h-8 ${mutedBg} ${hoverBg}`)}`}
                          >
                            <Plus size={isKiosk ? 26 : 14} />
                          </button>
                        </div>
                        <div className={`flex items-center ${k("gap-3", "gap-2")}`}>
                          <span className={`${textMain} ${k("font-black text-[30px]", "font-medium text-base")}`}>{sauce.name}</span>
                          {sauce.price ? (
                            <span className={`font-bold bg-primary text-primary-foreground rounded-full whitespace-nowrap ${k("text-[20px] px-3 py-1", "text-[11px] px-2 py-0.5")}`}>
                              +₪{sauce.price}
                            </span>
                          ) : null}
                          {sauce.recommended && (
                            <span className={`font-bold bg-green-500 text-white rounded-full whitespace-nowrap ${k("text-[18px] px-3 py-1", "text-[10px] px-1.5 py-0.5")}`}>
                              <Star size={isKiosk ? 14 : 8} fill="currentColor" className="inline mb-0.5" /> מומלץ
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
                          <h3 className={`${textMuted} text-right ${k("text-[24px] font-black py-3", "text-sm font-bold py-2")}`}>רטבים חינמיים</h3>
                          <div className={`divide-y ${isKiosk ? "divide-gray-200/50" : "divide-border/50"}`}>{regularSauces.map(renderSauce)}</div>
                        </div>
                      )}
                      {regularSauces.length > 0 && premiumSauces.length > 0 && (
                        <div className={`my-3 border-t ${borderColor}`} />
                      )}
                      {premiumSauces.length > 0 && (
                        <div className="mb-1">
                          <h3 className={`${textMuted} text-right ${k("text-[24px] font-black py-3", "text-sm font-bold py-2")}`}>רטבים בתשלום</h3>
                          <div className={`divide-y ${isKiosk ? "divide-gray-200/50" : "divide-border/50"}`}>{premiumSauces.map(renderSauce)}</div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className={`border-t ${borderColor} space-y-3 ${k("p-8", "p-5")}`}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleConfirm}
                className={`w-full bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/20 ${k("font-black py-6 text-[30px]", "font-bold py-4 text-lg")}`}
              >
                {totalSelected > 0
                  ? `אישור${extraCost > 0 ? ` (+₪${extraCost})` : ""}`
                  : "בלי רטבים"}
              </motion.button>
              <button
                onClick={() => { onConfirm([]); setSauces({}); }}
                className={`w-full ${skipText} ${k("text-[22px] font-bold py-3", "text-sm py-2")}`}
              >
                דלג - לא צריך רטבים בצד
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SauceSelector;
