import { useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { drinkToAvailabilityId, toppings as allToppings } from "@/data/menu";
import { DealBurgerConfig, DealDrinkChoice } from "@/components/CartDrawer";
import { useAlcoholConsent } from "@/hooks/useAlcoholConsent";
import AlcoholConsentModal from "@/components/AlcoholConsentModal";
import BurgerIngredientChecklist, {
  IngredientState,
  defaultRegularIngredientState,
  ingredientStateToRemovals,
} from "@/components/BurgerIngredientChecklist";

interface FamilyDealCustomizerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (burgers: DealBurgerConfig[], drinks: DealDrinkChoice[]) => void;
  isAvailable?: (id: string) => boolean;
}

type Step = `burger-${number}` | `toppings-${number}` | "drinks-ask" | "drink-count" | `drink-${number}`;

const burgerStepLabels: Record<string, string> = {
  "burger-1": "מנה ראשונה מתוך חמש",
  "burger-2": "מנה שנייה מתוך חמש",
  "burger-3": "מנה שלישית מתוך חמש",
  "burger-4": "מנה רביעית מתוך חמש",
  "burger-5": "מנה חמישית מתוך חמש",
  "toppings-1": "תוספות למנה הראשונה",
  "toppings-2": "תוספות למנה השנייה",
  "toppings-3": "תוספות למנה השלישית",
  "toppings-4": "תוספות למנה הרביעית",
  "toppings-5": "תוספות למנה החמישית",
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
  { id: "fam-apples", name: "תפוזים (בקבוק)", price: 12, category: "soft" as const },
  { id: "fam-flavored-water-apple", name: "מים בטעם תפוח", price: 12, category: "soft" as const },
  { id: "fam-flavored-water-grape", name: "מים בטעם ענבים", price: 12, category: "soft" as const },
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
  const location = useLocation();
  const isKiosk = location.pathname === "/kiosk";

  const isDrinkUnavailable = (drinkId: string) => {
    const availId = drinkToAvailabilityId[drinkId];
    if (!availId || !isAvailable) return false;
    return !isAvailable(availId);
  };

  const [step, setStep] = useState<string>("burger-1");
  const [burgerNames, setBurgerNames] = useState<string[]>(Array.from({ length: 5 }, () => ""));
  const [burgerIngredients, setBurgerIngredients] = useState<IngredientState[]>(
    Array.from({ length: 5 }, () => defaultRegularIngredientState())
  );
  const [burgerToppings, setBurgerToppings] = useState<string[][]>(
    Array.from({ length: 5 }, () => [])
  );
  const [wantsDrinks, setWantsDrinks] = useState<boolean | null>(null);
  const [drinkCount, setDrinkCount] = useState(0);
  const [selectedDrinks, setSelectedDrinks] = useState<string[]>([]);

  const burgerSteps = ["burger-1", "burger-2", "burger-3", "burger-4", "burger-5"];
  const toppingsSteps = ["toppings-1", "toppings-2", "toppings-3", "toppings-4", "toppings-5"];
  const mainSteps = burgerSteps.flatMap((b, i) => [b, toppingsSteps[i]]);
  const isBurgerStep = burgerSteps.includes(step);
  const isToppingsStep = toppingsSteps.includes(step);
  const currentBurgerIndex = isBurgerStep
    ? burgerSteps.indexOf(step)
    : isToppingsStep
    ? toppingsSteps.indexOf(step)
    : -1;
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
    setBurgerNames(Array.from({ length: 5 }, () => ""));
    setBurgerIngredients(Array.from({ length: 5 }, () => defaultRegularIngredientState()));
    setBurgerToppings(Array.from({ length: 5 }, () => []));
    setWantsDrinks(null);
    setDrinkCount(0);
    setSelectedDrinks([]);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const toggleIngredient = (ingId: string) => {
    const idx = currentBurgerIndex;
    if (idx < 0 || !isBurgerStep) return;
    setBurgerIngredients((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [ingId]: !updated[idx][ingId] };
      return updated;
    });
  };

  const toggleBurgerTopping = (tId: string) => {
    const idx = currentBurgerIndex;
    if (idx < 0 || !isToppingsStep) return;
    setBurgerToppings((prev) => {
      const updated = prev.map((arr) => [...arr]);
      updated[idx] = updated[idx].includes(tId)
        ? updated[idx].filter((x) => x !== tId)
        : [...updated[idx], tId];
      return updated;
    });
  };

  const finishDeal = (drinks: DealDrinkChoice[]) => {
    const cleanBurgers: DealBurgerConfig[] = burgerIngredients.map((state, i) => ({
      removals: ingredientStateToRemovals(state),
      toppings: burgerToppings[i] ?? [],
      name: burgerNames[i]?.trim() || undefined,
    }));
    onConfirm(cleanBurgers, drinks);
    resetState();
  };


  const handleNext = () => {
    if (isBurgerStep || isToppingsStep) {
      const idx = mainSteps.indexOf(step);
      if (idx < mainSteps.length - 1) {
        setStep(mainSteps[idx + 1]);
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
    const steps = [...mainSteps];
    if (wantsDrinks && drinkCount > 0) {
      for (let i = 1; i <= drinkCount; i++) steps.push(`drink-${i}`);
    } else {
      steps.push("drinks-ask");
    }
    return steps;
  };

  const progressSteps = getProgressSteps();
  const currentProgressIndex = progressSteps.indexOf(step);
  
  const currentToppings = isToppingsStep && currentBurgerIndex >= 0 ? burgerToppings[currentBurgerIndex] : [];
  const currentToppingsTotal = currentToppings.reduce((s, tId) => {
    const t = allToppings.find((x) => x.id === tId);
    return s + (t?.price || 0);
  }, 0);

  

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
                {isBurgerStep && (
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
                      {currentBurgerIndex >= 0 && (
                        <BurgerIngredientChecklist
                          state={burgerIngredients[currentBurgerIndex]}
                          onToggle={toggleIngredient}
                          isAvailable={isAvailable}
                          isKiosk={isKiosk}
                          title={`מה במנה ה${["ראשונה", "שנייה", "שלישית", "רביעית", "חמישית"][currentBurgerIndex]} שלך?`}
                        />
                      )}
                    </div>
                  </motion.div>
                )}

                {isToppingsStep && currentBurgerIndex >= 0 && (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="flex-1 overflow-y-auto"
                  >
                    <div className="px-5 py-4">
                      <h3 className="text-lg font-bold text-right mb-1">
                        תוספות למנה ה{["ראשונה", "שנייה", "שלישית", "רביעית", "חמישית"][currentBurgerIndex]}
                      </h3>
                      <p className="text-sm text-muted-foreground text-right mb-4">
                        אופציונלי — בתשלום נוסף על מחיר הדיל
                      </p>
                      <div className="space-y-0">
                        {allToppings.map((t) => {
                          const active = currentToppings.includes(t.id);
                          const unavailable = isAvailable ? !isAvailable(t.id) : false;
                          return (
                            <button
                              key={t.id}
                              disabled={unavailable}
                              onClick={() => !unavailable && toggleBurgerTopping(t.id)}
                              className={`w-full flex items-center justify-between py-2.5 border-b border-border/30 last:border-b-0 ${unavailable ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                                    unavailable ? "border-muted-foreground/20" : active ? "border-primary bg-primary" : "border-muted-foreground/40"
                                  }`}
                                >
                                  {active && !unavailable && (
                                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-primary-foreground text-xs font-bold">✓</motion.span>
                                  )}
                                </div>
                                {unavailable ? (
                                  <span className="text-xs text-destructive">(אזל)</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">+₪{t.price}</span>
                                )}
                              </div>
                              <span className={`font-medium text-sm text-right ${unavailable ? "line-through text-muted-foreground" : ""}`}>{t.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      {currentToppingsTotal > 0 && (
                        <p className="text-sm font-bold text-primary text-left mt-3">
                          תוספות: +₪{currentToppingsTotal}
                        </p>
                      )}
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

              <div className="px-5 py-4 border-t border-gray-200 bg-white safe-bottom">
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
                  {isLastStep ? "הוספה להזמנה 🍔" : isToppingsStep && currentToppings.length === 0 ? "דלג" : "המשך"}
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
