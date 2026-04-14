import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import { toppings, Topping, removals, menuItems } from "@/data/menu";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  toppings: string[];
  removals: string[];
}

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onToggleTopping: (itemId: string, toppingId: string) => void;
  onToggleRemoval: (itemId: string, removalId: string) => void;
  onCheckout: () => void;
}

const CartDrawer = ({ open, onClose, items, onUpdateQuantity, onToggleTopping, onToggleRemoval, onCheckout }: CartDrawerProps) => {
  const isBurger = (itemId: string) => {
    const item = menuItems.find((m) => m.id === itemId);
    return item?.category === "burger";
  };

  const getItemTotal = (item: CartItem) => {
    const toppingsCost = item.toppings.reduce((sum, tId) => {
      const t = toppings.find((tp) => tp.id === tId);
      return sum + (t?.price || 0);
    }, 0);
    return (item.price + toppingsCost) * item.quantity;
  };

  const total = items.reduce((sum, item) => sum + getItemTotal(item), 0);

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
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-card z-50 shadow-2xl flex flex-col"
            dir="rtl"
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShoppingBag size={22} className="text-primary" />
                ההזמנה שלך
              </h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {items.length === 0 ? (
                <p className="text-center text-muted-foreground mt-20">העגלה ריקה</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="bg-secondary/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold">{item.name}</span>
                      <span className="text-primary font-bold">₪{getItemTotal(item)}</span>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <button
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-border transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-bold text-lg w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-border transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    {isBurger(item.id) && (
                      <>
                        <div className="mb-2">
                          <span className="text-xs text-muted-foreground font-medium mb-1 block">הסרות:</span>
                          <div className="flex flex-wrap gap-2">
                            {removals.map((r) => {
                              const active = item.removals.includes(r.id);
                              return (
                                <button
                                  key={r.id}
                                  onClick={() => onToggleRemoval(item.id, r.id)}
                                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                    active
                                      ? "bg-destructive/20 text-destructive border-destructive/50 line-through"
                                      : "border-border text-muted-foreground hover:border-destructive/50"
                                  }`}
                                >
                                  {r.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground font-medium mb-1 block">תוספות:</span>
                          <div className="flex flex-wrap gap-2">
                            {toppings.map((t: Topping) => {
                              const active = item.toppings.includes(t.id);
                              return (
                                <button
                                  key={t.id}
                                  onClick={() => onToggleTopping(item.id, t.id)}
                                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                    active
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "border-border text-muted-foreground hover:border-primary/50"
                                  }`}
                                >
                                  {t.name} +₪{t.price}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="p-5 border-t border-border">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-bold">סה״כ</span>
                  <span className="text-2xl font-black text-primary">₪{total}</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onCheckout}
                  className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-full text-lg shadow-lg shadow-primary/30"
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
