// Deals: "של מי המנה?" is asked in its own popup when leaving each burger.
// After the customer skips it twice, the popup stops and the burger screen
// shows the small optional "+ רוצה להוסיף שם על המנה?" button instead.
import { useCallback, useState } from "react";

const SKIPS_BEFORE_BUTTON = 2;

export const useDealNamePrompt = () => {
  const [skips, setSkips] = useState(0);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const mode: "popup" | "button" = skips >= SKIPS_BEFORE_BUTTON ? "button" : "popup";

  /** Call on "המשך" of a burger: shows the popup unless a name is already set. */
  const ask = useCallback((hasName: boolean, proceed: () => void) => {
    if (hasName || mode === "button") { proceed(); return; }
    setPending(() => proceed);
  }, [mode]);

  const finish = useCallback((skipped: boolean) => {
    if (skipped) setSkips((n) => n + 1);
    const next = pending;
    setPending(null);
    next?.();
  }, [pending]);

  const reset = useCallback(() => { setSkips(0); setPending(null); }, []);

  return { mode, open: pending !== null, ask, finish, reset };
};
