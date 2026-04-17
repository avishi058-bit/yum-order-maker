import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, ShoppingBag, ArrowRight, Sparkles } from "lucide-react";
import { useMemo } from "react";
import {
  toppings,
  removals,
  smashModifications,
  menuItems,
  mealSideOptions,
  mealDrinkOptions,
  type MenuItem,
} from "@/data/menu";
import { menuImages } from "@/data/menuImages";
import type { CartItem } from "@/components/CartDrawer";

interface KioskCartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onCheckout: () => void;
  /** Quick-add for simple items (sides + simple drinks). Burgers/meals/deals NOT included. */
  onQuickAdd: (item: MenuItem) => void;
  /** "Add another item" — return to menu */
  onBackToMenu: () => void;
  isAvailable: (id: string) => boolean;
}

/**
 * Wolt-inspired kiosk cart screen:
 * - Large item cards with +/- controls
 * - "Recommended for you" rail of simple add-ons (one-tap +)
 * - Sticky bottom bar with totals + checkout CTA
 *
 * Used ONLY in kiosk mode. Website/mobile keeps the original CartDrawer.
 */
const KioskCartDrawer = ({
  open,
  onClose,
  items,
  onUpdateQuantity,
  onCheckout,
  onQuickAdd,
  onBackToMenu,
  isAvailable,
}: KioskCartDrawerProps) => {
  const getItemTotal = (item: CartItem) => {
    const toppingsCost = item.toppings.reduce((sum, tId) => {
      const t = toppings.find((tp) => tp.id === tId);
      return sum + (t?.price || 0);
    }, 0);
    const mealCost = item.withMeal ? 23 : 0;
    const sideCost = item.mealSideId
      ? mealSideOptions.find((s) => s.id === item.mealSideId)?.price || 0
      : 0;
    const drinkCost = item.mealDrinkId
      ? mealDrinkOptions.find((d) => d.id === item.mealDrinkId)?.price || 0
      : 0;
    return (item.price + toppingsCost + mealCost + sideCost + drinkCost) * item.quantity;
  };

  const total = items.reduce((sum, item) => sum + getItemTotal(item), 0);
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const getToppingNames = (ids: string[]) =>
    ids.map((id) => toppings.find((t) => t.id === id)?.name).filter(Boolean);

  const getRemovalNames = (ids: string[]) =>
    ids
      .map(
        (id) =>
          removals.find((r) => r.id === id)?.name ||
          smashModifications.find((r) => r.id === id)?.name,
      )
      .filter(Boolean);

  // Recommendations: simple add-ons (sides + simple drinks). Exclude items already in cart.
  // Burgers/meals/deals are excluded because they require customization flows.
  const recommendations = useMemo(() => {
    const inCartMenuIds = new Set(items.map((i) => i.menuItemId));
    return menuItems.filter((m) => {
      if (!isAvailable(m.id)) return false;
      if (inCartMenuIds.has(m.id)) return false;
      // Simple categories only
      if (m.category === "side") return true;
      // Simple drinks: cans, bottles, beers — these go through DrinkSelector normally,
      // but per request, expose them as quick-add too
      if (m.category === "drink") return true;
      return false;
    });
  }, [items, isAvailable]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full bg-background z-50 shadow-2xl flex flex-col"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex-none flex items-center justify-between p-6 bg-card border-b border-border">
              <button
                onClick={onClose}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowRight size={28} />
                <span className="text-lg font-bold">לתפריט</span>
              </button>
              <h2 className="text-3xl font-black flex items-center gap-3">
                <ShoppingBag size={32} className="text-primary" />
                ההזמנה שלך
              </h2>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
                aria-label="סגור"
              >
                <X size={32} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto pb-40">
              {/* Cart items */}
              <div className="p-6 space-y-4">
                {items.length === 0 ? (
                  <p className="text-center text-muted-foreground mt-20 text-2xl">העגלה ריקה</p>
                ) : (
                  items.map((item) => {
                    const img = menuImages[item.menuItemId];
                    return (
                      <div
                        key={item.id}
                        className="bg-card rounded-2xl p-5 shadow-sm border border-border flex gap-4"
                      >
                        {/* Image */}
                        {img ? (
                          <img
                            src={img}
                            alt={item.name}
                            className="w-24 h-24 rounded-xl object-cover flex-none"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-24 h-24 rounded-xl bg-secondary flex items-center justify-center text-4xl flex-none">
                            🍔
                          </div>
                        )}

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="text-xl font-black leading-tight">{item.name}</h3>
                            <span className="text-xl font-black text-primary whitespace-nowrap">
                              ₪{getItemTotal(item)}
                            </span>
                          </div>

                          {/* Modifiers — compact list */}
                          <div className="space-y-1 mb-3">
                            {item.removals.length > 0 && (
                              <p className="text-sm text-destructive">
                                ללא: {getRemovalNames(item.removals).join(", ")}
                              </p>
                            )}
                            {item.toppings.length > 0 && (
                              <p className="text-sm text-primary">
                                + {getToppingNames(item.toppings).join(", ")}
                              </p>
                            )}
                            {item.withMeal && (
                              <p className="text-sm text-accent-foreground">
                                🍟🥤 ארוחה עסקית
                                {item.mealSideId &&
                                  ` · ${mealSideOptions.find((s) => s.id === item.mealSideId)?.name}`}
                                {item.mealDrinkId &&
                                  ` · ${mealDrinkOptions.find((d) => d.id === item.mealDrinkId)?.name}`}
                              </p>
                            )}
                            {item.dealBurgers && (
                              <p className="text-sm text-muted-foreground">
                                {item.dealBurgers.length} המבורגרים
                                {item.dealDrinks && ` · ${item.dealDrinks.length} משקאות`}
                              </p>
                            )}
                          </div>

                          {/* Quantity controls */}
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => onUpdateQuantity(item.id, -1)}
                              className="w-12 h-12 rounded-full bg-secondary hover:bg-border transition-colors flex items-center justify-center active:scale-95"
                              aria-label="הפחת"
                            >
                              <Minus size={22} />
                            </button>
                            <span className="font-black text-2xl w-10 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => onUpdateQuantity(item.id, 1)}
                              className="w-12 h-12 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center active:scale-95"
                              aria-label="הוסף"
                            >
                              <Plus size={22} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add another item CTA */}
              {items.length > 0 && (
                <div className="px-6">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={onBackToMenu}
                    className="w-full bg-secondary hover:bg-border text-foreground font-black py-5 rounded-2xl text-xl border-2 border-dashed border-border flex items-center justify-center gap-3 transition-colors"
                  >
                    <Plus size={26} />
                    הוסף עוד מנה
                  </motion.button>
                </div>
              )}

              {/* Recommendations rail */}
              {recommendations.length > 0 && items.length > 0 && (
                <div className="mt-8">
                  <div className="px-6 mb-4 flex items-center gap-3">
                    <Sparkles size={26} className="text-primary" />
                    <h3 className="text-2xl font-black">ממליצים לך להוסיף</h3>
                  </div>

                  {/* Horizontal scroll for quick browsing */}
                  <div className="overflow-x-auto pb-4 px-6">
                    <div className="flex gap-4 min-w-min">
                      {recommendations.map((rec) => {
                        const img = menuImages[rec.id];
                        return (
                          <div
                            key={rec.id}
                            className="flex-none w-44 bg-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col"
                          >
                            {/* Image */}
                            <div className="aspect-square bg-secondary flex items-center justify-center overflow-hidden">
                              {img ? (
                                <img
                                  src={img}
                                  alt={rec.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <span className="text-5xl">
                                  {rec.category === "drink" ? "🥤" : "🍟"}
                                </span>
                              )}
                            </div>

                            {/* Info */}
                            <div className="p-3 flex-1 flex flex-col">
                              <p className="font-black text-base leading-tight mb-1 line-clamp-2">
                                {rec.name}
                              </p>
                              <p className="text-primary font-black text-lg mt-auto">
                                ₪{rec.price}
                              </p>
                            </div>

                            {/* Quick-add button */}
                            <button
                              onClick={() => onQuickAdd(rec)}
                              className="w-full bg-primary text-primary-foreground py-3 font-black text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity active:scale-[0.98]"
                              aria-label={`הוסף ${rec.name}`}
                            >
                              <Plus size={22} />
                              הוסף
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky bottom bar */}
            {items.length > 0 && (
              <div className="flex-none p-5 bg-card border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{totalCount} פריטים</p>
                    <p className="text-3xl font-black">₪{total}</p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={onCheckout}
                    className="bg-primary text-primary-foreground font-black py-5 px-10 rounded-2xl text-2xl shadow-lg shadow-primary/30 active:opacity-90"
                  >
                    מעבר לתשלום ←
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default KioskCartDrawer;
