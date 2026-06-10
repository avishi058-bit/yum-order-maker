import { useEffect, useRef } from "react";

/**
 * Keeps the screen awake using the Screen Wake Lock API.
 * Re-acquires the lock when the tab becomes visible again.
 */
export function useWakeLock(enabled: boolean = true) {
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !(navigator as any).wakeLock) return;

    let cancelled = false;

    const request = async () => {
      try {
        const lock = await (navigator as any).wakeLock.request("screen");
        if (cancelled) {
          try { await lock.release(); } catch {}
          return;
        }
        wakeLockRef.current = lock;
        lock.addEventListener?.("release", () => {
          wakeLockRef.current = null;
        });
      } catch (e) {
        // user gesture may be required, or denied — ignore silently
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        request();
      }
    };

    request();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      const lock = wakeLockRef.current;
      wakeLockRef.current = null;
      if (lock) {
        try { lock.release(); } catch {}
      }
    };
  }, [enabled]);
}
