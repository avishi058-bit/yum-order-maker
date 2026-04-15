import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, X } from "lucide-react";
import { MenuItem } from "@/data/menu";
import { menuImages } from "@/data/menuImages";
import { useState, useRef } from "react";

interface ItemPreviewProps {
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (item: MenuItem) => void;
  cartButtonRef?: React.RefObject<HTMLDivElement>;
}

const ItemPreview = ({ item, onClose, onAdd, cartButtonRef }: ItemPreviewProps) => {
  const [flyAnim, setFlyAnim] = useState(false);
  const [flyStyle, setFlyStyle] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  if (!item) return null;

  const image = menuImages[item.id];

  const handleAdd = () => {
    if (imageRef.current && cartButtonRef?.current) {
      const imgRect = imageRef.current.getBoundingClientRect();
      const cartRect = cartButtonRef.current.getBoundingClientRect();
      setFlyStyle({
        x: cartRect.left + cartRect.width / 2 - (imgRect.left + imgRect.width / 2),
        y: cartRect.top + cartRect.height / 2 - (imgRect.top + imgRect.height / 2),
      });
      setFlyAnim(true);
    } else {
      // No image to animate — add directly
      onAdd(item);
      onClose();
    }
  };

  const handleFlyComplete = () => {
    setFlyAnim(false);
    onAdd(item);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card rounded-3xl overflow-hidden w-[90vw] max-w-lg shadow-2xl relative"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-10 bg-black/40 text-white rounded-full w-10 h-10 flex items-center justify-center"
          >
            <X size={22} />
          </button>

          {/* Image */}
          {image && (
            <div className="relative w-full aspect-square overflow-hidden">
              <motion.img
                ref={imageRef}
                src={image}
                alt={item.name}
                className="w-full h-full object-cover"
                layoutId={`item-image-${item.id}`}
                animate={
                  flyAnim
                    ? {
                        x: flyStyle.x,
                        y: flyStyle.y,
                        scale: 0.1,
                        opacity: 0,
                        borderRadius: "50%",
                      }
                    : {}
                }
                transition={flyAnim ? { duration: 0.6, ease: "easeInOut" } : {}}
                onAnimationComplete={() => {
                  if (flyAnim) handleFlyComplete();
                }}
              />
            </div>
          )}

          {/* Info */}
          <div className="p-6 text-center" dir="rtl">
            <h2 className="text-3xl font-black mb-1">{item.name}</h2>
            {item.description && (
              <p className="text-muted-foreground text-lg mb-2">{item.description}</p>
            )}
            {item.weight && (
              <span className="inline-block text-sm text-muted-foreground bg-secondary px-3 py-1 rounded-full mb-3">
                {item.weight}
              </span>
            )}
            <p className="text-primary font-black text-4xl mb-5">₪{item.price}</p>

            {/* Animated green add button */}
            <motion.button
              onClick={handleAdd}
              className="w-full py-5 rounded-2xl bg-green-600 text-white text-2xl font-black flex items-center justify-center gap-3 shadow-lg"
              animate={{
                scale: [1, 1.03, 1],
                boxShadow: [
                  "0 4px 20px rgba(22,163,74,0.3)",
                  "0 8px 30px rgba(22,163,74,0.5)",
                  "0 4px 20px rgba(22,163,74,0.3)",
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              whileTap={{ scale: 0.95 }}
            >
              <ShoppingBag size={28} />
              הוסף לסל
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ItemPreview;
