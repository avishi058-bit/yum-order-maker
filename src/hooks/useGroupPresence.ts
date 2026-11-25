import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Live "who is ordering right now" for a group order, like WhatsApp's
 * "typing...". Realtime presence only (no DB writes): a participant on the
 * menu shares just their group name and whether they are picking or paying;
 * the group page shows it to everyone with the link.
 */
export type GroupActivity = "building" | "paying";
export type GroupPresence = { name: string; state: GroupActivity };

const channelName = (code: string) => `group-order-${code}`;

/** Participant side (the menu page while ordering into a group). */
export function useTrackGroupPresence(code: string | null, name: string, state: GroupActivity) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!code || !name) return;
    const key = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    const channel = supabase.channel(channelName(code), { config: { presence: { key } } });
    const track = () => { try { void channel.track({ name, state: stateRef.current }); } catch { /* noop */ } };
    const untrack = () => { try { void channel.untrack(); } catch { /* noop */ } };
    channel.subscribe((status) => { if (status === "SUBSCRIBED") track(); });
    channelRef.current = channel;

    const onVisibility = () => (document.visibilityState === "hidden" ? untrack() : track());
    window.addEventListener("pagehide", untrack);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", untrack);
      document.removeEventListener("visibilitychange", onVisibility);
      untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [code, name]);

  // Picking -> paying without rejoining the channel.
  useEffect(() => {
    try { void channelRef.current?.track({ name, state }); } catch { /* noop */ }
  }, [name, state]);
}

/** Group page side: everyone currently on the menu for this group. */
export function useGroupPresence(code: string): GroupPresence[] {
  const [people, setPeople] = useState<GroupPresence[]>([]);
  useEffect(() => {
    const channel = supabase.channel(channelName(code));
    const recompute = () => {
      const byName = new Map<string, GroupPresence>();
      for (const entries of Object.values(channel.presenceState<{ name?: string; state?: GroupActivity }>())) {
        for (const p of entries) {
          if (!p?.name) continue;
          const prev = byName.get(p.name);
          // Two tabs of one person: "paying" wins.
          if (!prev || p.state === "paying") byName.set(p.name, { name: p.name, state: p.state === "paying" ? "paying" : "building" });
        }
      }
      setPeople([...byName.values()]);
    };
    channel
      .on("presence", { event: "sync" }, recompute)
      .on("presence", { event: "join" }, recompute)
      .on("presence", { event: "leave" }, recompute)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [code]);
  return people;
}
