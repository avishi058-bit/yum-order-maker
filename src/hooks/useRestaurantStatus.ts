import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RestaurantStatus {
  website_open: boolean;
  station_open: boolean;
  cash_enabled: boolean;
  credit_enabled: boolean;
}

export const useRestaurantStatus = () => {
  const [status, setStatus] = useState<RestaurantStatus>({ website_open: true, station_open: true, cash_enabled: true, credit_enabled: true });
  const [loading, setLoading] = useState(true);
  const channelId = useRef(`restaurant-status-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("restaurant_status")
        .select("website_open, station_open, cash_enabled, credit_enabled")
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
          const { website_open, station_open, cash_enabled, credit_enabled } = payload.new as RestaurantStatus;
          setStatus({ website_open, station_open, cash_enabled, credit_enabled });
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

  return { status, loading, toggleWebsite, toggleStation, toggleCash, toggleCredit, closeAll, openAll };
};
