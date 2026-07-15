import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shared polling hook for tracking a customer order via the
 * `get-order-by-token` secure edge function.
 *
 * De-duplication:
 * When multiple components (e.g. OrderTopBar + OrderLiveTracker) subscribe to
 * the same (orderNumber, phone) pair, they share a single 8s polling interval
 * and a single in-flight fetch, instead of each running their own. This keeps
 * the polling cadence and edge function unchanged, but halves (or more) the
 * request volume when overlapping trackers are mounted on /track.
 */

const POLL_INTERVAL_MS = 8000;

type Listener = (order: any) => void;

interface Entry {
  order: any;
  listeners: Set<Listener>;
  intervalId: ReturnType<typeof setInterval> | null;
  inflight: Promise<void> | null;
}

const registry = new Map<string, Entry>();

const keyFor = (orderNumber: number, phone: string | undefined) =>
  `${orderNumber}::${phone ?? ""}`;

const fetchOnce = async (
  entry: Entry,
  orderNumber: number,
  phone: string,
): Promise<void> => {
  if (entry.inflight) return entry.inflight;
  entry.inflight = (async () => {
    try {
      const { data } = await supabase.functions.invoke("get-order-by-token", {
        body: { order_number: orderNumber, phone },
      });
      const fetched = data?.order;
      if (fetched) {
        entry.order = fetched;
        entry.listeners.forEach((l) => l(fetched));
      }
    } finally {
      entry.inflight = null;
    }
  })();
  return entry.inflight;
};

export function useOrderPoll(
  orderNumber: number | null | undefined,
  phone: string | null | undefined,
): any {
  const [order, setOrder] = useState<any>(() => {
    if (!orderNumber || !phone) return null;
    return registry.get(keyFor(orderNumber, phone))?.order ?? null;
  });

  useEffect(() => {
    if (!orderNumber || !phone) {
      setOrder(null);
      return;
    }
    const key = keyFor(orderNumber, phone);
    let entry = registry.get(key);
    if (!entry) {
      entry = { order: null, listeners: new Set(), intervalId: null, inflight: null };
      registry.set(key, entry);
    }

    const listener: Listener = (o) => setOrder(o);
    entry.listeners.add(listener);

    // Seed with cached value if present, else kick off first fetch.
    if (entry.order) {
      setOrder(entry.order);
    } else {
      fetchOnce(entry, orderNumber, phone);
    }

    // Start the shared interval only for the first subscriber.
    if (!entry.intervalId) {
      entry.intervalId = setInterval(() => {
        fetchOnce(entry!, orderNumber, phone);
      }, POLL_INTERVAL_MS);
    }

    return () => {
      const e = registry.get(key);
      if (!e) return;
      e.listeners.delete(listener);
      if (e.listeners.size === 0) {
        if (e.intervalId) clearInterval(e.intervalId);
        registry.delete(key);
      }
    };
  }, [orderNumber, phone]);

  return order;
}
