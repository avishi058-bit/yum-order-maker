import { useState, useEffect, useRef } from "react";

const IDLE_THRESHOLD = 15_000; // 15s no touch → show countdown
const COUNTDOWN_SECONDS = 30;  // 30s countdown before reset

/**
 * Idle watchdog for the kiosk.
 *
 * IMPORTANT: this hook must NOT re-render the kiosk on every pointer event.
 * Earlier versions called setState on each interaction (and re-created the
 * listener callbacks), which re-rendered the whole page continuously and made
 * the kiosk look like it was constantly reloading. Everything below is kept in
 * refs; React state is touched only when the visible countdown value actually
 * changes.
 */
export function useKioskInactivityTimer(
  isActive: boolean, // only run when view !== "welcome"
  onReset: () => void
) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;

  useEffect(() => {
    if (!isActive) {
      setCountdown(null);
      countdownRef.current = null;
      return;
    }

    const clearTimers = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (countdownInterval.current) clearInterval(countdownInterval.current);
      idleTimer.current = null;
      countdownInterval.current = null;
    };

    const stop = () => {
      clearTimers();
      if (countdownRef.current !== null) {
        countdownRef.current = null;
        setCountdown(null);
      }
    };

    const start = () => {
      stop();
      idleTimer.current = setTimeout(() => {
        countdownRef.current = COUNTDOWN_SECONDS;
        setCountdown(COUNTDOWN_SECONDS);
        countdownInterval.current = setInterval(() => {
          const next = (countdownRef.current ?? 0) - 1;
          if (next <= 0) {
            stop();
            onResetRef.current();
          } else {
            countdownRef.current = next;
            setCountdown(next);
          }
        }, 1000);
      }, IDLE_THRESHOLD);
    };

    start();

    // Throttle: restart the idle timer at most every 500ms, and never touch
    // React state unless a countdown was actually on screen.
    let lastTouch = 0;
    const handleInteraction = () => {
      const now = Date.now();
      if (countdownRef.current === null && now - lastTouch < 500) return;
      lastTouch = now;
      start();
    };

    const events = ["pointerdown", "touchstart", "click", "keydown"] as const;
    events.forEach((e) =>
      window.addEventListener(e, handleInteraction, { passive: true })
    );

    return () => {
      clearTimers();
      events.forEach((e) => window.removeEventListener(e, handleInteraction));
    };
  }, [isActive]);

  return { countdown };
}
