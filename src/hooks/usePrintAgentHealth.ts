import { useCallback, useEffect, useRef, useState } from "react";
import { checkAgentHealth, type AgentHealth } from "@/lib/localPrintAgent";

const POLL_MS = 10_000;

export function usePrintAgentHealth(
  enabled: boolean = true,
): [AgentHealth | null, () => Promise<AgentHealth | null>] {
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    const h = await checkAgentHealth();
    if (mountedRef.current) setHealth(h);
    return h;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    refresh();
    const id = setInterval(refresh, POLL_MS);

    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, refresh]);

  return [health, refresh];
}
