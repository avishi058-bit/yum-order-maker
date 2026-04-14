import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { removals, dealDrinkOptions, DrinkOption } from "@/data/menu";
import { DealBurgerConfig, DealDrinkChoice } from "@/components/CartDrawer";

interface DealCustomizerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (burgers: DealBurgerConfig[], drinks: DealDrinkChoice[]) => void;
}

type Step = "burger-1" | "burger-2" | "burger-3" | "drinks";

const stepLabels: Record<Step, string> = {
  "burger-1": "המבורגר 1 מתוך 3",
  "burger-2": "המבורגר 2 מתוך 3",
  "burger-3": "המבורגר 3 מתוך 3",
  "drinks": "בחירת 3 שתיות",
};

const DealCustomizer = ({ open, onClose, onConfirm }: DealCustomizerProps) => {
  const [step, setStep] = useState<Step>("burger-1");
  const [burgerConfigs, setBurgerConfigs] = useState<DealBurgerConfig[]>([
    { removals: ["no-changes"] },
    { removals: ["no-changes"] },
    { removals: ["no-changes"] },
  ]);
  const [selectedDrinks, setSelectedDrinks] = useState<string[]>(["", "", ""]);

  const currentBurgerIndex = step === "burger-1" ? 0 : step === "burger-2" ? 1 : 2;

  const resetState = () => {
    setStep("burger-1");
    setBurgerConfigs([
      { removals: ["no-changes"] },
      { removals: ["no-changes"] },
      { removals: ["no-changes"] },
    ]);
    setSelectedDrinks(["", "", ""]);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const toggleRemoval = (id: string) => {
    const idx = currentBurgerIndex;
    setBurgerConfigs((prev) => {
      const updated = [...prev];
      const current = [...updated[idx].removals];

      if (id === "no-changes") {
        updated[idx] = { removals: current.includes("no-changes") ? [] : ["no-changes"] };
      } else if (id === "dry") {
        updated[idx] = { removals: current.includes("dry") ? ["no-changes"] : ["dry"] };
      } else {
        const filtered = current.filter((r) => r !== "no-changes" && r !== "dry");
        if (filtered.includes(id)) {
          const result = filtered.filter((r) => r !== id);
          updated[idx] = { removals: result.length === 0 ? ["no-changes"] : result };
        } else {
          updated[idx] = { removals: [...filtered, id] };
        }
      }
      return updated;
    });
  };

  const setDrink = (drinkIndex: number, drinkId: string) => {
    setSelectedDrinks((prev) => {
      const updated = [...prev];
      updated[drinkIndex] = drinkId;
      return updated;
    });
  };

  const handleNext = () => {
    if (step === "burger-1") setStep("burger-2");
    else if (step === "burger-2") setStep("burger-3");
    else if (step === "burger-3") setStep("drinks");
    else {
      if (selectedDrinks.some((d) => d === "")) return;
      const drinks: DealDrinkChoice[] = selectedDrinks.map((dId) => {
        const drink = dealDrinkOptions.find((d) => d.id === dId)!;
        return { id: drink.id, name: drink.name, extraCost: drink.price };
      });
      const cleanBurgers = burgerConfigs.map((b) => ({
        removals: b.removals.filter((r) => r !== "no-changes"),
      }));
      onConfirm(cleanBurgers, drinks);
      resetState();
    }
  };

  const currentRemovals = step !== "drinks" ? burgerConfigs[currentBurgerIndex].removals : [];

  const softDrinks = dealDrinkOptions.filter((d) => d.category === "soft");
  const beerDrinks = dealDrinkOptions.filter((d) => d.category === "beer");

  if (!open) return null;

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
              <div className="flex-1 text-center">
                <h2 className="text-lg font-bold">דיל חברים</h2>
                <p className="text-sm text-muted-foreground">{stepLabels[step]}</p>
              </div>
              <div className="w-9" />
            </div>

            {/* Progress bar */}
            <div className="px-5 pt-3 pb-1">
              <div className="flex gap-1.5">
                {["burger-1", "burger-2", "burger-3", "drinks"].map((s, i) => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      ["burger-1", "burger-2", "burger-3", "drinks"].indexOf(step) >= i
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {step !== "drinks" ? (
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
                    <div className="space-y-0">
                      {removals.map((r) => {
                        const active = currentRemovals.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            onClick={() => toggleRemoval(r.id)}
                            className="w-full flex items-center justify-between py-3.5 border-b border-border/50 last:border-b-0"
                          >
                            <div
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                active ? "border-primary bg-primary" : "border-muted-foreground/40"
                              }`}
                            >
                              {active && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="w-2.5 h-2.5 rounded-full bg-primary-foreground"
                                />
                              )}
                            </div>
                            <span className="font-medium text-base">{r.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="drinks"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="flex-1 overflow-y-auto"
                >
                  {[0, 1, 2].map((drinkIndex) => (
                    <div key={drinkIndex} className="px-5 py-4 border-b border-border last:border-b-0">
                      <h3 className="text-base font-bold text-right mb-3">שתייה {drinkIndex + 1}:</h3>

                      <div className="space-y-0">
                        {softDrinks.map((drink) => {
                          const active = selectedDrinks[drinkIndex] === drink.id;
                          return (
                            <button
                              key={drink.id}
                              onClick={() => setDrink(drinkIndex, drink.id)}
                              className="w-full flex items-center justify-between py-2.5 border-b border-border/30 last:border-b-0"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                    active ? "border-primary bg-primary" : "border-muted-foreground/40"
                                  }`}
                                >
                                  {active && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="w-2 h-2 rounded-full bg-primary-foreground"
                                    />
                                  )}
                                </div>
                                {drink.price > 0 && (
                                  <span className="text-xs text-muted-foreground">+₪{drink.price}</span>
                                )}
                              </div>
                              <span className="font-medium text-sm">{drink.name}</span>
                            </button>
                          );
                        })}
                      </div>

                      <h4 className="text-sm font-bold text-right mt-3 mb-2 text-muted-foreground">בירות:</h4>
                      <div className="space-y-0">
                        {beerDrinks.map((drink) => {
                          const active = selectedDrinks[drinkIndex] === drink.id;
                          return (
                            <button
                              key={drink.id}
                              onClick={() => setDrink(drinkIndex, drink.id)}
                              className="w-full flex items-center justify-between py-2.5 border-b border-border/30 last:border-b-0"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                    active ? "border-primary bg-primary" : "border-muted-foreground/40"
                                  }`}
                                >
                                  {active && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="w-2 h-2 rounded-full bg-primary-foreground"
                                    />
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">+₪{drink.price}</span>
                              </div>
                              <span className="font-medium text-sm">{drink.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="px-5 py-4 border-t border-border bg-card safe-bottom">
              {step === "drinks" && selectedDrinks.some((d) => d === "") && (
                <p className="text-sm text-destructive text-center mb-2">יש לבחור שתייה לכל אחד</p>
              )}
              <motion.button
                whileTap={step === "drinks" && selectedDrinks.some((d) => d === "") ? {} : { scale: 0.97 }}
                onClick={handleNext}
                className={`w-full font-bold py-3.5 rounded-xl text-base shadow-lg ${
                  step === "drinks" && selectedDrinks.some((d) => d === "")
                    ? "bg-muted text-muted-foreground shadow-none cursor-not-allowed"
                    : "bg-primary text-primary-foreground shadow-primary/20"
                }`}
              >
                {step === "drinks" ? "הוספה להזמנה 🍔" : "המשך"}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DealCustomizer;
