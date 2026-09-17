import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AvailabilityMap {
  [itemId: string]: boolean;
}

/** Ids that represent the same physical ingredient — availability is shared. */
export const AVAILABILITY_ALIAS_GROUPS: string[][] = [
  ["pickled-jalapeno", "pickled-jalapeno-side", "pickled-jalapeno-sauce"],
];

export const useAvailability = () => {
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAvailability = async () => {
      const { data } = await supabase
        .from("menu_availability")
        .select("item_id, available");
      if (data) {
        const map: AvailabilityMap = {};
        data.forEach((row) => {
          map[row.item_id] = row.available;
        });
        setAvailability(map);
      }
      setLoading(false);
    };

    fetchAvailability();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`menu-availability-${Math.random().toString(36).slice(2, 10)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "menu_availability" },
        (payload) => {
          const { item_id, available } = payload.new as { item_id: string; available: boolean };
          setAvailability((prev) => ({ ...prev, [item_id]: available }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isAvailable = (itemId: string) => {
    // Some ingredients exist under several ids (topping / "on the side" / sauce).
    // Disabling any one of them must hide the whole group.
    const group = AVAILABILITY_ALIAS_GROUPS.find((g) => g.includes(itemId));
    if (group) return group.every((id) => availability[id] !== false);
    return availability[itemId] !== false; // default to available if not in DB
  };

  return { availability, isAvailable, loading };
};
