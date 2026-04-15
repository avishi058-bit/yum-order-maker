import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RestaurantStatus {
  website_open: boolean;
  station_open: boolean;
}

export const useRestaurantStatus = () => {
  const [status, setStatus] = useState<RestaurantStatus>({ website_open: true, station_open: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("restaurant_status")
        .select("website_open, station_open")
        .limit(1)
        .single();
      if (data) setStatus(data);
      setLoading(false);
    };

    fetch();

    const channel = supabase
      .channel("restaurant-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "restaurant_status" },
        (payload) => {
          const { website_open, station_open } = payload.new as RestaurantStatus;
          setStatus({ website_open, station_open });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleWebsite = async (open: boolean) => {
    await supabase.from("restaurant_status").update({ website_open: open }).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus((prev) => ({ ...prev, website_open: open }));
  };

  const toggleStation = async (open: boolean) => {
    await supabase.from("restaurant_status").update({ station_open: open }).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus((prev) => ({ ...prev, station_open: open }));
  };

  const closeAll = async () => {
    await supabase.from("restaurant_status").update({ website_open: false, station_open: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus({ website_open: false, station_open: false });
  };

  const openAll = async () => {
    await supabase.from("restaurant_status").update({ website_open: true, station_open: true }).neq("id", "00000000-0000-0000-0000-000000000000");
    setStatus({ website_open: true, station_open: true });
  };

  return { status, loading, toggleWebsite, toggleStation, closeAll, openAll };
};
