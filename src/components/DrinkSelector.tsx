import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { MenuItem, drinkSubOptions, drinkToAvailabilityId } from "@/data/menu";
import { useAlcoholConsent } from "@/hooks/useAlcoholConsent";
import AlcoholConsentModal from "@/components/AlcoholConsentModal";

import drinkColaImg from "@/assets/drink-cola.png";
import drinkZeroImg from "@/assets/drink-zero.png";
import drinkSpriteImg from "@/assets/drink-sprite.png";
import drinkSpriteZeroImg from "@/assets/drink-sprite-zero.png";
import drinkFantaImg from "@/assets/drink-fanta.png";
import drinkFantaGrapeImg from "@/assets/drink-fanta-grape.png";
import drinkFantaExoticImg from "@/assets/drink-fanta-exotic.png";
import drinkBluImg from "@/assets/drink-blu.png";
import drinkBluWatermelonImg from "@/assets/drink-blu-watermelon.png";
import drinkBluMojitoImg from "@/assets/drink-blu-mojito.png";
import drinkBluDayImg from "@/assets/drink-blu-day.png";
import drinkBluMelonAppleImg from "@/assets/drink-blu-melon-apple.png";
import drinkGoldstarImg from "@/assets/drink-goldstar.png";
import drinkStellaImg from "@/assets/drink-stella.png";
import drinkHeinekenImg from "@/assets/drink-heineken.png";
import drinkCoronaImg from "@/assets/drink-corona.png";
import drinkCarlsbergImg from "@/assets/drink-carlsberg.png";
import drinkPaulanerImg from "@/assets/drink-paulaner.png";
import drinkWeissImg from "@/assets/drink-weiss.png";
import drinkFlavoredWaterAppleImg from "@/assets/drink-flavored-water-apple.png";
import drinkFlavoredWaterGrapeImg from "@/assets/drink-flavored-water-grape.png";
import drinkGrapesImg from "@/assets/drink-grapes.png";
import drinkOrangesImg from "@/assets/drink-apples.png";

const drinkOptionImages: Record<string, string> = {
  "can-cola": drinkColaImg,
  "can-zero": drinkZeroImg,
  "can-fanta": drinkFantaImg,
  "can-fanta-grape": drinkFantaGrapeImg,
  "can-fanta-exotic": drinkFantaExoticImg,
  "can-sprite": drinkSpriteImg,
  "can-sprite-zero": drinkSpriteZeroImg,
  "can-blu": drinkBluImg,
  "can-mojito": drinkBluMojitoImg,
  "can-day": drinkBluDayImg,
  "can-watermelon": drinkBluWatermelonImg,
  "can-melon-apple": drinkBluMelonAppleImg,
  "bottle-grapes": drinkGrapesImg,
  "bottle-apples": drinkOrangesImg,
  "flavored-water-apple": drinkFlavoredWaterAppleImg,
  "flavored-water-grape": drinkFlavoredWaterGrapeImg,
  "beer-goldstar": drinkGoldstarImg,
  "beer-heineken": drinkHeinekenImg,
  "beer-corona": drinkCoronaImg,
  "beer-carlsberg": drinkCarlsbergImg,
  "beer-stella": drinkStellaImg,
  "beer-paulaner": drinkPaulanerImg,
  "beer-weiss": drinkWeissImg,
};

// Preload all drink icons at module load so they're cached before the selector opens
if (typeof window !== "undefined") {
  Object.values(drinkOptionImages).forEach((src) => {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  });
}


interface DrinkSelectorProps {
  item: MenuItem | null;
  onClose: () => void;
  onConfirm: (item: MenuItem, selectedDrink: string) => void;
  isAvailable?: (id: string) => boolean;
  isKiosk?: boolean;
}

const DrinkSelector = ({ item, onClose, onConfirm, isAvailable, isKiosk = false }: DrinkSelectorProps) => {
  const [selected, setSelected] = useState<string | null>(null);
  const alcoholConsent = useAlcoholConsent();

  if (!item) return null;

  const options = drinkSubOptions[item.id];
  if (!options) return null;

  const isAlcoholSelector = item.id.startsWith("beer-");

  const isDrinkUnavailable = (optId: string) => {
    const availId = drinkToAvailabilityId[optId];
    if (!availId || !isAvailable) return false;
    return !isAvailable(availId);
  };

  const handleConfirm = () => {
    if (!selected) return;

    const option = options.find((o) => o.id === selected);
    const finishSelection = () => {
      onConfirm(item, option?.name || "");
      setSelected(null);
    };

    if (isAlcoholSelector) {
      alcoholConsent.guard(
        { id: `beer-${selected}`, name: "", description: "", price: 0, category: "drink" },
        finishSelection,
      );
      return;
    }

    finishSelection();
  };

  const handleClose = () => {
    setSelected(null);
    onClose();
  };

  return (
    <>
      <AnimatePresence>
        {item && (
          <motion.div
            className={`fixed inset-0 z-50 flex justify-center ${isKiosk ? "items-center p-6" : "items-end"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              role="button"
              tabIndex={0}
              aria-label="סגור בחירת משקה"
              onClick={handleClose}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "Escape") { e.preventDefault(); handleClose(); } }}
              className="absolute inset-0 bg-black/60"
            />
            <motion.div
              className={`relative w-full bg-card overflow-y-auto ${
                isKiosk
                  ? "max-w-3xl rounded-3xl p-10 pb-12 max-h-[85vh]"
                  : "max-w-lg rounded-t-2xl p-6 pb-8 max-h-[70vh]"
              }`}
              initial={isKiosk ? { scale: 0.9, opacity: 0 } : { y: "100%" }}
              animate={isKiosk ? { scale: 1, opacity: 1 } : { y: 0 }}
              exit={isKiosk ? { scale: 0.9, opacity: 0 } : { y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              dir="rtl"
            >
              <button
                onClick={handleClose}
                aria-label="סגור"
                className="absolute left-4 top-4 w-11 h-11 rounded-full bg-secondary flex items-center justify-center"
              >
                <X size={18} />
              </button>

              <h3 className={`font-bold mb-1 ${isKiosk ? "text-4xl" : "text-xl"}`}>{item.name}</h3>
              <p className={`text-muted-foreground ${isKiosk ? "text-xl mb-8" : "text-sm mb-4"}`}>
                בחר/י איזה {item.name} — ₪{item.price}
              </p>

              <div className={isKiosk ? "space-y-4" : "space-y-2"}>
                {options.map((opt) => {
                  const unavailable = isDrinkUnavailable(opt.id);
                  // Hide out-of-stock beer / BLU variants entirely instead of showing "אזל"
                  if (unavailable && (opt.id.startsWith("can-") || opt.id.startsWith("beer-"))) return null;

                  return (
                    <button
                      key={opt.id}
                      disabled={unavailable}
                      onClick={() => !unavailable && setSelected(opt.id)}
                      className={`w-full text-right rounded-xl border transition-all ${
                        isKiosk ? "px-6 py-5" : "px-4 py-3"
                      } ${
                        unavailable
                          ? "border-border bg-muted/30 cursor-not-allowed opacity-60"
                          : selected === opt.id
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-secondary/50 text-foreground hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {unavailable && <span className="text-xs text-destructive">אזל</span>}
                          {!unavailable && selected === opt.id && (
                            <Check size={isKiosk ? 28 : 18} className="text-primary" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
                          <span className={`font-medium ${isKiosk ? "text-2xl" : ""} ${unavailable ? "line-through text-muted-foreground" : ""}`}>{opt.name}</span>
                          {drinkOptionImages[opt.id] && (
                            <img
                              src={drinkOptionImages[opt.id]}
                              alt={opt.name}
                              width={64}
                              height={64}
                              loading="eager"
                              decoding="sync"
                              fetchPriority="high"
                              className={`${isKiosk ? "w-20 h-20" : "w-14 h-14"} object-contain flex-shrink-0 ${unavailable ? "opacity-40 grayscale" : ""}`}
                            />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleConfirm}
                disabled={!selected}
                className={`w-full rounded-xl font-bold transition-all ${
                  isKiosk ? "mt-10 py-5 text-2xl" : "mt-6 py-3 text-lg"
                } ${
                  selected
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                הוסף לסל
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AlcoholConsentModal
        open={alcoholConsent.consentOpen}
        onConfirm={alcoholConsent.confirm}
        onCancel={alcoholConsent.cancel}
      />
    </>
  );
};

export default DrinkSelector;
