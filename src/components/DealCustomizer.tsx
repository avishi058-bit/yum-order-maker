import { useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { dealDrinkOptions, drinkToAvailabilityId } from "@/data/menu";
import { DealBurgerConfig, DealDrinkChoice } from "@/components/CartDrawer";
import { useAlcoholConsent } from "@/hooks/useAlcoholConsent";
import AlcoholConsentModal from "@/components/AlcoholConsentModal";
import BurgerIngredientChecklist, {
  IngredientState,
  defaultRegularIngredientState,
  ingredientStateToRemovals,
} from "@/components/BurgerIngredientChecklist";

interface DealCustomizerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (burgers: DealBurgerConfig[], drinks: DealDrinkChoice[]) => void;
  isAvailable?: (id: string) => boolean;
}

type Step = "burger-1" | "burger-2" | "burger-3" | "drink-1" | "drink-2" | "drink-3";

const stepLabels: Record<Step, string> = {
  "burger-1": "מנה ראשונה מתוך שלוש",
  "burger-2": "מנה שנייה מתוך שלוש",
  "burger-3": "מנה שלישית מתוך שלוש",
  "drink-1": "שתייה 1 מתוך 3",
  "drink-2": "שתייה 2 מתוך 3",
  "drink-3": "שתייה 3 מתוך 3",
};

const DealCustomizer = ({ open, onClose, onConfirm, isAvailable }: DealCustomizerProps) => {
  const alcoholConsent = useAlcoholConsent();

  const isDrinkUnavailable = (drinkId: string) => {
    const availId = drinkToAvailabilityId[drinkId];
    if (!availId || !isAvailable) return false;
    return !isAvailable(availId);
  };

  const location = useLocation();
  const isKiosk = location.pathname === "/kiosk";

  const [step, setStep] = useState<Step>("burger-1");
  const [burgerNames, setBurgerNames] = useState<string[]>(["", "", ""]);
  const [burgerIngredients, setBurgerIngredients] = useState<IngredientState[]>([
    defaultRegularIngredientState(),
    defaultRegularIngredientState(),
    defaultRegularIngredientState(),
  ]);
  const [selectedDrinks, setSelectedDrinks] = useState<string[]>(["", "", ""]);

  const currentBurgerIndex = step === "burger-1" ? 0 : step === "burger-2" ? 1 : 2;
  const isDrinkStep = step === "drink-1" || step === "drink-2" || step === "drink-3";
  const currentDrinkIndex = step === "drink-1" ? 0 : step === "drink-2" ? 1 : 2;

  const isBeerDrinkId = (drinkId: string) => {
    const drink = dealDrinkOptions.find((option) => option.id === drinkId);
    return drink?.category === "beer";
  };

  const setDrink = (drinkIndex: number, drinkId: string) => {
    setSelectedDrinks((prev) => {
      const updated = [...prev];
      updated[drinkIndex] = drinkId;
      return updated;
    });
  };

  const handleDrinkSelect = (drinkIndex: number, drinkId: string) => {
    if (isBeerDrinkId(drinkId)) {
      alcoholConsent.guard(
        { id: `beer-${drinkId}`, name: "", description: "", price: 0, category: "drink" },
        () => setDrink(drinkIndex, drinkId),
      );
      return;
    }

    setDrink(drinkIndex, drinkId);
  };

  const resetState = () => {
    setStep("burger-1");
    setBurgerNames(["", "", ""]);
    setBurgerIngredients([
      defaultRegularIngredientState(),
      defaultRegularIngredientState(),
      defaultRegularIngredientState(),
    ]);
    setSelectedDrinks(["", "", ""]);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const toggleIngredient = (ingId: string) => {
    const idx = currentBurgerIndex;
    setBurgerIngredients((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [ingId]: !updated[idx][ingId] };
      return updated;
    });
  };

  const handleNext = () => {
    if (step === "burger-1") setStep("burger-2");
    else if (step === "burger-2") setStep("burger-3");
    else if (step === "burger-3") setStep("drink-1");
    else if (step === "drink-1") {
      if (selectedDrinks[0] === "") return;
      setStep("drink-2");
    } else if (step === "drink-2") {
      if (selectedDrinks[1] === "") return;
      setStep("drink-3");
    } else if (step === "drink-3") {
      if (selectedDrinks[2] === "") return;
      const drinks: DealDrinkChoice[] = selectedDrinks.map((dId) => {
        const drink = dealDrinkOptions.find((d) => d.id === dId)!;
        return { id: drink.id, name: drink.name, extraCost: drink.price };
      });
      const cleanBurgers: DealBurgerConfig[] = burgerIngredients.map((state, i) => ({
        removals: ingredientStateToRemovals(state),
        name: burgerNames[i]?.trim() || undefined,
      }));
      onConfirm(cleanBurgers, drinks);
      resetState();
    }
  };

  const softDrinks = dealDrinkOptions.filter((d) => d.category === "soft");
  const beerDrinks = dealDrinkOptions.filter((d) => d.category === "beer");

  if (!open) return null;

  return (
    <>
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
              className="fixed bottom-0 left-0 right-0 z-50 bg-white text-black rounded-t-3xl max-h-[85vh] flex flex-col"
              dir="rtl"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1.5 rounded-full bg-muted" />
              </div>

              <div className="flex items-center justify-between px-5 pb-4 border-b border-border">
                <button onClick={handleClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                  <X size={18} />
                </button>
                <div className="flex-1 text-center">
                  <h2 className="text-lg font-bold">דיל חברים</h2>
                  <p className="text-sm text-muted-foreground">{stepLabels[step]}</p>
                </div>
                <div className="w-9" />
              </div>

              <div className="px-5 pt-3 pb-1">
                <div className="flex gap-1.5">
                  {(["burger-1", "burger-2", "burger-3", "drink-1", "drink-2", "drink-3"] as Step[]).map((s, i) => (
                    <div
                      key={s}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        (["burger-1", "burger-2", "burger-3", "drink-1", "drink-2", "drink-3"] as Step[]).indexOf(step) >= i
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait">
                {!isDrinkStep ? (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="flex-1 overflow-y-auto"
                  >
                    <div className="px-5 py-4">
                      <h3 className="text-lg font-bold text-right mb-1">קלאסי (220 גרם)</h3>
                      <p className="text-sm text-muted-foreground text-right mb-4">בצל, עגבנייה, חסה, חמוצים ואיולי הבית</p>
                      <div className="mb-4">
                        <input
                          type="text"
                          placeholder="שם (לא חובה)"
                          value={burgerNames[currentBurgerIndex] || ""}
                          onChange={(e) => {
                            const idx = currentBurgerIndex;
                            const value = e.target.value;
                            setBurgerNames((prev) => {
                              const updated = [...prev];
                              updated[idx] = value;
                              return updated;
                            });
                          }}
                          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <BurgerIngredientChecklist
                        state={burgerIngredients[currentBurgerIndex]}
                        onToggle={toggleIngredient}
                        isAvailable={isAvailable}
                        isKiosk={isKiosk}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="flex-1 overflow-y-auto"
                  >
                    <div className="px-5 py-4">
                      <h3 className="text-base font-bold text-right mb-3">בחר שתייה:</h3>

                      <div className="space-y-0">
                        {softDrinks.map((drink) => {
                          const active = selectedDrinks[currentDrinkIndex] === drink.id;
                          const unavailable = isDrinkUnavailable(drink.id);
                          return (
                            <button
                              key={drink.id}
                              disabled={unavailable}
                              onClick={() => !unavailable && handleDrinkSelect(currentDrinkIndex, drink.id)}
                              className={`w-full flex items-center justify-between py-2.5 border-b border-border/30 last:border-b-0 ${unavailable ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                    unavailable ? "border-muted-foreground/20" : active ? "border-primary bg-primary" : "border-muted-foreground/40"
                                  }`}
                                >
                                  {active && !unavailable && (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2 h-2 rounded-full bg-primary-foreground" />
                                  )}
                                </div>
                                {unavailable && <span className="text-xs text-destructive">(אזל)</span>}
                                {!unavailable && drink.price > 0 && (
                                  <span className="text-xs text-muted-foreground">+₪{drink.price}</span>
                                )}
                              </div>
                              <span className={`font-medium text-sm ${unavailable ? "line-through text-muted-foreground" : ""}`}>{drink.name}</span>
                            </button>
                          );
                        })}
                      </div>

                      <h4 className="text-sm font-bold text-right mt-3 mb-2 text-muted-foreground">בירות:</h4>
                      <div className="space-y-0">
                        {beerDrinks.map((drink) => {
                          const active = selectedDrinks[currentDrinkIndex] === drink.id;
                          const unavailable = isDrinkUnavailable(drink.id);
                          return (
                            <button
                              key={drink.id}
                              disabled={unavailable}
                              onClick={() => !unavailable && handleDrinkSelect(currentDrinkIndex, drink.id)}
                              className={`w-full flex items-center justify-between py-2.5 border-b border-border/30 last:border-b-0 ${unavailable ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                    unavailable ? "border-muted-foreground/20" : active ? "border-primary bg-primary" : "border-muted-foreground/40"
                                  }`}
                                >
                                  {active && !unavailable && (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2 h-2 rounded-full bg-primary-foreground" />
                                  )}
                                </div>
                                {unavailable && <span className="text-xs text-destructive">(אזל)</span>}
                                {!unavailable && <span className="text-xs text-muted-foreground">+₪{drink.price}</span>}
                              </div>
                              <span className={`font-medium text-sm ${unavailable ? "line-through text-muted-foreground" : ""}`}>{drink.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="px-5 py-4 border-t border-border bg-card safe-bottom">
                {isDrinkStep && selectedDrinks[currentDrinkIndex] === "" && (
                  <p className="text-sm text-destructive text-center mb-2">יש לבחור שתייה</p>
                )}
                <motion.button
                  whileTap={isDrinkStep && selectedDrinks[currentDrinkIndex] === "" ? {} : { scale: 0.97 }}
                  onClick={handleNext}
                  className={`w-full font-bold py-3.5 rounded-xl text-base shadow-lg ${
                    isDrinkStep && selectedDrinks[currentDrinkIndex] === ""
                      ? "bg-muted text-muted-foreground shadow-none cursor-not-allowed"
                      : "bg-primary text-primary-foreground shadow-primary/20"
                  }`}
                >
                  {step === "drink-3" ? "הוספה להזמנה 🍔" : "המשך"}
                </motion.button>
              </div>
            </motion.div>
          </>
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

export default DealCustomizer;
