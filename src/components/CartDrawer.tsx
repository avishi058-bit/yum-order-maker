import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, ShoppingBag, Pencil } from "lucide-react";
import { toppings, Topping, removals, smashModifications, menuItems, mealSideOptions, mealDrinkOptions } from "@/data/menu";

export interface DealBurgerConfig {
  removals: string[];
  name?: string;
}

export interface DealDrinkChoice {
  id: string;
  name: string;
  extraCost: number;
}

export interface CartItem {
  id: string;
  /**
   * The canonical menu item id used for server-side pricing.
   * Distinct from `id` which may include a unique suffix (e.g. `classic-1776430479457`)
   * to allow multiple customizations of the same menu item to coexist in the cart.
   */
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  toppings: string[];
  removals: string[];
  withMeal: boolean;
  mealSideId?: string;
  mealDrinkId?: string;
  dealBurgers?: DealBurgerConfig[];
  dealDrinks?: DealDrinkChoice[];
  /** Optional "owner name" — for orders with multiple items, lets the kitchen
   *  know which dish belongs to whom. Shown as a header line above the item
   *  on the printed receipt only (not stored in a separate DB column). */
  ownerName?: string;
}

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onCheckout: () => void;
  /** Reopens the customizer with this cart item's selections prefilled.
   *  Only relevant for items with customizable state (burger / meal). */
  onEditItem?: (id: string) => void;
  isKiosk?: boolean;
}

const CartDrawer = ({ open, onClose, items, onUpdateQuantity, onCheckout, onEditItem, isKiosk = false }: CartDrawerProps) => {
  useBodyScrollLock(open);
  const getItemTotal = (item: CartItem) => {
    const toppingsCost = item.toppings.reduce((sum, tId) => {
      const t = toppings.find((tp) => tp.id === tId);
      return sum + (t?.price || 0);
    }, 0);
    const mealCost = item.withMeal ? 23 : 0;
    const sideCost = item.mealSideId ? (mealSideOptions.find(s => s.id === item.mealSideId)?.price || 0) : 0;
    const drinkCost = item.mealDrinkId ? (mealDrinkOptions.find(d => d.id === item.mealDrinkId)?.price || 0) : 0;
    return (item.price + toppingsCost + mealCost + sideCost + drinkCost) * item.quantity;
  };

  const total = items.reduce((sum, item) => sum + getItemTotal(item), 0);

  const getToppingNames = (ids: string[]) => {
    const counts = new Map<string, number>();
    ids.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
    return Array.from(counts.entries())
      .map(([id, count]) => {
        const name = toppings.find((t) => t.id === id)?.name;
        if (!name) return null;
        return count > 1 ? `${name} × ${count}` : name;
      })
      .filter(Boolean) as string[];
  };

  const getRemovalNames = (ids: string[]) =>
    ids.map((id) => removals.find((r) => r.id === id)?.name || smashModifications.find((r) => r.id === id)?.name).filter(Boolean);

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
            className={`fixed top-0 right-0 h-full ${isKiosk ? 'w-full' : 'w-full max-w-md'} bg-card z-50 shadow-2xl flex flex-col`}
            dir="rtl"
          >
            <div className={`flex items-center justify-between ${isKiosk ? 'p-6' : 'p-5'} border-b border-border`}>
              <h2 className={`${isKiosk ? 'text-3xl' : 'text-xl'} font-black flex items-center gap-3`}>
                <ShoppingBag size={isKiosk ? 32 : 22} className="text-primary" />
                ההזמנה שלך
              </h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X size={isKiosk ? 32 : 24} />
              </button>
            </div>

            <div className={`flex-1 overflow-y-auto ${isKiosk ? 'p-6 space-y-5' : 'p-5 space-y-4'}`}>
              {items.length === 0 ? (
                <p className={`text-center text-muted-foreground mt-20 ${isKiosk ? 'text-2xl' : ''}`}>העגלה ריקה</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className={`bg-secondary/50 rounded-xl ${isKiosk ? 'p-5' : 'p-4'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`${isKiosk ? 'text-2xl' : 'text-base'} font-black`}>{item.name}</span>
                      <span className={`${isKiosk ? 'text-2xl' : 'text-base'} text-primary font-black`}>₪{getItemTotal(item)}</span>
                    </div>

                    {/* Show selected removals */}
                    {item.removals.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {getRemovalNames(item.removals).map((name) => (
                          <span key={name} className={`${isKiosk ? 'text-base px-3 py-1' : 'text-xs px-2 py-0.5'} rounded-full bg-destructive/10 text-destructive line-through`}>
                            {name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Show meal upgrade */}
                    {item.withMeal && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        <span className={`${isKiosk ? 'text-base px-3 py-1' : 'text-xs px-2 py-0.5'} rounded-full bg-accent/20 text-accent-foreground`}>
                          🍟🥤 ארוחה עסקית +₪23
                        </span>
                        {item.mealSideId && (
                          <span className={`${isKiosk ? 'text-base px-3 py-1' : 'text-xs px-2 py-0.5'} rounded-full bg-accent/20 text-accent-foreground`}>
                            {mealSideOptions.find(s => s.id === item.mealSideId)?.name}
                            {(mealSideOptions.find(s => s.id === item.mealSideId)?.price || 0) > 0 && ` +₪${mealSideOptions.find(s => s.id === item.mealSideId)?.price}`}
                          </span>
                        )}
                        {item.mealDrinkId && (
                          <span className={`${isKiosk ? 'text-base px-3 py-1' : 'text-xs px-2 py-0.5'} rounded-full bg-accent/20 text-accent-foreground`}>
                            {mealDrinkOptions.find(d => d.id === item.mealDrinkId)?.name}
                            {(mealDrinkOptions.find(d => d.id === item.mealDrinkId)?.price || 0) > 0 && ` +₪${mealDrinkOptions.find(d => d.id === item.mealDrinkId)?.price}`}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Show deal details */}
                    {item.dealBurgers && (
                      <div className="mb-2 space-y-1">
                        {item.dealBurgers.map((burger, i) => (
                          <div key={i} className={`${isKiosk ? 'text-lg' : 'text-xs'} text-muted-foreground`}>
                            🍔 המבורגר {i + 1}
                            {burger.name && <span className="font-bold text-foreground mr-1">({burger.name})</span>}
                            {burger.removals.length > 0 && (
                              <span className="mr-1">
                                — {getRemovalNames(burger.removals).join(", ")}
                              </span>
                            )}
                          </div>
                        ))}
                        <div className={`${isKiosk ? 'text-lg' : 'text-xs'} text-muted-foreground`}>🍟 צ׳יפס ענק</div>
                        {item.dealDrinks?.map((drink, i) => (
                          <div key={i} className={`${isKiosk ? 'text-lg' : 'text-xs'} text-muted-foreground`}>
                            🥤 {drink.name}
                            {drink.extraCost > 0 && ` (+₪${drink.extraCost})`}
                          </div>
                        ))}
                      </div>
                    )}

                    {item.toppings.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {getToppingNames(item.toppings).map((name) => (
                          <span key={name} className={`${isKiosk ? 'text-base px-3 py-1' : 'text-xs px-2 py-0.5'} rounded-full bg-primary/10 text-primary`}>
                            +{name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className={`flex items-center justify-between ${isKiosk ? 'mt-3' : ''}`}>
                      <div className={`flex items-center ${isKiosk ? 'gap-4' : 'gap-3'}`}>
                        <button
                          onClick={() => onUpdateQuantity(item.id, -1)}
                          className={`${isKiosk ? 'w-12 h-12' : 'w-8 h-8'} rounded-full bg-muted flex items-center justify-center hover:bg-border transition-colors`}
                        >
                          <Minus size={isKiosk ? 22 : 14} />
                        </button>
                        <span className={`font-black ${isKiosk ? 'text-2xl w-8' : 'text-lg w-6'} text-center`}>{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, 1)}
                          className={`${isKiosk ? 'w-12 h-12' : 'w-8 h-8'} rounded-full bg-muted flex items-center justify-center hover:bg-border transition-colors`}
                        >
                          <Plus size={isKiosk ? 22 : 14} />
                        </button>
                      </div>
                      {/* Edit button — only for items that go through ItemCustomizer
                          (not deals, which use their own customizers). */}
                      {onEditItem && !item.dealBurgers && (
                        <button
                          onClick={() => onEditItem(item.id)}
                          className={`flex items-center gap-1.5 rounded-full bg-background border border-border text-foreground hover:bg-secondary transition-colors ${isKiosk ? 'px-4 py-2 text-base' : 'px-3 py-1.5 text-xs'} font-bold`}
                          aria-label="ערוך מנה"
                        >
                          <Pencil size={isKiosk ? 16 : 12} />
                          ערוך
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className={`${isKiosk ? 'p-6' : 'p-5'} border-t border-border`}>
                <div className="flex justify-between items-center mb-4">
                  <span className={`${isKiosk ? 'text-2xl' : 'text-lg'} font-black`}>סה״כ</span>
                  <span className={`${isKiosk ? 'text-4xl' : 'text-2xl'} font-black text-primary`}>₪{total}</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onCheckout}
                  className={`w-full bg-primary text-primary-foreground font-black ${isKiosk ? 'py-5 rounded-2xl text-2xl' : 'py-4 rounded-full text-lg'} shadow-lg shadow-primary/30`}
                >
                  לסיום הזמנה
                </motion.button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
