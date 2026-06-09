import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus } from "lucide-react";
import { MenuItem } from "@/data/menu";
import { menuImages } from "@/data/menuImages";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

const EXTRA_QUARTER_PRICE = 15;
const EXTRA_QUARTER_TOPPING_ID = "arayes-extra-quarter";

interface Props {
  item: MenuItem | null;
  onClose: () => void;
  /** Called when user confirms. toppings already includes one entry per extra quarter. */
  onConfirm: (item: MenuItem, quantity: number, toppings: string[]) => void;
  isKiosk?: boolean;
}

const ArayesCustomizer = ({ item, onClose, onConfirm, isKiosk = false }: Props) => {
  const [extras, setExtras] = useState(0);
  const [qty, setQty] = useState(1);

  useBodyScrollLock(!!item);

  if (!item) return null;

  const unit = item.price + extras * EXTRA_QUARTER_PRICE;
  const total = unit * qty;
  const image = menuImages[item.id];

  const handleConfirm = () => {
    const toppings = Array(extras).fill(EXTRA_QUARTER_TOPPING_ID);
    onConfirm(item, qty, toppings);
    setExtras(0);
    setQty(1);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black z-40"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className={`fixed bottom-0 left-0 right-0 bg-card z-50 rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh] pwa-safe-screen`}
        dir="rtl"
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className={`${isKiosk ? "text-3xl" : "text-xl"} font-black`}>{item.name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={isKiosk ? 32 : 24} />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto ${isKiosk ? "p-6 space-y-6" : "p-5 space-y-5"}`}>
          {image && (
            <div className="w-full rounded-2xl overflow-hidden bg-muted">
              <img src={image} alt={item.name} className="w-full h-56 object-cover" />
            </div>
          )}
          <p className={`text-muted-foreground ${isKiosk ? "text-xl" : "text-base"} leading-relaxed`}>
            {item.description}
          </p>

          <div className="bg-secondary/50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`${isKiosk ? "text-2xl" : "text-lg"} font-black`}>רבע עראיס נוסף</span>
              <span className={`${isKiosk ? "text-xl" : "text-base"} text-primary font-bold`}>
                +₪{EXTRA_QUARTER_PRICE} ליחידה
              </span>
            </div>
            <p className={`text-muted-foreground ${isKiosk ? "text-base" : "text-sm"} mb-3`}>
              ניתן להוסיף כמה רבעים שתרצו
            </p>
            <div className="flex items-center justify-center gap-5">
              <button
                onClick={() => setExtras((v) => Math.max(0, v - 1))}
                disabled={extras === 0}
                className={`${isKiosk ? "w-14 h-14" : "w-10 h-10"} rounded-full bg-background border border-border flex items-center justify-center disabled:opacity-40`}
              >
                <Minus size={isKiosk ? 24 : 18} />
              </button>
              <span className={`font-black ${isKiosk ? "text-3xl w-12" : "text-2xl w-10"} text-center`}>
                {extras}
              </span>
              <button
                onClick={() => setExtras((v) => v + 1)}
                className={`${isKiosk ? "w-14 h-14" : "w-10 h-10"} rounded-full bg-primary text-primary-foreground flex items-center justify-center`}
              >
                <Plus size={isKiosk ? 24 : 18} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between bg-secondary/50 rounded-2xl p-4">
            <span className={`${isKiosk ? "text-2xl" : "text-lg"} font-black`}>כמות</span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQty((v) => Math.max(1, v - 1))}
                className={`${isKiosk ? "w-12 h-12" : "w-9 h-9"} rounded-full bg-background border border-border flex items-center justify-center`}
              >
                <Minus size={isKiosk ? 20 : 16} />
              </button>
              <span className={`font-black ${isKiosk ? "text-2xl w-10" : "text-xl w-8"} text-center`}>
                {qty}
              </span>
              <button
                onClick={() => setQty((v) => v + 1)}
                className={`${isKiosk ? "w-12 h-12" : "w-9 h-9"} rounded-full bg-primary text-primary-foreground flex items-center justify-center`}
              >
                <Plus size={isKiosk ? 20 : 16} />
              </button>
            </div>
          </div>
        </div>

        <div className={`${isKiosk ? "p-6" : "p-5"} border-t border-border pwa-checkout-bar`}>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleConfirm}
            className={`w-full bg-primary text-primary-foreground font-black ${isKiosk ? "py-5 rounded-2xl text-2xl" : "py-4 rounded-full text-lg"} shadow-lg shadow-primary/30 flex items-center justify-center gap-3`}
          >
            <span>הוסף להזמנה</span>
            <span>₪{total}</span>
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ArayesCustomizer;
