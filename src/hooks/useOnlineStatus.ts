import { useEffect, useRef, useState } from "react";

/**
 * Connection watchdog.
 *
 * `navigator.onLine` alone is not enough — on a phone the Wi-Fi can stay
 * "connected" while there is no real route to the server, which is exactly the
 * case where the kitchen screen looks frozen. So on top of the browser events
 * we run a lightweight periodic probe against the backend and report offline
 * when the probe fails twice in a row.
 */
export function useOnlineStatus(probeIntervalMs = 15000) {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [lastOkAt, setLastOkAt] = useState<number>(() => Date.now());
  const failuresRef = useRef(0);

  useEffect(() => {
    const goOnline = () => {
      failuresRef.current = 0;
      setOnline(true);
      setLastOkAt(Date.now());
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`;

    const probe = async () => {
      if (document.visibilityState === "hidden") return;
      if (!navigator.onLine) {
        if (!cancelled) setOnline(false);
        return;
      }
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);
        await fetch(url, { method: "GET", cache: "no-store", signal: ctrl.signal });
        clearTimeout(timer);
        if (cancelled) return;
        failuresRef.current = 0;
        setOnline(true);
        setLastOkAt(Date.now());
      } catch {
        if (cancelled) return;
        failuresRef.current += 1;
        // Two consecutive failures → treat as a real outage, not a hiccup.
        if (failuresRef.current >= 2) setOnline(false);
      }
    };

    const id = setInterval(probe, probeIntervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") probe();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [probeIntervalMs]);

  return { online, lastOkAt };
}
