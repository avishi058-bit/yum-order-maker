import { useEffect } from "react";

/**
 * iOS-safe body scroll lock.
 *
 * When `locked` is true, prevents the page behind the modal from scrolling —
 * including iOS Safari, where `overflow:hidden` alone is not enough (the page
 * still rubber-bands and can "escape" to the background).
 *
 * Strategy:
 *   - Capture current scroll position.
 *   - Set body to `position:fixed; top:-<scrollY>px; width:100%` — this freezes
 *     the visible viewport at exactly the same place without any visual jump.
 *   - On unlock, restore styles AND scroll the window back to where it was.
 *
 * Reference counting via a module-level counter ensures multiple stacked
 * modals (e.g. Cart → Checkout → Terms) all play nicely: only the FIRST
 * locker freezes the body, and only the LAST unlocker restores it.
 */
let lockCount = 0;
let savedScrollY = 0;
let savedStyles: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
} | null = null;

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    lockCount += 1;
    if (lockCount === 1) {
      const body = document.body;
      savedScrollY = window.scrollY || window.pageYOffset || 0;
      savedStyles = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        overflow: body.style.overflow,
      };
      body.style.position = "fixed";
      body.style.top = `-${savedScrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
    }

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0 && savedStyles) {
        const body = document.body;
        body.style.position = savedStyles.position;
        body.style.top = savedStyles.top;
        body.style.left = savedStyles.left;
        body.style.right = savedStyles.right;
        body.style.width = savedStyles.width;
        body.style.overflow = savedStyles.overflow;
        savedStyles = null;
        // Restore scroll position. Use "auto" to avoid smooth-scroll animation.
        window.scrollTo({ top: savedScrollY, left: 0, behavior: "auto" });
      }
    };
  }, [locked]);
}
