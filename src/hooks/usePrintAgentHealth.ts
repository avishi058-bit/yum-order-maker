import { useEffect, useState } from "react";
import { checkAgentHealth, type AgentHealth } from "@/lib/localPrintAgent";

const POLL_MS = 10_000;

export function usePrintAgentHealth(enabled: boolean = true): AgentHealth | null {
  const [health, setHealth] = useState<AgentHealth | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = async () => {
      const h = await checkAgentHealth();
      if (!cancelled) setHealth(h);
    };
    tick();
    const id = setInterval(tick, POLL_MS);

    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled]);

  return health;
}
