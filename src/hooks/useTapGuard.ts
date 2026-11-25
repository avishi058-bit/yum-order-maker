// Ignore taps that land right after a scroll (accidental touches while scrolling).
import { useCallback, useRef } from "react";

export const useTapGuard = () => {
  const lastScrollAt = useRef(0);
  const markScroll = useCallback(() => { lastScrollAt.current = Date.now(); }, []);
  const guard = useCallback(
    <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        if (Date.now() - lastScrollAt.current < 350) return;
        fn(...args);
      },
    [],
  );
  return { markScroll, guard };
};
export type TapGuard = ReturnType<typeof useTapGuard>["guard"];
