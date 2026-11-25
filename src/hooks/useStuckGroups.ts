// Kitchen screen: group orders that are stuck (someone paid 30+ minutes ago but
// the group was not sent). Filled by group_stuck_tick in the database; the
// kitchen sees them until someone taps "הבנתי" or the group is sent.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type StuckGroup = {
  id: string;
  organizer: string;
  phone: string | null;
  created_at: string;
  alert_at: string;
  paid: number;
  unpaid: number;
};

const POLL_MS = 15_000;

// The database functions are newer than the generated types.
const rpc = (fn: string, args: Record<string, unknown> = {}) =>
  (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc(fn, args);

export const useStuckGroups = (enabled: boolean) => {
  const [groups, setGroups] = useState<StuckGroup[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await rpc("kitchen_stuck_groups");
    if (!error && Array.isArray(data)) setGroups(data as StuckGroup[]);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [enabled, load]);

  const acknowledge = useCallback(async (id: string) => {
    setGroups((list) => list.filter((g) => g.id !== id));
    await rpc("kitchen_ack_stuck_group", { p_group: id });
  }, []);

  return { stuckGroups: groups, acknowledge };
};
