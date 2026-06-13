import { useCallback, useEffect, useRef, useState } from "react";
import { checkAgentHealth, type AgentHealth } from "@/lib/localPrintAgent";

const POLL_MS = 10_000;

export function usePrintAgentHealth(
  enabled: boolean = true,
): [AgentHealth | null, () => Promise<AgentHealth | null>] {
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const cancelledRef = useRef(false);

  const refresh = useCallback(async () => {
    const h = await checkAgentHealth();
    if (!cancelledRef.current) setHealth(h);
    return h;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    cancelledRef.current = false;

    refresh();
    const id = setInterval(refresh, POLL_MS);

    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelledRef.current = true;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, refresh]);

  return [health, refresh];
}
