// A deal's drink choice - the same list as choosing a drink for a meal
// (ItemCustomizer "drink-select"): round radio, price badge, big picture.
import { drinkToAvailabilityId } from "@/data/menu";
import { mealDrinkImages } from "@/lib/customizerImages";
import type { TapGuard } from "@/hooks/useTapGuard";

export type DealDrinkOption = { id: string; name: string; price: number; category: "soft" | "beer" };

const imageOf = (id: string): string | undefined => {
  const avail = drinkToAvailabilityId[id] || id;
  return mealDrinkImages[avail]
    || mealDrinkImages[avail.replace(/^drink-(watermelon|mojito)$/, "drink-blu-$1")];
};

type Props = {
  isKiosk: boolean;
  guard: TapGuard;
  title: string;
  options: DealDrinkOption[];
  selected: string;
  onSelect: (id: string) => void;
  isUnavailable: (id: string) => boolean;
  /** "extra": price shown as "+₪x" and hidden when 0 (included). "full": price as "₪x". */
  priceMode: "extra" | "full";
};

const DealDrinkPicker = ({ isKiosk, guard, title, options, selected, onSelect, isUnavailable, priceMode }: Props) => {
  const soft = options.filter((d) => d.category === "soft");
  const beer = options.filter((d) => d.category === "beer" && !isUnavailable(d.id));

  const Row = ({ drink }: { drink: DealDrinkOption }) => {
    const active = selected === drink.id;
    const out = isUnavailable(drink.id);
    const img = imageOf(drink.id);
    const showPrice = !out && (priceMode === "full" || drink.price > 0);
    return (
      <button
        disabled={out}
        aria-pressed={active}
        onClick={guard(() => { if (!out) onSelect(drink.id); })}
        className={`w-full flex items-center justify-between border-b border-gray-100 last:border-b-0 ${isKiosk ? "py-5" : "py-4"} ${out ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div className="flex items-center gap-3">
          <div className={`rounded-full border-2 flex items-center justify-center transition-colors ${isKiosk ? "w-9 h-9" : "w-7 h-7"} ${
            out ? "border-gray-200" : active ? "border-primary bg-primary" : "border-gray-300"
          }`}>
            {active && !out && <div className="w-3 h-3 rounded-full bg-white" />}
          </div>
          {showPrice && (
            <span className={`inline-flex items-center justify-center rounded-full bg-primary px-2 py-0.5 font-black text-primary-foreground shadow-sm ${isKiosk ? "text-[22px] min-w-[52px]" : "text-base min-w-[40px]"}`}>
              {priceMode === "extra" ? `+₪${drink.price}` : `₪${drink.price}`}
            </span>
          )}
          {out && <span className={`text-destructive ${isKiosk ? "text-[18px]" : "text-sm"}`}>(אזל מהמלאי)</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-bold ${isKiosk ? "text-[26px]" : "text-lg"} ${out ? "line-through text-gray-400" : ""}`}>{drink.name}</span>
          {img && (
            <img src={img} alt={drink.name} width={80} height={80} loading="lazy"
              className={`${isKiosk ? "w-20 h-20" : "w-16 h-16"} object-contain flex-shrink-0 ${out ? "opacity-40 grayscale" : ""}`} />
          )}
        </div>
      </button>
    );
  };

  return (
    <div className={isKiosk ? "px-8 py-8" : "px-5 py-6"}>
      <h3 className={`font-black text-center ${isKiosk ? "text-[30px] mb-8" : "text-lg mb-4"}`}>{title}</h3>
      {soft.map((d) => <Row key={d.id} drink={d} />)}
      {beer.length > 0 && (
        <>
          <h4 className={`font-black text-right mt-6 mb-3 ${isKiosk ? "text-[26px]" : "text-base"}`}>בירות:</h4>
          {beer.map((d) => <Row key={d.id} drink={d} />)}
        </>
      )}
    </div>
  );
};

export default DealDrinkPicker;
