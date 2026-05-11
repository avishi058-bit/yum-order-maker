import { ingredients } from "@/data/menu";
import aioliImg from "@/assets/aioli-sauce.webp";
import picklesImg from "@/assets/pickles.webp";
import tomatoImg from "@/assets/tomato.webp";
import onionImg from "@/assets/onion.webp";

const ingredientImages: Record<string, string> = {
  "aioli-sauce": aioliImg,
  pickles: picklesImg,
  tomato: tomatoImg,
  onion: onionImg,
};

export type IngredientState = Record<string, boolean>;

/** Default ingredient state for a regular (non-smash) burger — all ON. */
export const defaultRegularIngredientState = (): IngredientState => {
  const state: IngredientState = {};
  ingredients.forEach((ing) => {
    state[ing.id] = ing.defaultRegular;
  });
  return state;
};

/** Convert ingredient state into removals[] for cart/backend, regular burger. */
export const ingredientStateToRemovals = (state: IngredientState): string[] => {
  const result: string[] = [];
  ingredients.forEach((ing) => {
    const isOn = state[ing.id] ?? ing.defaultRegular;
    const def = ing.defaultRegular;
    if (def && !isOn) result.push(ing.removalId);
    else if (!def && isOn && ing.addId) result.push(ing.addId);
  });
  return result;
};

interface Props {
  state: IngredientState;
  onToggle: (id: string) => void;
  isAvailable?: (id: string) => boolean;
  isKiosk?: boolean;
  title?: string;
}

const BurgerIngredientChecklist = ({ state, onToggle, isAvailable, isKiosk, title }: Props) => {
  return (
    <div className={`border-b border-gray-200 ${isKiosk ? "py-6" : "py-4"}`}>
      <h3 className={`font-black text-right mb-1 ${isKiosk ? "text-[30px] mb-3" : "text-lg"}`}>{title || "מה במנה שלך"}</h3>
      <p className={`text-gray-500 text-right ${isKiosk ? "text-[20px] mb-5" : "text-sm mb-3"}`}>לחץ כדי להוסיף או להוריד</p>
      <div className="space-y-0">
        {ingredients.map((ing) => {
          const isOn = state[ing.id] ?? ing.defaultRegular;
          const ingredientUnavailable = isAvailable ? !isAvailable(ing.id) : false;
          if (ingredientUnavailable) return null;
          return (
            <button
              key={ing.id}
              type="button"
              onClick={() => onToggle(ing.id)}
              className={`w-full flex items-center justify-between border-b border-gray-100 last:border-b-0 ${isKiosk ? "py-5" : "py-3"}`}
            >
              <div
                className={`rounded-lg border-2 flex items-center justify-center transition-colors ${isKiosk ? "w-9 h-9" : "w-7 h-7"} ${
                  isOn ? "border-green-500 bg-green-500" : "border-gray-300 bg-white"
                }`}
              >
                {isOn && (
                  <svg
                    className={`text-white ${isKiosk ? "w-6 h-6" : "w-4 h-4"}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span className={`font-bold ${isKiosk ? "text-[30px]" : "text-lg"} ${!isOn ? "text-gray-400 line-through" : ""} flex items-center gap-1.5`}>
                {ing.name.includes("🥬") ? <>{ing.name.replace("🥬 ", "")} 🥬</> : ing.name}
                {ing.image && ingredientImages[ing.image] ? (
                  <img
                    src={ingredientImages[ing.image]}
                    alt={ing.name}
                    className={`inline-block object-contain ${isKiosk ? "w-9 h-9" : "w-7 h-7"}`}
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BurgerIngredientChecklist;
