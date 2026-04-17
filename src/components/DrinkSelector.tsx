import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { MenuItem, drinkSubOptions, drinkToAvailabilityId } from "@/data/menu";
import { useAlcoholConsent } from "@/hooks/useAlcoholConsent";
import AlcoholConsentModal from "@/components/AlcoholConsentModal";

interface DrinkSelectorProps {
  item: MenuItem | null;
  onClose: () => void;
  onConfirm: (item: MenuItem, selectedDrink: string) => void;
  isAvailable?: (id: string) => boolean;
}

const DrinkSelector = ({ item, onClose, onConfirm, isAvailable }: DrinkSelectorProps) => {
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
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
            <motion.div
              className="relative w-full max-w-lg bg-card rounded-t-2xl p-6 pb-8 max-h-[70vh] overflow-y-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              dir="rtl"
            >
              <button
                onClick={handleClose}
                className="absolute left-4 top-4 w-8 h-8 rounded-full bg-secondary flex items-center justify-center"
              >
                <X size={16} />
              </button>

              <h3 className="text-xl font-bold mb-1">{item.name}</h3>
              <p className="text-muted-foreground text-sm mb-4">
                בחר/י איזה {item.name} — ₪{item.price}
              </p>

              <div className="space-y-2">
                {options.map((opt) => {
                  const unavailable = isDrinkUnavailable(opt.id);
                  return (
                    <button
                      key={opt.id}
                      disabled={unavailable}
                      onClick={() => !unavailable && setSelected(opt.id)}
                      className={`w-full text-right px-4 py-3 rounded-xl border transition-all ${
                        unavailable
                          ? "border-border bg-muted/30 cursor-not-allowed opacity-60"
                          : selected === opt.id
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-secondary/50 text-foreground hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${unavailable ? "line-through text-muted-foreground" : ""}`}>{opt.name}</span>
                        {unavailable && <span className="text-xs text-destructive">אזל</span>}
                        {!unavailable && selected === opt.id && (
                          <Check size={18} className="text-primary" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleConfirm}
                disabled={!selected}
                className={`w-full mt-6 py-3 rounded-xl font-bold text-lg transition-all ${
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
