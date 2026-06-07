// Singleton store of currently unavailable ingredients.
//
// Why a singleton: the removal-shortcut logic (getRemovalShortcut) needs to be
// callable synchronously from non-React contexts (bon printing, etc).
// We seed it once at boot and keep it fresh via realtime updates.

import { supabase } from "@/integrations/supabase/client";

let unavailable: Set<string> = new Set();
let initialized = false;
const listeners: Array<(s: Set<string>) => void> = [];

function notify() {
  for (const l of listeners) l(unavailable);
}

export function getUnavailableIngredientIds(): Set<string> {
  return unavailable;
}

export function subscribeIngredientAvailability(cb: (s: Set<string>) => void): () => void {
  listeners.push(cb);
  cb(unavailable);
  return () => {
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export async function initIngredientAvailability(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const { data } = await supabase
    .from("menu_availability")
    .select("item_id, available, category")
    .eq("category", "ingredient");
  if (data) {
    const next = new Set<string>();
    for (const row of data) {
      if (row.available === false) next.add(row.item_id);
    }
    unavailable = next;
    notify();
  }

  supabase
    .channel(`ingredient-availability-${Math.random().toString(36).slice(2, 10)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "menu_availability" },
      (payload) => {
        const row = (payload.new || payload.old) as { item_id?: string; available?: boolean; category?: string } | null;
        if (!row || row.category !== "ingredient" || !row.item_id) return;
        const next = new Set(unavailable);
        const isNowUnavailable = (payload.new as { available?: boolean } | null)?.available === false;
        if (isNowUnavailable) next.add(row.item_id);
        else next.delete(row.item_id);
        unavailable = next;
        notify();
      },
    )
    .subscribe();
}
