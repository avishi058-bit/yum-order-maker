/**
 * Fly-to-cart animation context.
 *
 * Renders a single shared "ghost" element that flies from a source rect
 * (the menu card / customize button) toward the cart icon, then disappears.
 *
 * Why a single shared layer instead of per-card elements?
 *  - Keeps the DOM cheap: at most ONE animating element on screen at a time.
 *  - Uses CSS transform/opacity only (GPU-friendly, no layout thrash).
 *  - Doesn't matter where the source unmounted — the ghost lives at the root.
 *
 * Usage:
 *   const { flyToCart, registerCartTarget } = useFlyToCart();
 *   const cartRef = useRef<HTMLElement>(null);
 *   useEffect(() => registerCartTarget(cartRef.current), []);
 *   ...
 *   flyToCart({ sourceRect, imageUrl, color });
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag } from "lucide-react";

interface FlyOptions {
  sourceRect: DOMRect;
  imageUrl?: string;
  /** Fallback fill color when no imageUrl (uses CSS var). */
  color?: string;
}

interface ActiveFly extends FlyOptions {
  id: number;
  targetRect: DOMRect;
}

interface FlyToCartContextValue {
  flyToCart: (opts: FlyOptions) => void;
  /** Register the cart icon DOM node so the ghost knows where to fly to. */
  registerCartTarget: (el: HTMLElement | null) => void;
}

const FlyToCartContext = createContext<FlyToCartContextValue | null>(null);

export const useFlyToCart = () => {
  const ctx = useContext(FlyToCartContext);
  if (!ctx) {
    // Soft fallback — if provider isn't mounted yet, no-op.
    return {
      flyToCart: () => {},
      registerCartTarget: () => {},
    };
  }
  return ctx;
};

export const FlyToCartProvider = ({ children }: { children: React.ReactNode }) => {
  const [flies, setFlies] = useState<ActiveFly[]>([]);
  const cartTargetRef = useRef<HTMLElement | null>(null);
  const idCounter = useRef(0);

  const registerCartTarget = useCallback((el: HTMLElement | null) => {
    cartTargetRef.current = el;
  }, []);

  const flyToCart = useCallback((opts: FlyOptions) => {
    const launch = (attempt = 0) => {
      const target = cartTargetRef.current;
      if (!target) {
        // The cart icon may not have mounted yet (first item just added).
        // Retry up to ~5 frames before giving up — keeps the animation
        // smooth on the very first add without holding it forever.
        if (attempt < 5) {
          requestAnimationFrame(() => launch(attempt + 1));
        }
        return;
      }
      const targetRect = target.getBoundingClientRect();
      const id = ++idCounter.current;
      setFlies((prev) => [...prev, { ...opts, id, targetRect }]);
    };
    launch();
  }, []);

  const removeFly = useCallback((id: number) => {
    setFlies((prev) => prev.filter((f) => f.id !== id));
    // No cart pulse — user requested a clean "lands in cart" feel without
    // any blinking/bouncing on the destination.
  }, []);

  return (
    <FlyToCartContext.Provider value={{ flyToCart, registerCartTarget }}>
      {children}
      {/* Render the ghost layer at root (above content, below modals). */}
      <FlyLayer flies={flies} onComplete={removeFly} />
    </FlyToCartContext.Provider>
  );
};

const FlyLayer = ({ flies, onComplete }: { flies: ActiveFly[]; onComplete: (id: number) => void }) => {
  return (
    <div className="pointer-events-none fixed inset-0 z-[9000]" aria-hidden>
      <AnimatePresence>
        {flies.map((f) => {
          const startX = f.sourceRect.left + f.sourceRect.width / 2 - 24;
          const startY = f.sourceRect.top + f.sourceRect.height / 2 - 24;
          const endX = f.targetRect.left + f.targetRect.width / 2 - 24;
          const endY = f.targetRect.top + f.targetRect.height / 2 - 24;

          return (
            <motion.div
              key={f.id}
              initial={{ x: startX, y: startY, scale: 1, opacity: 1 }}
              animate={{
                x: endX,
                y: endY,
                scale: 0.2,
                opacity: 0,
              }}
              transition={{
                // Smooth glide — slight ease-in-out so the item gently
                // accelerates and softly lands in the cart (no abrupt jump
                // up or blink at the destination).
                duration: 0.5,
                ease: [0.4, 0.0, 0.2, 1],
                opacity: { duration: 0.5, ease: [0.7, 0, 1, 1] },
              }}
              onAnimationComplete={() => onComplete(f.id)}
              style={{ position: "absolute", left: 0, top: 0, width: 48, height: 48, willChange: "transform, opacity" }}
              className="rounded-2xl overflow-hidden shadow-lg shadow-primary/30 bg-primary text-primary-foreground flex items-center justify-center"
            >
              {f.imageUrl ? (
                <img src={f.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <ShoppingBag size={26} />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
