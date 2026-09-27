import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RestaurantStatus {
  website_open: boolean;
  station_open: boolean;
  cash_enabled: boolean;
  credit_enabled: boolean;
  kiosk_cash_enabled: boolean;
  kiosk_credit_enabled: boolean;
  kiosk_paybox_enabled: boolean;
  high_load: boolean;
  preorder_enabled: boolean;
  preorder_start_time: string; // "HH:MM" or "HH:MM:SS"
  preorder_end_time: string;
  delivery_enabled: boolean;
  soldier_fund_enabled: boolean;
}

const SELECT_COLS = "website_open, station_open, cash_enabled, credit_enabled, kiosk_cash_enabled, kiosk_credit_enabled, kiosk_paybox_enabled, high_load, preorder_enabled, preorder_start_time, preorder_end_time, delivery_enabled, soldier_fund_enabled";

const CACHE_KEY = "habakta_restaurant_status";

const DEFAULT_STATUS: RestaurantStatus = { website_open: true, station_open: true, cash_enabled: true, credit_enabled: true, kiosk_cash_enabled: true, kiosk_credit_enabled: true, kiosk_paybox_enabled: false, high_load: false, preorder_enabled: false, preorder_start_time: "10:00", preorder_end_time: "22:00", delivery_enabled: false, soldier_fund_enabled: true };

// Read the last known status synchronously so a closed restaurant never
// flashes as "open" for the ~1.5s the network request takes.
const readCache = (): RestaurantStatus | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Drop stale snapshots (older than 2h or legacy without timestamp) so an
    // old "closed" value can never lock a customer out.
    if (!parsed._ts || Date.now() - parsed._ts > 2 * 60 * 60 * 1000) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    delete parsed._ts;
    return { ...DEFAULT_STATUS, ...parsed } as RestaurantStatus;
  } catch {
    return null;
  }
};

const writeCache = (s: RestaurantStatus) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...s, _ts: Date.now() })); } catch { /* ignore */ }
};

export const useRestaurantStatus = () => {
  const cached = useRef(readCache());
  const [status, setStatus] = useState<RestaurantStatus>(cached.current ?? DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  // True until we have a trustworthy value (fresh fetch, or a cached one).
  const [resolved, setResolved] = useState(cached.current !== null);
  const channelId = useRef(`restaurant-status-${Math.random().toString(36).slice(2)}`);


  useEffect(() => {
    const fetch = async () => {
      let data: unknown = null;
      for (let attempt = 0; attempt < 3 && !data; attempt++) {
        const res = await supabase
          .from("restaurant_status")
          .select(SELECT_COLS)
          .limit(1)
          .single();
        data = res.data;
        if (!data) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
      if (data) {
        setStatus(data as RestaurantStatus);
        writeCache(data as RestaurantStatus);
      }
      setResolved(true);
      setLoading(false);

    };

    fetch();

    // Re-sync when the tab returns to foreground / network reconnects, and
    // periodically — realtime can silently drop on mobile background tabs,
    // leaving a stale "closed" status on screen.
    const onVisible = () => { if (document.visibilityState === "visible") fetch(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", fetch);
    window.addEventListener("online", fetch);
    const poll = setInterval(fetch, 60_000);

    const channel = supabase
      .channel(channelId.current)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "restaurant_status" },
        (payload) => {
          const n = payload.new as Partial<RestaurantStatus>;
          setStatus((prev) => {
            const next: RestaurantStatus = {
              website_open: n.website_open ?? prev.website_open,
              station_open: n.station_open ?? prev.station_open,
              cash_enabled: n.cash_enabled ?? prev.cash_enabled,
              credit_enabled: n.credit_enabled ?? prev.credit_enabled,
              kiosk_cash_enabled: n.kiosk_cash_enabled ?? prev.kiosk_cash_enabled,
              kiosk_credit_enabled: n.kiosk_credit_enabled ?? prev.kiosk_credit_enabled,
              kiosk_paybox_enabled: n.kiosk_paybox_enabled ?? prev.kiosk_paybox_enabled,
              high_load: n.high_load ?? prev.high_load,
              preorder_enabled: n.preorder_enabled ?? prev.preorder_enabled,
              preorder_start_time: n.preorder_start_time ?? prev.preorder_start_time,
              preorder_end_time: n.preorder_end_time ?? prev.preorder_end_time,
              delivery_enabled: n.delivery_enabled ?? prev.delivery_enabled,
              soldier_fund_enabled: n.soldier_fund_enabled ?? prev.soldier_fund_enabled,
            };
            writeCache(next);
            return next;
          });

        }
      )
      .subscribe();

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", fetch);
      window.removeEventListener("online", fetch);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, []);


  const notifyReopen = async () => {
    try {
      await supabase.functions.invoke("notify-reopen");
    } catch (e) {
      console.error("notify-reopen failed", e);
    }
  };

  const toggleWebsite = async (open: boolean) => {
    const wasClosed = !status.website_open;
    await supabase.from("restaurant_status").update({ website_open: open }).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus((prev) => ({ ...prev, website_open: open }));
    if (open && wasClosed) notifyReopen();
  };

  const toggleStation = async (open: boolean) => {
    await supabase.from("restaurant_status").update({ station_open: open }).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus((prev) => ({ ...prev, station_open: open }));
  };

  const toggleCash = async (enabled: boolean) => {
    await supabase.from("restaurant_status").update({ cash_enabled: enabled }).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus((prev) => ({ ...prev, cash_enabled: enabled }));
  };

  const toggleCredit = async (enabled: boolean) => {
    await supabase.from("restaurant_status").update({ credit_enabled: enabled }).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus((prev) => ({ ...prev, credit_enabled: enabled }));
  };

  const toggleKioskCash = async (enabled: boolean) => {
    await supabase.from("restaurant_status").update({ kiosk_cash_enabled: enabled }).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus((prev) => ({ ...prev, kiosk_cash_enabled: enabled }));
  };

  const toggleKioskCredit = async (enabled: boolean) => {
    await supabase.from("restaurant_status").update({ kiosk_credit_enabled: enabled }).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus((prev) => ({ ...prev, kiosk_credit_enabled: enabled }));
  };

  const toggleKioskPaybox = async (enabled: boolean) => {
    await supabase.from("restaurant_status").update({ kiosk_paybox_enabled: enabled }).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus((prev) => ({ ...prev, kiosk_paybox_enabled: enabled }));
  };

  const closeAll = async () => {
    await supabase.from("restaurant_status").update({ website_open: false, station_open: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus((prev) => ({ ...prev, website_open: false, station_open: false }));
  };

  const openAll = async () => {
    const wasClosed = !status.website_open;
    await supabase.from("restaurant_status").update({ website_open: true, station_open: true }).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus((prev) => ({ ...prev, website_open: true, station_open: true }));
    if (wasClosed) notifyReopen();
  };

  const toggleHighLoad = async (on: boolean) => {
    await supabase.from("restaurant_status").update({ high_load: on }).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus((prev) => ({ ...prev, high_load: on }));
  };

  const togglePreorder = async (on: boolean) => {
    await supabase.from("restaurant_status").update({ preorder_enabled: on }).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus((prev) => ({ ...prev, preorder_enabled: on }));
  };

  const setPreorderWindow = async (start: string, end: string) => {
    await supabase.from("restaurant_status").update({ preorder_start_time: start, preorder_end_time: end }).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus((prev) => ({ ...prev, preorder_start_time: start, preorder_end_time: end }));
  };

  const toggleDelivery = async (on: boolean) => {
    await supabase.from("restaurant_status").update({ delivery_enabled: on }).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus((prev) => ({ ...prev, delivery_enabled: on }));
  };

  const toggleSoldierFund = async (on: boolean) => {
    await supabase.from("restaurant_status").update({ soldier_fund_enabled: on } as any).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus((prev) => ({ ...prev, soldier_fund_enabled: on }));
  };

  return { status, loading, resolved, toggleSoldierFund, toggleWebsite, toggleStation, toggleCash, toggleCredit, toggleKioskCash, toggleKioskCredit, toggleKioskPaybox, toggleHighLoad, togglePreorder, setPreorderWindow, toggleDelivery, closeAll, openAll };
};
