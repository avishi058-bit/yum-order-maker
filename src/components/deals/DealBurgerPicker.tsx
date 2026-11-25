// One classic burger inside a deal - the same screen as ordering a single
// burger: photo, name, doneness, "מה במנה שלך", paid toppings and an optional
// name on the dish. Only the deal's own rules differ (classic only, toppings
// are on/off, paid on top of the deal price).
import { useState } from "react";
import { Check } from "lucide-react";
import { ingredients, toppings as allToppings, donenessOptions, excludedToppingsByItem } from "@/data/menu";
import { menuImages } from "@/data/menuImages";
import { pattyText } from "@/lib/pattyGrams";
import { donenessImages, ingredientImages } from "@/lib/customizerImages";
import type { IngredientState } from "@/components/BurgerIngredientChecklist";
import type { TapGuard } from "@/hooks/useTapGuard";

/** Toppings the single classic burger offers (same filters as ItemCustomizer). */
const HIDDEN_TOPPINGS = ["arayes-extra-quarter", "pickled-jalapeno-side", "extra-smash-patty", "extra-vegan-patty"];
const dealToppings = allToppings.filter(
  (t) => !HIDDEN_TOPPINGS.includes(t.id) && !(excludedToppingsByItem.classic ?? []).includes(t.id),
);

type Props = {
  isKiosk: boolean;
  guard: TapGuard;
  isAvailable?: (id: string) => boolean;
  name: string;
  onName: (v: string) => void;
  doneness: string;
  onDoneness: (id: string) => void;
  ingredientState: IngredientState;
  onToggleIngredient: (id: string) => void;
  selectedToppings: string[];
  onToggleTopping: (id: string) => void;
};

const DealBurgerPicker = ({
  isKiosk, guard, isAvailable, name, onName, doneness, onDoneness,
  ingredientState, onToggleIngredient, selectedToppings, onToggleTopping,
}: Props) => {
  const [nameOpen, setNameOpen] = useState(!!name);
  const available = (id: string) => !isAvailable || isAvailable(id);
  const section = `border-b border-gray-200 ${isKiosk ? "px-8 py-6" : "px-5 py-4"}`;
  const h3 = `font-black text-right mb-1 ${isKiosk ? "text-[30px] mb-3" : "text-lg"}`;
  const sub = `text-gray-500 text-right ${isKiosk ? "text-[20px] mb-5" : "text-sm mb-3"}`;
  const row = `w-full flex items-center justify-between border-b border-gray-100 last:border-b-0 ${isKiosk ? "py-5" : "py-3"}`;
  const circle = (on: boolean) =>
    `rounded-full border-2 flex items-center justify-center transition-colors ${isKiosk ? "w-9 h-9" : "w-7 h-7"} ${on ? "border-primary bg-primary" : "border-gray-300"}`;
  const visibleDoneness = available("doneness-category") ? donenessOptions.filter((d) => available(d.id)) : [];

  return (
    <>
      <div className="relative w-full overflow-hidden" style={{ height: isKiosk ? 300 : 220 }}>
        <img src={menuImages.classic} alt="קלאסי" className="w-full h-full object-cover" draggable={false} />
      </div>
      <div className={isKiosk ? "mx-8 mt-4" : "mx-5 mt-3"}>
        <p className={`font-black text-right ${isKiosk ? "text-[30px]" : "text-xl"}`}>{pattyText("קלאסי (220 גרם)")}</p>
        <p className={`text-black font-bold leading-relaxed text-right ${isKiosk ? "text-[20px]" : "text-base"}`}>
          בצל, עגבנייה, חסה, חמוצים ואיולי הבית
        </p>
        {nameOpen ? (
          <label className="block mt-3">
            <span className={`block font-bold text-gray-700 ${isKiosk ? "text-[22px] mb-2" : "text-sm mb-1"}`}>
              שם על המנה <span className="font-normal text-gray-500">(אפשר לדלג)</span>
            </span>
            <input
              type="text"
              value={name}
              maxLength={30}
              onChange={(e) => onName(e.target.value.slice(0, 30))}
              placeholder="שם (למשל: יוסי)"
              autoComplete="off"
              enterKeyHint="done"
              dir="rtl"
              style={{ fontSize: isKiosk ? "24px" : "16px" }}
              className={`w-full bg-white border-2 border-gray-200 rounded-xl text-right focus:outline-none focus:border-primary transition-colors ${isKiosk ? "px-5 py-4" : "px-4 py-2.5"}`}
            />
          </label>
        ) : (
          <button
            type="button"
            onClick={guard(() => setNameOpen(true))}
            className={`mt-3 w-full rounded-xl border-2 border-dashed border-primary/60 bg-primary/10 font-bold text-primary active:scale-[0.99] transition-transform ${isKiosk ? "text-[22px] py-3" : "text-base py-2.5"}`}
          >
            + רוצה להוסיף שם על המנה?
          </button>
        )}
      </div>

      {visibleDoneness.length > 0 && (
        <div className={section}>
          <h3 className={h3}>בחר מידת עשייה</h3>
          <p className={sub}>חובה לבחור אחת</p>
          {visibleDoneness.map((d) => {
            const active = doneness === d.id;
            return (
              <button key={d.id} onClick={guard(() => onDoneness(d.id))} aria-pressed={active} className={row}>
                <div className={circle(active)}>
                  {active && <Check size={isKiosk ? 20 : 16} className="text-primary-foreground" strokeWidth={4} />}
                </div>
                <div className="flex items-center gap-3">
                  {d.recommended && (
                    <span className={`font-bold bg-green-500 text-white rounded-full whitespace-nowrap ${isKiosk ? "text-[16px] px-3 py-1.5" : "text-xs px-2 py-1"}`}>מומלץ</span>
                  )}
                  <span className={`font-bold flex items-center gap-1.5 ${isKiosk ? "text-[26px]" : "text-base"}`}>
                    {d.label} ({d.shortLabel})
                    {d.image && donenessImages[d.image] && (
                      <img src={donenessImages[d.image]} alt={d.label} className={`inline-block object-contain rounded ${isKiosk ? "w-14 h-14" : "w-10 h-10"}`} />
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className={section}>
        <h3 className={h3}>מה במנה שלך</h3>
        <p className={sub}>לחץ כדי להוסיף או להוריד</p>
        {ingredients.filter((ing) => available(ing.id)).map((ing) => {
          const isOn = ingredientState[ing.id] ?? ing.defaultRegular;
          return (
            <button key={ing.id} onClick={guard(() => onToggleIngredient(ing.id))} aria-pressed={isOn} className={row}>
              <div className={`rounded-lg border-2 flex items-center justify-center transition-colors ${isKiosk ? "w-9 h-9" : "w-7 h-7"} ${isOn ? "border-green-500 bg-green-500" : "border-gray-300 bg-white"}`}>
                {isOn && <Check size={isKiosk ? 22 : 16} className="text-white" strokeWidth={3} />}
              </div>
              <span className={`font-bold flex items-center gap-1.5 ${isKiosk ? "text-[30px]" : "text-lg"} ${!isOn ? "text-gray-400 line-through" : ""}`}>
                {ing.name.includes("🥬") ? <>{ing.name.replace("🥬 ", "")} 🥬</> : ing.name}
                {ing.image && ingredientImages[ing.image] && (
                  <img src={ingredientImages[ing.image]} alt={ing.name} className={`inline-block object-contain ${isKiosk ? "w-9 h-9" : "w-7 h-7"}`} />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className={isKiosk ? "px-8 py-6" : "px-5 py-4"}>
        <h3 className={h3}>תוספות בתשלום</h3>
        <p className={sub}>בתשלום נוסף על מחיר הדיל</p>
        {dealToppings.map((t) => {
          const out = !available(t.id);
          const active = selectedToppings.includes(t.id);
          return (
            <button
              key={t.id}
              disabled={out}
              onClick={guard(() => { if (!out) onToggleTopping(t.id); })}
              aria-pressed={active}
              className={`${row} ${out ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div className={circle(active && !out)}>
                  {active && !out && <Check size={isKiosk ? 20 : 16} className="text-primary-foreground" strokeWidth={4} />}
                </div>
                <span className={`text-gray-500 font-medium ${isKiosk ? "text-[20px]" : "text-sm"}`}>{out ? "(אזל)" : `+ ₪${t.price}`}</span>
              </div>
              <span className={`font-bold flex items-center gap-1.5 ${isKiosk ? "text-[30px]" : "text-lg"} ${out ? "line-through text-gray-400" : ""}`}>
                {t.name}
                {t.image && ingredientImages[t.image] && (
                  <img src={ingredientImages[t.image]} alt={t.name} className={`inline-block object-contain ${t.image === "extra-patty" ? (isKiosk ? "w-[60px] h-[60px]" : "w-12 h-12") : (isKiosk ? "w-9 h-9" : "w-7 h-7")}`} />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
};

export default DealBurgerPicker;
