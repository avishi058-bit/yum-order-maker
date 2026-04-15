import { useState, useEffect, useCallback, useRef } from "react";

const IDLE_THRESHOLD = 15_000; // 15s no touch → show countdown
const COUNTDOWN_SECONDS = 30;  // 30s countdown before reset

export function useKioskInactivityTimer(
  isActive: boolean, // only run when view !== "welcome"
  onReset: () => void
) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<number | null>(null);

  const clearAll = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    idleTimer.current = null;
    countdownInterval.current = null;
    countdownRef.current = null;
    setCountdown(null);
  }, []);

  const startIdleTimer = useCallback(() => {
    clearAll();
    if (!isActive) return;
    idleTimer.current = setTimeout(() => {
      // Start countdown
      countdownRef.current = COUNTDOWN_SECONDS;
      setCountdown(COUNTDOWN_SECONDS);
      countdownInterval.current = setInterval(() => {
        countdownRef.current = (countdownRef.current ?? 0) - 1;
        if (countdownRef.current! <= 0) {
          clearAll();
          onReset();
        } else {
          setCountdown(countdownRef.current);
        }
      }, 1000);
    }, IDLE_THRESHOLD);
  }, [isActive, onReset, clearAll]);

  const handleInteraction = useCallback(() => {
    startIdleTimer();
  }, [startIdleTimer]);

  useEffect(() => {
    if (!isActive) {
      clearAll();
      return;
    }
    startIdleTimer();

    const events = ["pointerdown", "pointermove", "touchstart", "click"] as const;
    events.forEach((e) => window.addEventListener(e, handleInteraction, { passive: true }));

    return () => {
      clearAll();
      events.forEach((e) => window.removeEventListener(e, handleInteraction));
    };
  }, [isActive, startIdleTimer, handleInteraction, clearAll]);

  return { countdown };
}
