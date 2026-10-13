import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Apple-like scroll reveal: the block starts slightly lowered and transparent,
 * then rises and fades in smoothly when it enters the viewport.
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
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
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
