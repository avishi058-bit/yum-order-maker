// דיל משפחתי: 5 classic burgers, drinks optional (full price, any number).
// Each burger is chosen on the same screen as a single burger, each drink on
// the same list as a meal drink, inside the same sheet (components/deals).
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Minus, Plus } from "lucide-react";
import { drinkToAvailabilityId, DEFAULT_DONENESS } from "@/data/menu";
import DealSheet from "@/components/deals/DealSheet";
import DealBurgerPicker from "@/components/deals/DealBurgerPicker";
import DealDrinkPicker from "@/components/deals/DealDrinkPicker";
import { useTapGuard } from "@/hooks/useTapGuard";
import { useDealNamePrompt } from "@/hooks/useDealNamePrompt";
import DealNamePopup from "@/components/deals/DealNamePopup";
import { DealBurgerConfig, DealDrinkChoice } from "@/components/CartDrawer";
import { useAlcoholConsent } from "@/hooks/useAlcoholConsent";
import AlcoholConsentModal from "@/components/AlcoholConsentModal";
import {
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

// Toppings are on the burger's own screen now (like a single burger).
const burgerStepLabels: Record<string, string> = {
  "burger-1": "המבורגר ראשון מתוך חמישה",
  "burger-2": "המבורגר שני מתוך חמישה",
  "burger-3": "המבורגר שלישי מתוך חמישה",
  "burger-4": "המבורגר רביעי מתוך חמישה",
  "burger-5": "המבורגר חמישי מתוך חמישה",
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


const FamilyDealCustomizer = ({ open, onClose, onConfirm, isAvailable }: FamilyDealCustomizerProps) => {
  const alcoholConsent = useAlcoholConsent();
  const namePrompt = useDealNamePrompt();
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
  const [burgerDoneness, setBurgerDoneness] = useState<string[]>(
    Array.from({ length: 5 }, () => DEFAULT_DONENESS)
  );
  const [wantsDrinks, setWantsDrinks] = useState<boolean | null>(null);
  const [drinkCount, setDrinkCount] = useState(0);
  const [selectedDrinks, setSelectedDrinks] = useState<string[]>([]);

  const burgerSteps = ["burger-1", "burger-2", "burger-3", "burger-4", "burger-5"];
  const mainSteps = burgerSteps;
  const isBurgerStep = burgerSteps.includes(step);
  const currentBurgerIndex = isBurgerStep ? burgerSteps.indexOf(step) : -1;
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
    namePrompt.reset();
    setStep("burger-1");
    setBurgerNames(Array.from({ length: 5 }, () => ""));
    setBurgerIngredients(Array.from({ length: 5 }, () => defaultRegularIngredientState()));
    setBurgerToppings(Array.from({ length: 5 }, () => []));
    setBurgerDoneness(Array.from({ length: 5 }, () => DEFAULT_DONENESS));
    setWantsDrinks(null);
    setDrinkCount(0);
    setSelectedDrinks([]);
  };

  // Every open starts clean. The kiosk idle reset (and other screens) can
  // close this sheet without going through handleClose, which used to leave
  // the previous customer's paid toppings selected for the next one.
  useEffect(() => {
    if (open) resetState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    if (idx < 0 || !isBurgerStep) return;
    setBurgerToppings((prev) => {
      const updated = prev.map((arr) => [...arr]);
      updated[idx] = updated[idx].includes(tId)
        ? updated[idx].filter((x) => x !== tId)
        : [...updated[idx], tId];
      return updated;
    });
  };

  const finishDeal = (drinks: DealDrinkChoice[]) => {
    const donenessOn = !isAvailable || isAvailable("doneness-category");
    const cleanBurgers: DealBurgerConfig[] = burgerIngredients.map((state, i) => ({
      removals: [
        ...ingredientStateToRemovals(state),
        ...(donenessOn ? [burgerDoneness[i] ?? DEFAULT_DONENESS] : []),
      ],
      toppings: burgerToppings[i] ?? [],
      name: burgerNames[i]?.trim() || undefined,
    }));
    onConfirm(cleanBurgers, drinks);
    resetState();
  };


  const handleNext = () => {
    if (isBurgerStep) {
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
  
  const { markScroll, guard } = useTapGuard();

  if (!open) return null;

  const isNextDisabled =
    (step === "drinks-ask" && wantsDrinks === null) ||
    (step === "drink-count" && drinkCount <= 0) ||
    (isDrinkStep && selectedDrinks[currentDrinkIndex] === "");

  const isLastStep =
    (step === "drinks-ask" && wantsDrinks === false) ||
    (isDrinkStep && currentDrinkIndex === drinkCount - 1);

  const bigChoice = (on: boolean) =>
    `flex-1 rounded-2xl border-2 font-black transition-colors ${isKiosk ? "py-6 text-[26px]" : "py-4 text-lg"} ${
      on ? "border-primary bg-primary text-primary-foreground" : "border-gray-200 bg-white text-black"
    }`;

  return (
    <>
      <DealSheet
        open={open}
        isKiosk={isKiosk}
        title="דיל משפחתי"
        stepLabel={getStepLabel()}
        progress={{ current: Math.max(0, currentProgressIndex), total: progressSteps.length }}
        stepKey={step}
        onClose={handleClose}
        onScroll={markScroll}
        footer={{
          label: isLastStep ? "הוספה להזמנה 🍔" : "המשך",
          onClick: isBurgerStep
            ? () => namePrompt.ask(!!burgerNames[currentBurgerIndex]?.trim(), handleNext)
            : handleNext,
          disabled: isNextDisabled,
          note: isDrinkStep && selectedDrinks[currentDrinkIndex] === "" ? "יש לבחור שתייה" : undefined,
        }}
      >
        {isBurgerStep && currentBurgerIndex >= 0 && (
          <DealBurgerPicker
            isKiosk={isKiosk}
            guard={guard}
            isAvailable={isAvailable}
            name={burgerNames[currentBurgerIndex] || ""}
            onName={(v) => setBurgerNames((prev) => prev.map((n, i) => (i === currentBurgerIndex ? v : n)))}
            doneness={burgerDoneness[currentBurgerIndex]}
            onDoneness={(id) => setBurgerDoneness((prev) => prev.map((d, i) => (i === currentBurgerIndex ? id : d)))}
            ingredientState={burgerIngredients[currentBurgerIndex]}
            onToggleIngredient={toggleIngredient}
            selectedToppings={burgerToppings[currentBurgerIndex]}
            onToggleTopping={toggleBurgerTopping}
            nameMode={namePrompt.mode}
          />
        )}

        {step === "drinks-ask" && (
          <div className={`text-center ${isKiosk ? "px-8 py-10" : "px-5 py-8"}`}>
            <h3 className={`font-black ${isKiosk ? "text-[34px]" : "text-2xl"}`}>רוצים להוסיף שתייה?</h3>
            <p className={`text-gray-500 mt-1 ${isKiosk ? "text-[20px] mb-8" : "text-base mb-6"}`}>השתייה בתשלום מלא (לא כלולה בדיל)</p>
            <div className={`flex ${isKiosk ? "gap-4" : "gap-3"}`}>
              <button onClick={guard(() => setWantsDrinks(true))} aria-pressed={wantsDrinks === true} className={bigChoice(wantsDrinks === true)}>כן 🥤</button>
              <button onClick={guard(() => setWantsDrinks(false))} aria-pressed={wantsDrinks === false} className={bigChoice(wantsDrinks === false)}>לא</button>
            </div>
          </div>
        )}

        {step === "drink-count" && (
          <div className={`text-center ${isKiosk ? "px-8 py-10" : "px-5 py-8"}`}>
            <h3 className={`font-black ${isKiosk ? "text-[34px] mb-8" : "text-2xl mb-6"}`}>כמה שתיות?</h3>
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setDrinkCount((c) => Math.max(1, c - 1))}
                aria-label="פחות"
                className={`rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition ${isKiosk ? "w-16 h-16" : "w-12 h-12"}`}
              >
                <Minus size={isKiosk ? 28 : 22} />
              </button>
              <span className={`font-black text-primary w-12 ${isKiosk ? "text-[48px]" : "text-4xl"}`}>{drinkCount}</span>
              <button
                onClick={() => setDrinkCount((c) => Math.min(10, c + 1))}
                aria-label="עוד"
                className={`rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition ${isKiosk ? "w-16 h-16" : "w-12 h-12"}`}
              >
                <Plus size={isKiosk ? 28 : 22} />
              </button>
            </div>
          </div>
        )}

        {isDrinkStep && (
          <DealDrinkPicker
            isKiosk={isKiosk}
            guard={guard}
            title="בחר שתייה:"
            options={familyDrinkOptions}
            selected={selectedDrinks[currentDrinkIndex]}
            onSelect={(id) => handleDrinkSelect(currentDrinkIndex, id)}
            isUnavailable={isDrinkUnavailable}
            priceMode="full"
          />
        )}
      </DealSheet>

      <DealNamePopup
        open={namePrompt.open}
        isKiosk={isKiosk}
        value={currentBurgerIndex >= 0 ? burgerNames[currentBurgerIndex] || "" : ""}
        onChange={(v) => setBurgerNames((prev) => prev.map((n, i) => (i === currentBurgerIndex ? v : n)))}
        onDone={() => namePrompt.finish(!burgerNames[currentBurgerIndex]?.trim())}
        onSkip={() => {
          setBurgerNames((prev) => prev.map((n, i) => (i === currentBurgerIndex ? "" : n)));
          namePrompt.finish(true);
        }}
      />

      <AlcoholConsentModal
        open={alcoholConsent.consentOpen}
        onConfirm={alcoholConsent.confirm}
        onCancel={alcoholConsent.cancel}
      />
    </>
  );
};

export default FamilyDealCustomizer;
