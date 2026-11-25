// דיל חברים: 3 classic burgers + 3 drinks. Each burger is chosen on the same
// screen as a single burger (DealBurgerPicker), each drink on the same list
// as a meal drink (DealDrinkPicker), inside the same sheet (DealSheet).
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { dealDrinkOptions, drinkToAvailabilityId, DEFAULT_DONENESS } from "@/data/menu";
import DealSheet from "@/components/deals/DealSheet";
import { useTapGuard } from "@/hooks/useTapGuard";
import DealBurgerPicker from "@/components/deals/DealBurgerPicker";
import DealDrinkPicker, { type DealDrinkOption } from "@/components/deals/DealDrinkPicker";
import { DealBurgerConfig, DealDrinkChoice } from "@/components/CartDrawer";
import { useAlcoholConsent } from "@/hooks/useAlcoholConsent";
import AlcoholConsentModal from "@/components/AlcoholConsentModal";
import {
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

// Toppings are on the burger's own screen now (like a single burger).
type Step = "burger-1" | "burger-2" | "burger-3" | "drink-1" | "drink-2" | "drink-3";

const STEP_ORDER: Step[] = ["burger-1", "burger-2", "burger-3", "drink-1", "drink-2", "drink-3"];

const stepLabels: Record<Step, string> = {
  "burger-1": "המבורגר ראשון מתוך שלושה",
  "burger-2": "המבורגר שני מתוך שלושה",
  "burger-3": "המבורגר שלישי מתוך שלושה",
  "drink-1": "שתייה ראשונה מתוך שלוש",
  "drink-2": "שתייה שנייה מתוך שלוש",
  "drink-3": "שתייה שלישית מתוך שלוש",
};

const burgerStepIndex = (step: Step): number =>
  step === "burger-1" ? 0 : step === "burger-2" ? 1 : step === "burger-3" ? 2 : -1;

const drinkStepIndex = (step: Step): number =>
  step === "drink-1" ? 0 : step === "drink-2" ? 1 : step === "drink-3" ? 2 : -1;

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
  const [burgerToppings, setBurgerToppings] = useState<string[][]>([[], [], []]);
  const [burgerDoneness, setBurgerDoneness] = useState<string[]>([DEFAULT_DONENESS, DEFAULT_DONENESS, DEFAULT_DONENESS]);
  const [selectedDrinks, setSelectedDrinks] = useState<string[]>(["", "", ""]);

  const currentBurgerIndex = burgerStepIndex(step);
  const isBurgerStep = step.startsWith("burger-");
  const isDrinkStep = step.startsWith("drink-");
  const currentDrinkIndex = drinkStepIndex(step);

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
    setBurgerToppings([[], [], []]);
    setBurgerDoneness([DEFAULT_DONENESS, DEFAULT_DONENESS, DEFAULT_DONENESS]);
    setSelectedDrinks(["", "", ""]);
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
    if (idx < 0) return;
    setBurgerIngredients((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [ingId]: !updated[idx][ingId] };
      return updated;
    });
  };

  const toggleBurgerTopping = (tId: string) => {
    const idx = currentBurgerIndex;
    if (idx < 0) return;
    setBurgerToppings((prev) => {
      const updated = prev.map((arr) => [...arr]);
      updated[idx] = updated[idx].includes(tId)
        ? updated[idx].filter((x) => x !== tId)
        : [...updated[idx], tId];
      return updated;
    });
  };

  const handleNext = () => {
    const i = STEP_ORDER.indexOf(step);
    const next = STEP_ORDER[i + 1];
    if (isDrinkStep && selectedDrinks[currentDrinkIndex] === "") return;
    if (step === "drink-3") {
      const drinks: DealDrinkChoice[] = selectedDrinks.map((dId) => {
        const drink = dealDrinkOptions.find((d) => d.id === dId)!;
        return { id: drink.id, name: drink.name, extraCost: drink.price };
      });
      const donenessOn = !isAvailable || isAvailable("doneness-category");
      const cleanBurgers: DealBurgerConfig[] = burgerIngredients.map((state, idx) => ({
        removals: [
          ...ingredientStateToRemovals(state),
          ...(donenessOn ? [burgerDoneness[idx] ?? DEFAULT_DONENESS] : []),
        ],
        toppings: burgerToppings[idx] ?? [],
        name: burgerNames[idx]?.trim() || undefined,
      }));
      onConfirm(cleanBurgers, drinks);
      resetState();
      return;
    }
    setStep(next);
  };

  const { markScroll, guard } = useTapGuard();

  if (!open) return null;

  const drinkMissing = isDrinkStep && selectedDrinks[currentDrinkIndex] === "";

  return (
    <>
      <DealSheet
        open={open}
        isKiosk={isKiosk}
        title="דיל חברים"
        stepLabel={stepLabels[step]}
        progress={{ current: STEP_ORDER.indexOf(step), total: STEP_ORDER.length }}
        stepKey={step}
        onClose={handleClose}
        onScroll={markScroll}
        footer={{
          label: step === "drink-3" ? "הוספה להזמנה 🍔" : "המשך",
          onClick: handleNext,
          disabled: drinkMissing,
          note: drinkMissing ? "יש לבחור שתייה" : undefined,
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
          />
        )}
        {isDrinkStep && (
          <DealDrinkPicker
            isKiosk={isKiosk}
            guard={guard}
            title="בחר שתייה:"
            options={dealDrinkOptions as DealDrinkOption[]}
            selected={selectedDrinks[currentDrinkIndex]}
            onSelect={(id) => handleDrinkSelect(currentDrinkIndex, id)}
            isUnavailable={isDrinkUnavailable}
            priceMode="extra"
          />
        )}
      </DealSheet>

      <AlcoholConsentModal
        open={alcoholConsent.consentOpen}
        onConfirm={alcoholConsent.confirm}
        onCancel={alcoholConsent.cancel}
      />
    </>
  );
};

export default DealCustomizer;
