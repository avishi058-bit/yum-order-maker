import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Apple-like scroll reveal: the block starts slightly lowered and transparent,
 * then rises and fades in smoothly when it scrolls into view.
 * Respects prefers-reduced-motion (renders instantly, no animation).
 */
interface RevealProps {
  children: ReactNode;
  /** Extra delay in ms - use small steps (60-120) for staggered lists. */
  delay?: number;
  /** How far (px) the block starts below its final position. */
  distance?: number;
  className?: string;
}

const Reveal = ({ children, delay = 0, distance = 28, className }: RevealProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    // Shown once its top passes 92% of the screen height. Checking the position
    // (not only an IntersectionObserver) also catches jumps that skip past the
    // block, so content is never left hidden above the screen.
    let frame = 0;
    const check = () => {
      frame = 0;
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
        setVisible(true);
        stop();
      }
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    const stop = () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    check();
    return stop;
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : `translateY(${distance}px)`,
        transition: `opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        willChange: visible ? undefined : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
};

export default Reveal;
