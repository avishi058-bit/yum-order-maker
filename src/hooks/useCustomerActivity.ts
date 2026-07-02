import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Anonymous customer-activity signal for the kitchen.
 *
 * Uses Supabase Realtime "presence" (no DB writes). Customers that are
 * actively building an order join a shared channel; the kitchen subscribes
 * as a passive observer and sees the live count.
 *
 * We intentionally track NO identifying info — only an anonymous session id
 * and a `role: "customer"` flag. The kitchen never sees who the customer is.
 */
const CHANNEL_NAME = "customer-activity";

/**
 * Customer side: joins the presence channel while `active` is true.
 * The presence entry is dropped automatically when `active` flips to false
 * or when the tab/component unmounts.
 */
export function useTrackCustomerActivity(active: boolean) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!active) return;
    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    const channel = supabase.channel(CHANNEL_NAME, {
      config: { presence: { key: sessionId } },
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ role: "customer", startedAt: Date.now() });
      }
    });

    channelRef.current = channel;

    // Untrack immediately when the tab closes so the kitchen indicator
    // disappears right away instead of waiting for the realtime timeout.
    const handleUnload = () => {
      try {
        channel.untrack();
      } catch {
        /* noop */
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
      try {
        channel.untrack();
      } catch {
        /* noop */
      }
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [active]);
}

/**
 * Kitchen side: subscribes as a passive observer and returns the number
 * of anonymous customers currently building an order.
 */
export function useActiveCustomerCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME);

    const recompute = () => {
      const state = channel.presenceState<{ role?: string }>();
      let n = 0;
      for (const key of Object.keys(state)) {
        const entries = state[key] as Array<{ role?: string }>;
        for (const p of entries) {
          if (p?.role === "customer") n++;
        }
      }
      setCount(n);
    };

    channel
      .on("presence", { event: "sync" }, recompute)
      .on("presence", { event: "join" }, recompute)
      .on("presence", { event: "leave" }, recompute)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return count;
}
