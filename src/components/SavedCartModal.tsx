import { motion, AnimatePresence } from "framer-motion";
import { X, RotateCcw } from "lucide-react";
import type { SavedCart } from "@/hooks/useSavedCart";
import cartBurgerIcon from "@/assets/cart-burger-icon.png";

interface SavedCartModalProps {
  open: boolean;
  savedCart: SavedCart | null;
  customerName?: string | null;
  onResume: () => void;
  onStartOver: () => void;
  onDismiss: () => void;
}

const SavedCartModal = ({
  open,
  savedCart,
  customerName,
  onResume,
  onStartOver,
  onDismiss,
}: SavedCartModalProps) => {
  if (!savedCart) return null;

  const displayName = customerName || savedCart.customerName || "";
  const itemCount = savedCart.items.reduce((sum, i) => sum + i.quantity, 0);
  // Show up to 3 item names as a small preview
  const previewItems = savedCart.items.slice(0, 3);
  const more = savedCart.items.length - previewItems.length;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onDismiss}
            className="fixed inset-0 bg-black z-[80]"
            style={{ willChange: "opacity" }}
          />

          {/* Centered card — fade + scale only (no slide-up) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[81] flex items-center justify-center p-4 pointer-events-none"
            style={{ willChange: "transform, opacity" }}
          >
            <div
              className="bg-card text-card-foreground rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden pointer-events-auto"
              dir="rtl"
            >
              {/* Close X */}
              <div className="flex justify-start p-3">
                <button
                  onClick={onDismiss}
                  className="w-9 h-9 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                  aria-label="סגור"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 pb-6 text-center">
                {/* Icon */}
                <div className="mx-auto w-20 h-20 rounded-full overflow-hidden mb-4 flex items-center justify-center">
                  <img src={cartBurgerIcon} alt="עגלה" className="w-full h-full object-cover" />
                </div>

                {/* Personal greeting — glowing green */}
                <h2
                  className="text-2xl font-black mb-2"
                  style={{
                    color: "hsl(142 76% 55%)",
                    textShadow:
                      "0 0 12px hsl(142 76% 55% / 0.65), 0 0 24px hsl(142 76% 45% / 0.45)",
                  }}
                >
                  {displayName ? `${displayName.split(" ")[0]} רוצה להמשיך מאיפה שהפסקת?` : "רוצה להמשיך מאיפה שהפסקת?"}
                </h2>
                <p className="text-muted-foreground mb-5">
                  שמנו לב שיש לך פריטים שכבר הוספת לעגלה
                </p>

                {/* Cart preview */}
                <div className="bg-muted/40 rounded-2xl p-4 mb-5 text-right">
                  <p className="text-xs text-muted-foreground mb-2 font-semibold">
                    בעגלה שלך ({itemCount} פריטים)
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {previewItems.map((item, idx) => (
                      <li key={idx} className="flex items-center justify-between gap-2">
                        <span className="font-bold text-primary whitespace-nowrap">
                          ₪{item.price * item.quantity}
                        </span>
                        <span className="truncate font-medium text-foreground">
                          {item.quantity > 1 ? `${item.quantity}× ` : ""}{item.name}
                        </span>
                      </li>
                    ))}
                    {more > 0 && (
                      <li className="text-xs text-muted-foreground text-center pt-1">
                        ועוד {more} פריטים…
                      </li>
                    )}
                  </ul>
                  <div className="border-t border-border/50 mt-3 pt-2 flex items-center justify-between">
                    <span className="text-base font-black text-primary">₪{savedCart.total}</span>
                    <span className="text-xs text-muted-foreground font-semibold">סה״כ</span>
                  </div>
                </div>

                {/* Actions — two equal buttons side by side */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={onResume}
                    className="rounded-2xl py-3 font-black text-sm shadow-lg active:scale-[0.98] transition-all text-white"
                    style={{
                      background: "hsl(142 76% 42%)",
                      boxShadow: "0 6px 20px hsl(142 76% 42% / 0.35)",
                    }}
                  >
                    להמשיך בהזמנה
                  </button>
                  <button
                    onClick={onStartOver}
                    className="rounded-2xl py-3 font-bold text-sm bg-muted text-muted-foreground hover:bg-muted/70 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw size={14} />
                    להתחיל מחדש
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SavedCartModal;
