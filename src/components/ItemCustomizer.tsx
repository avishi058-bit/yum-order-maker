import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus } from "lucide-react";
import { MenuItem, toppings, Topping, removals, mealUpgrade, sideUpgrades } from "@/data/menu";

interface ItemCustomizerProps {
  item: MenuItem | null;
  onClose: () => void;
  onConfirm: (item: MenuItem, quantity: number, selectedToppings: string[], selectedRemovals: string[]) => void;
}

const ItemCustomizer = ({ item, onClose, onConfirm }: ItemCustomizerProps) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [selectedRemovals, setSelectedRemovals] = useState<string[]>([]);

  if (!item) return null;

  const isBurger = item.category === "burger";

  const toggleTopping = (id: string) => {
    setSelectedToppings((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const toggleRemoval = (id: string) => {
    setSelectedRemovals((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const toppingsCost = selectedToppings.reduce((sum, tId) => {
    const t = toppings.find((tp) => tp.id === tId);
    return sum + (t?.price || 0);
  }, 0);

  const unitPrice = item.price + toppingsCost;
  const totalPrice = unitPrice * quantity;

  const handleConfirm = () => {
    onConfirm(item, quantity, selectedToppings, selectedRemovals);
    setQuantity(1);
    setSelectedToppings([]);
    setSelectedRemovals([]);
  };

  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-50"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl max-h-[85vh] flex flex-col"
            dir="rtl"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1.5 rounded-full bg-muted" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-4 border-b border-border">
              <button onClick={onClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <X size={18} />
              </button>
              <h2 className="text-lg font-bold flex-1 text-center">{item.name}</h2>
              <div className="w-9" />
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {isBurger && (
                <>
                  {/* Removals section */}
                  <div className="px-5 py-4 border-b border-border">
                    <h3 className="text-lg font-bold text-right mb-1">שינויים אפשריים</h3>
                    <p className="text-sm text-muted-foreground text-right mb-4">אפשר לבחור עד ל-5 פריטים</p>
                    <div className="space-y-0">
                      {removals.map((r) => {
                        const active = selectedRemovals.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            onClick={() => toggleRemoval(r.id)}
                            className="w-full flex items-center justify-between py-3.5 border-b border-border/50 last:border-b-0"
                          >
                            <div
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                active
                                  ? "border-primary bg-primary"
                                  : "border-muted-foreground/40"
                              }`}
                            >
                              {active && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="w-2.5 h-2.5 rounded-full bg-primary-foreground"
                                />
                              )}
                            </div>
                            <span className="font-medium text-base">{r.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Toppings section */}
                  <div className="px-5 py-4">
                    <h3 className="text-lg font-bold text-right mb-1">תוספות בתשלום</h3>
                    <p className="text-sm text-muted-foreground text-right mb-4">אפשר לבחור עד ל-9 פריטים</p>
                    <div className="space-y-0">
                      {toppings.map((t: Topping) => {
                        const active = selectedToppings.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            onClick={() => toggleTopping(t.id)}
                            className="w-full flex items-center justify-between py-3.5 border-b border-border/50 last:border-b-0"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                  active
                                    ? "border-primary bg-primary"
                                    : "border-muted-foreground/40"
                                }`}
                              >
                                {active && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-2.5 h-2.5 rounded-full bg-primary-foreground"
                                  />
                                )}
                              </div>
                              <span className="text-sm text-muted-foreground">+ ₪{t.price}</span>
                            </div>
                            <span className="font-medium text-base">{t.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {!isBurger && (
                <div className="px-5 py-8 text-center text-muted-foreground">
                  <p className="text-base">{item.description}</p>
                  <p className="text-2xl font-bold text-primary mt-3">₪{item.price}</p>
                </div>
              )}
            </div>

            {/* Bottom bar */}
            <div className="px-5 py-4 border-t border-border flex items-center gap-3 bg-card safe-bottom">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleConfirm}
                className="flex-1 bg-primary text-primary-foreground font-bold py-3.5 rounded-xl text-base shadow-lg shadow-primary/20"
              >
                הוספה להזמנה · ₪{totalPrice}
              </motion.button>
              <div className="flex items-center gap-2 bg-muted rounded-xl px-2 py-1.5">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-border transition-colors"
                >
                  <Minus size={16} />
                </button>
                <span className="font-bold text-lg w-6 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-border transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ItemCustomizer;
