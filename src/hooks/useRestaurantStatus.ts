import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RestaurantStatus {
  website_open: boolean;
  station_open: boolean;
  cash_enabled: boolean;
  credit_enabled: boolean;
  high_load: boolean;
  preorder_enabled: boolean;
  preorder_start_time: string; // "HH:MM" or "HH:MM:SS"
  preorder_end_time: string;
  delivery_enabled: boolean;
}

const SELECT_COLS = "website_open, station_open, cash_enabled, credit_enabled, high_load, preorder_enabled, preorder_start_time, preorder_end_time, delivery_enabled";

export const useRestaurantStatus = () => {
  const [status, setStatus] = useState<RestaurantStatus>({ website_open: true, station_open: true, cash_enabled: true, credit_enabled: true, high_load: false, preorder_enabled: false, preorder_start_time: "10:00", preorder_end_time: "22:00", delivery_enabled: false });
  const [loading, setLoading] = useState(true);
  const channelId = useRef(`restaurant-status-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("restaurant_status")
        .select(SELECT_COLS)
        .limit(1)
        .single();
      if (data) setStatus(data as RestaurantStatus);
      setLoading(false);
    };

    fetch();

    const channel = supabase
      .channel(channelId.current)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "restaurant_status" },
        (payload) => {
          const n = payload.new as Partial<RestaurantStatus>;
          setStatus((prev) => ({
            website_open: n.website_open ?? prev.website_open,
            station_open: n.station_open ?? prev.station_open,
            cash_enabled: n.cash_enabled ?? prev.cash_enabled,
            credit_enabled: n.credit_enabled ?? prev.credit_enabled,
            high_load: n.high_load ?? prev.high_load,
            preorder_enabled: n.preorder_enabled ?? prev.preorder_enabled,
            preorder_start_time: n.preorder_start_time ?? prev.preorder_start_time,
            preorder_end_time: n.preorder_end_time ?? prev.preorder_end_time,
          }));
        }
      )
      .subscribe();

    return () => {
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

  return { status, loading, toggleWebsite, toggleStation, toggleCash, toggleCredit, toggleHighLoad, togglePreorder, setPreorderWindow, closeAll, openAll };
};
