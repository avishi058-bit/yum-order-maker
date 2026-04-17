import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { removals, drinkToAvailabilityId } from "@/data/menu";
import { DealBurgerConfig, DealDrinkChoice } from "@/components/CartDrawer";
import { useAlcoholConsent } from "@/hooks/useAlcoholConsent";
import AlcoholConsentModal from "@/components/AlcoholConsentModal";

interface FamilyDealCustomizerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (burgers: DealBurgerConfig[], drinks: DealDrinkChoice[]) => void;
  isAvailable?: (id: string) => boolean;
}

type Step = "burger-1" | "burger-2" | "burger-3" | "burger-4" | "burger-5" | "drinks-ask" | "drink-count" | `drink-${number}`;

const burgerStepLabels: Record<string, string> = {
  "burger-1": "המבורגר 1 מתוך 5",
  "burger-2": "המבורגר 2 מתוך 5",
  "burger-3": "המבורגר 3 מתוך 5",
  "burger-4": "המבורגר 4 מתוך 5",
  "burger-5": "המבורגר 5 מתוך 5",
  "drinks-ask": "רוצים להוסיף שתייה?",
  "drink-count": "כמה שתיות?",
};

const familyDrinkOptions = [
  { id: "fam-cola", name: "קולה (פחית)", price: 10, category: "soft" as const },
  { id: "fam-zero", name: "זירו (פחית)", price: 10, category: "soft" as const },
  { id: "fam-fanta", name: "פאנטה (פחית)", price: 10, category: "soft" as const },
  { id: "fam-sprite", name: "ספרייט (פחית)", price: 10, category: "soft" as const },
  { id: "fam-blu", name: "בלו (פחית)", price: 10, category: "soft" as const },
  { id: "fam-grapes", name: "ענבים (בקבוק)", price: 12, category: "soft" as const },
  { id: "fam-apples", name: "תפוחים (בקבוק)", price: 12, category: "soft" as const },
  { id: "fam-goldstar", name: "גולדסטאר", price: 18, category: "beer" as const },
  { id: "fam-heineken", name: "הייניקן", price: 18, category: "beer" as const },
  { id: "fam-corona", name: "קורונה", price: 18, category: "beer" as const },
  { id: "fam-carlsberg", name: "קאלסברג", price: 18, category: "beer" as const },
  { id: "fam-laffe", name: "לאפ בראון", price: 23, category: "beer" as const },
  { id: "fam-unfiltered", name: "גולדסטאר אנפילטר", price: 23, category: "beer" as const },
  { id: "fam-guinness", name: "גינס", price: 23, category: "beer" as const },
];

const softDrinks = familyDrinkOptions.filter((d) => d.category === "soft");
const beerDrinks = familyDrinkOptions.filter((d) => d.category === "beer");

const FamilyDealCustomizer = ({ open, onClose, onConfirm, isAvailable }: FamilyDealCustomizerProps) => {
  const alcoholConsent = useAlcoholConsent();

  const isDrinkUnavailable = (drinkId: string) => {
    const availId = drinkToAvailabilityId[drinkId];
    if (!availId || !isAvailable) return false;
    return !isAvailable(availId);
  };

  const [step, setStep] = useState<string>("burger-1");
  const [burgerConfigs, setBurgerConfigs] = useState<DealBurgerConfig[]>(
    Array.from({ length: 5 }, () => ({ removals: ["no-changes"], name: "" }))
  );
  const [wantsDrinks, setWantsDrinks] = useState<boolean | null>(null);
  const [drinkCount, setDrinkCount] = useState(0);
  const [selectedDrinks, setSelectedDrinks] = useState<string[]>([]);

  const burgerSteps = ["burger-1", "burger-2", "burger-3", "burger-4", "burger-5"];
  const currentBurgerIndex = burgerSteps.indexOf(step);
  const isDrinkStep = step.startsWith("drink-") && step !== "drink-count";
  const currentDrinkIndex = isDrinkStep ? parseInt(step.split("-")[1]) - 1 : 0;

  const isBeerDrinkId = (drinkId: string) => {
    const drink = familyDrinkOptions.find((option) => option.id === drinkId);
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
    setBurgerConfigs(Array.from({ length: 5 }, () => ({ removals: ["no-changes"], name: "" })));
    setWantsDrinks(null);
    setDrinkCount(0);
    setSelectedDrinks([]);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const toggleRemoval = (id: string) => {
    const idx = currentBurgerIndex;
    if (idx < 0) return;
    setBurgerConfigs((prev) => {
      const updated = [...prev];
      const current = [...updated[idx].removals];
      if (id === "no-changes") {
        updated[idx] = { ...updated[idx], removals: current.includes("no-changes") ? [] : ["no-changes"] };
      } else if (id === "dry") {
        updated[idx] = { ...updated[idx], removals: current.includes("dry") ? ["no-changes"] : ["dry"] };
      } else {
        const filtered = current.filter((r) => r !== "no-changes" && r !== "dry");
        if (filtered.includes(id)) {
          const result = filtered.filter((r) => r !== id);
          updated[idx] = { ...updated[idx], removals: result.length === 0 ? ["no-changes"] : result };
        } else {
          updated[idx] = { ...updated[idx], removals: [...filtered, id] };
        }
      }
      return updated;
    });
  };

  const finishDeal = (drinks: DealDrinkChoice[]) => {
    const cleanBurgers = burgerConfigs.map((b) => ({
      removals: b.removals.filter((r) => r !== "no-changes"),
      name: b.name?.trim() || undefined,
    }));
    onConfirm(cleanBurgers, drinks);
    resetState();
  };

  const handleNext = () => {
    if (burgerSteps.includes(step)) {
      const idx = burgerSteps.indexOf(step);
      if (idx < 4) {
        setStep(burgerSteps[idx + 1]);
      } else {
        setStep("drinks-ask");
      }
    } else if (step === "drinks-ask") {
      if (wantsDrinks === null) return;
      if (!wantsDrinks) {
        finishDeal([]);
      } else {
        setStep("drink-count");
      }
    } else if (step === "drink-count") {
      if (drinkCount <= 0) return;
      setSelectedDrinks(Array(drinkCount).fill(""));
      setStep("drink-1");
    } else if (isDrinkStep) {
      if (selectedDrinks[currentDrinkIndex] === "") return;
      if (currentDrinkIndex < drinkCount - 1) {
        setStep(`drink-${currentDrinkIndex + 2}`);
      } else {
        const drinks: DealDrinkChoice[] = selectedDrinks.map((dId) => {
          const drink = familyDrinkOptions.find((d) => d.id === dId)!;
          return { id: drink.id, name: drink.name, extraCost: drink.price };
        });
        finishDeal(drinks);
      }
    }
  };

  const getStepLabel = () => {
    if (burgerStepLabels[step]) return burgerStepLabels[step];
    if (isDrinkStep) return `שתייה ${currentDrinkIndex + 1} מתוך ${drinkCount}`;
    return "";
  };

  const getProgressSteps = () => {
    const steps = [...burgerSteps];
    if (wantsDrinks && drinkCount > 0) {
      for (let i = 1; i <= drinkCount; i++) steps.push(`drink-${i}`);
    } else {
      steps.push("drinks-ask");
    }
    return steps;
  };

  const progressSteps = getProgressSteps();
  const currentProgressIndex = progressSteps.indexOf(step);
  const currentRemovals = currentBurgerIndex >= 0 ? burgerConfigs[currentBurgerIndex].removals : [];

  if (!open) return null;

  const isNextDisabled =
    (step === "drinks-ask" && wantsDrinks === null) ||
    (step === "drink-count" && drinkCount <= 0) ||
    (isDrinkStep && selectedDrinks[currentDrinkIndex] === "");

  const isLastStep =
    (step === "drinks-ask" && wantsDrinks === false) ||
    (isDrinkStep && currentDrinkIndex === drinkCount - 1);

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
                  <h2 className="text-lg font-bold">דיל משפחתי</h2>
                  <p className="text-sm text-muted-foreground">{getStepLabel()}</p>
                </div>
                <div className="w-9" />
              </div>

              <div className="px-5 pt-3 pb-1">
                <div className="flex gap-1">
                  {progressSteps.map((s, i) => (
                    <div
                      key={s}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        currentProgressIndex >= i ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait">
                {burgerSteps.includes(step) && (
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
                          value={burgerConfigs[currentBurgerIndex]?.name || ""}
                          onChange={(e) => {
                            const idx = currentBurgerIndex;
                            setBurgerConfigs((prev) => {
                              const updated = [...prev];
                              updated[idx] = { ...updated[idx], name: e.target.value };
                              return updated;
                            });
                          }}
                          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
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
                )}

                {step === "drinks-ask" && (
                  <motion.div
                    key="drinks-ask"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="flex-1 overflow-y-auto"
                  >
                    <div className="px-5 py-8 text-center space-y-6">
                      <p className="text-lg font-bold">רוצים להוסיף שתייה?</p>
                      <p className="text-sm text-muted-foreground">השתייה בתשלום מלא (לא כלולה בדיל)</p>
                      <div className="flex gap-4 justify-center">
                        <button
                          onClick={() => setWantsDrinks(true)}
                          className={`px-8 py-3 rounded-xl font-bold text-base transition-colors ${
                            wantsDrinks === true
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          כן 🥤
                        </button>
                        <button
                          onClick={() => setWantsDrinks(false)}
                          className={`px-8 py-3 rounded-xl font-bold text-base transition-colors ${
                            wantsDrinks === false
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          לא
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === "drink-count" && (
                  <motion.div
                    key="drink-count"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="flex-1 overflow-y-auto"
                  >
                    <div className="px-5 py-8 text-center space-y-6">
                      <p className="text-lg font-bold">כמה שתיות?</p>
                      <div className="flex items-center justify-center gap-6">
                        <button
                          onClick={() => setDrinkCount((c) => Math.max(1, c - 1))}
                          className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xl font-bold"
                        >
                          −
                        </button>
                        <span className="text-3xl font-bold text-primary">{drinkCount}</span>
                        <button
                          onClick={() => setDrinkCount((c) => Math.min(10, c + 1))}
                          className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xl font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {isDrinkStep && (
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
                                {!unavailable && <span className="text-xs text-muted-foreground">₪{drink.price}</span>}
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
                                {!unavailable && <span className="text-xs text-muted-foreground">₪{drink.price}</span>}
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
                  whileTap={isNextDisabled ? {} : { scale: 0.97 }}
                  onClick={handleNext}
                  className={`w-full font-bold py-3.5 rounded-xl text-base shadow-lg ${
                    isNextDisabled
                      ? "bg-muted text-muted-foreground shadow-none cursor-not-allowed"
                      : "bg-primary text-primary-foreground shadow-primary/20"
                  }`}
                >
                  {isLastStep ? "הוספה להזמנה 🍔" : "המשך"}
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

export default FamilyDealCustomizer;
