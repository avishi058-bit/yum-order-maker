import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, ShoppingBag, ArrowRight, Sparkles, Pencil } from "lucide-react";
import { useMemo } from "react";
import {
  toppings,
  removals,
  smashModifications,
  menuItems,
  mealSideOptions,
  mealDrinkOptions,
  drinkSubOptions,
  type MenuItem,
} from "@/data/menu";
import { menuImages } from "@/data/menuImages";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { CartItem } from "@/components/CartDrawer";
import { computeCartItemTotal } from "@/lib/cartPricing";

interface KioskCartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onCheckout: () => void;
  /** Quick-add for simple items (sides + simple drinks without sub-options). */
  onQuickAdd: (item: MenuItem) => void;
  /** Open the drink-variant selector (for cans / beers with sub-options). */
  onSelectDrink?: (item: MenuItem) => void;
  /** "Add another item" — return to menu */
  onBackToMenu: () => void;
  isAvailable: (id: string) => boolean;
  /** Reopens the customizer with this cart item's selections prefilled. */
  onEditItem?: (id: string) => void;
  /** Kiosk uses larger sizes; website uses compact sizes. */
  isKiosk?: boolean;
}

/**
 * Wolt-inspired cart screen used on BOTH kiosk and website.
 * - Large item cards with +/- controls
 * - "Recommended for you" rail of simple add-ons (one-tap +)
 * - Sticky bottom bar with totals + checkout CTA
 * - Drinks with variants (can / beer) open the drink selector instead of quick-add.
 */
const KioskCartDrawer = ({
  open,
  onClose,
  items,
  onUpdateQuantity,
  onCheckout,
  onQuickAdd,
  onSelectDrink,
  onBackToMenu,
  isAvailable,
  onEditItem,
  isKiosk = false,
}: KioskCartDrawerProps) => {
  useBodyScrollLock(open);
  const getItemTotal = (item: CartItem) => computeCartItemTotal(item);

  const total = items.reduce((sum, item) => sum + getItemTotal(item), 0);
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const getToppingNames = (ids: string[]) => {
    // Group duplicates so e.g. 3x "פרוסת צ׳דר טבעוני" shows as "פרוסת צ׳דר טבעוני × 3"
    const counts = new Map<string, number>();
    ids.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
    return Array.from(counts.entries())
      .map(([id, count]) => {
        const name = toppings.find((t) => t.id === id)?.name;
        if (!name) return null;
        return count > 1 ? `${name} × ${count}` : name;
      })
      .filter(Boolean);
  };

  const getRemovalNames = (ids: string[]) =>
    ids
      .map(
        (id) =>
          removals.find((r) => r.id === id)?.name ||
          smashModifications.find((r) => r.id === id)?.name,
      )
      .filter(Boolean);

  // Recommendations: sides + drinks. Exclude items already in cart.
  // Burgers/meals/deals are excluded (they require complex customization flows).
  // "מיקס חברים" (friends-mix) is pinned first as the priority recommendation.
  const recommendations = useMemo(() => {
    const inCartMenuIds = new Set(items.map((i) => i.menuItemId));
    const list = menuItems.filter((m) => {
      if (!isAvailable(m.id)) return false;
      if (inCartMenuIds.has(m.id)) return false;
      if (m.category === "side") return true;
      if (m.category === "drink") return true;
      return false;
    });
    // Pin friends-mix first
    return list.sort((a, b) => {
      if (a.id === "friends-mix") return -1;
      if (b.id === "friends-mix") return 1;
      return 0;
    });
  }, [items, isAvailable]);

  const handleRecommendationAdd = (item: MenuItem) => {
    // If the drink has variants (cans, bottles, beers), open the selector
    if (item.category === "drink" && drinkSubOptions[item.id] && onSelectDrink) {
      onSelectDrink(item);
      return;
    }
    onQuickAdd(item);
  };

  // Size tokens — kiosk uses larger touch targets, website uses compact sizes
  const sz = isKiosk
    ? {
        headerPad: "p-6",
        backIcon: 28,
        backText: "text-lg",
        title: "text-3xl",
        titleIcon: 32,
        closeIcon: 32,
        contentPad: "p-6 space-y-4",
        emptyText: "text-2xl mt-20",
        cardPad: "p-5",
        cardGap: "gap-4",
        img: "w-24 h-24 rounded-xl",
        imgFallbackText: "text-4xl",
        itemName: "text-xl",
        itemPrice: "text-xl",
        modText: "text-sm",
        qtyBtn: "w-12 h-12",
        qtyIcon: 22,
        qtyNum: "text-2xl w-10",
        addMoreBtn: "py-5 text-xl",
        addMoreIcon: 26,
        recHeaderPad: "px-6 mb-4",
        recIcon: 26,
        recTitle: "text-2xl",
        recCardWidth: "w-44",
        recName: "text-base",
        recPrice: "text-lg",
        recBtn: "py-3 text-lg",
        recBtnIcon: 22,
        bottomPad: "p-5",
        bottomCount: "text-sm",
        bottomTotal: "text-3xl",
        ckBtn: "py-5 px-10 text-2xl",
      }
    : {
        headerPad: "p-4",
        backIcon: 22,
        backText: "text-sm",
        title: "text-xl",
        titleIcon: 24,
        closeIcon: 26,
        contentPad: "p-4 space-y-3",
        emptyText: "text-base mt-16",
        cardPad: "p-3",
        cardGap: "gap-3",
        img: "w-20 h-20 rounded-lg",
        imgFallbackText: "text-3xl",
        itemName: "text-base",
        itemPrice: "text-base",
        modText: "text-xs",
        qtyBtn: "w-10 h-10",
        qtyIcon: 18,
        qtyNum: "text-lg w-8",
        addMoreBtn: "py-3 text-base",
        addMoreIcon: 20,
        recHeaderPad: "px-4 mb-3",
        recIcon: 20,
        recTitle: "text-lg",
        recCardWidth: "w-36",
        recName: "text-sm",
        recPrice: "text-base",
        recBtn: "py-2.5 text-base",
        recBtnIcon: 18,
        bottomPad: "p-4",
        bottomCount: "text-xs",
        bottomTotal: "text-2xl",
        ckBtn: "py-3 px-6 text-lg",
      };

  // On website, drawer slides from the right but capped to a sensible width
  const drawerWidth = isKiosk ? "w-full" : "w-full sm:max-w-md";

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
            className={`fixed top-0 right-0 h-full ${drawerWidth} bg-background z-50 shadow-2xl flex flex-col`}
            dir="rtl"
          >
            {/* Header */}
            <div className={`flex-none flex items-center justify-between ${sz.headerPad} bg-card border-b border-border`}>
              <button
                onClick={onClose}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowRight size={sz.backIcon} />
                <span className={`${sz.backText} font-bold`}>לתפריט</span>
              </button>
              <h2 className={`${sz.title} font-black flex items-center gap-2`}>
                <ShoppingBag size={sz.titleIcon} className="text-primary" />
                ההזמנה שלך
              </h2>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
                aria-label="סגור"
              >
                <X size={sz.closeIcon} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto pb-40">
              {/* Cart items */}
              <div className={sz.contentPad}>
                {items.length === 0 ? (
                  <p className={`text-center text-muted-foreground ${sz.emptyText}`}>העגלה ריקה</p>
                ) : (
                  items.map((item) => {
                    const img = menuImages[item.menuItemId];
                    return (
                      <div
                        key={item.id}
                        className={`bg-card rounded-2xl ${sz.cardPad} shadow-sm border border-border flex ${sz.cardGap}`}
                      >
                        {/* Image */}
                        {img ? (
                          <img
                            src={img}
                            alt={item.name}
                            className={`${sz.img} object-cover flex-none`}
                            loading="lazy"
                          />
                        ) : (
                          <div className={`${sz.img} bg-secondary flex items-center justify-center ${sz.imgFallbackText} flex-none`}>
                            🍔
                          </div>
                        )}

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className={`${sz.itemName} font-black leading-tight`}>{item.name}</h3>
                            <span className={`${sz.itemPrice} font-black text-primary whitespace-nowrap`}>
                              ₪{getItemTotal(item)}
                            </span>
                          </div>

                          {/* Modifiers — compact list */}
                          <div className="space-y-1 mb-3">
                            {item.removals.length > 0 && (
                              <p className={`${sz.modText} text-destructive`}>
                                ללא: {getRemovalNames(item.removals).join(", ")}
                              </p>
                            )}
                            {item.toppings.length > 0 && (
                              <p className={`${sz.modText} text-primary`}>
                                + {getToppingNames(item.toppings).join(", ")}
                              </p>
                            )}
                            {item.withMeal && (
                              <p className={`${sz.modText} text-accent-foreground`}>
                                🍟🥤 ארוחה עסקית
                                {item.mealSideId &&
                                  ` · ${mealSideOptions.find((s) => s.id === item.mealSideId)?.name}`}
                                {item.mealDrinkId &&
                                  ` · ${mealDrinkOptions.find((d) => d.id === item.mealDrinkId)?.name}`}
                              </p>
                            )}
                            {item.dealBurgers && (
                              <p className={`${sz.modText} text-muted-foreground`}>
                                {item.dealBurgers.length} המבורגרים
                                {item.dealDrinks && ` · ${item.dealDrinks.length} משקאות`}
                              </p>
                            )}
                          </div>

                          {/* Quantity controls + edit */}
                          <div className="flex items-center gap-3">
                            {onEditItem && !item.dealBurgers && (
                              <button
                                onClick={() => onEditItem(item.id)}
                                className={`flex items-center gap-1.5 rounded-full bg-background border-2 border-border text-foreground hover:bg-secondary transition-colors font-bold ${isKiosk ? 'px-4 py-2.5 text-base' : 'px-3 py-1.5 text-xs'}`}
                                aria-label="ערוך מנה"
                              >
                                <Pencil size={isKiosk ? 18 : 12} />
                                ערוך
                              </button>
                            )}
                            <button
                              onClick={() => onUpdateQuantity(item.id, -1)}
                              className={`${sz.qtyBtn} rounded-full bg-secondary hover:bg-border transition-colors flex items-center justify-center active:scale-95`}
                              aria-label="הפחת"
                            >
                              <Minus size={sz.qtyIcon} />
                            </button>
                            <span className={`font-black ${sz.qtyNum} text-center`}>
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => onUpdateQuantity(item.id, 1)}
                              className={`${sz.qtyBtn} rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center active:scale-95`}
                              aria-label="הוסף"
                            >
                              <Plus size={sz.qtyIcon} />
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
                <div className={isKiosk ? "px-6" : "px-4"}>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={onBackToMenu}
                    className={`w-full bg-secondary hover:bg-border text-foreground font-black ${sz.addMoreBtn} rounded-2xl border-2 border-dashed border-border flex items-center justify-center gap-3 transition-colors`}
                  >
                    <Plus size={sz.addMoreIcon} />
                    הוסף עוד מנה
                  </motion.button>
                </div>
              )}

              {/* Recommendations rail */}
              {recommendations.length > 0 && items.length > 0 && (
                <div className={isKiosk ? "mt-8" : "mt-6"}>
                  <div className={`${sz.recHeaderPad} flex items-center gap-2`}>
                    <Sparkles size={sz.recIcon} className="text-primary" />
                    <h3 className={`${sz.recTitle} font-black`}>ממליצים לך להוסיף</h3>
                  </div>

                  {/* Horizontal scroll for quick browsing */}
                  <div className={`overflow-x-auto pb-4 ${isKiosk ? "px-6" : "px-4"}`}>
                    <div className={`flex ${isKiosk ? "gap-4" : "gap-3"} min-w-min`}>
                      {recommendations.map((rec) => {
                        const img = menuImages[rec.id];
                        const hasVariants = rec.category === "drink" && !!drinkSubOptions[rec.id];
                        return (
                          <div
                            key={rec.id}
                            className={`flex-none ${sz.recCardWidth} bg-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col`}
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
                            <div className={`${isKiosk ? "p-3" : "p-2.5"} flex-1 flex flex-col`}>
                              <p className={`font-black ${sz.recName} leading-tight mb-1 line-clamp-2`}>
                                {rec.name}
                              </p>
                              <p className={`text-primary font-black ${sz.recPrice} mt-auto`}>
                                ₪{rec.price}
                              </p>
                            </div>

                            {/* Quick-add button */}
                            <button
                              onClick={() => handleRecommendationAdd(rec)}
                              className={`w-full bg-primary text-primary-foreground ${sz.recBtn} font-black flex items-center justify-center gap-2 hover:opacity-90 transition-opacity active:scale-[0.98]`}
                              aria-label={`הוסף ${rec.name}`}
                            >
                              <Plus size={sz.recBtnIcon} />
                              {hasVariants ? "בחר" : "הוסף"}
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
              <div className={`flex-none ${sz.bottomPad} bg-card border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.08)]`}>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className={`${sz.bottomCount} text-muted-foreground`}>{totalCount} פריטים</p>
                    <p className={`${sz.bottomTotal} font-black`}>₪{total}</p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={onCheckout}
                    className={`bg-primary text-primary-foreground font-black ${sz.ckBtn} rounded-2xl shadow-lg shadow-primary/30 active:opacity-90`}
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
