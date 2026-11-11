// Patty weight switch (220 g ⇄ 200 g), set from the kitchen screen and stored
// in restaurant_status.patty_grams. Menu data in src/data/menu.ts keeps the
// 220 g wording; when the switch is on 200 g, every customer-facing weight is
// rewritten in place (220→200, 440→400, smash halves 110→100) and the app
// re-renders. create-order applies the same rewrite to the names it stores.
import { useSyncExternalStore } from "react";
import { menuItems, toppings } from "@/data/menu";

export type PattyGrams = 200 | 220;

const MAP: Record<string, string> = { "440": "400", "220": "200", "110": "100" };

/** Rewrites patty weights in a text for the given setting (no-op at 220). */
export const pattyText = (text: string, grams: PattyGrams = current): string =>
  grams === 200 && text ? text.replace(/\b(440|220|110)\b/g, (m) => MAP[m]) : text;

let current: PattyGrams = 220;
const listeners = new Set<() => void>();

// Original (220 g) wording, captured once before any rewrite.
const originals = {
  items: menuItems.map((m) => ({ weight: m.weight, description: m.description })),
  toppings: toppings.map((t) => t.name),
};

const apply = (g: PattyGrams) => {
  menuItems.forEach((m, i) => {
    const o = originals.items[i];
    m.weight = o.weight ? pattyText(o.weight, g) : o.weight;
    m.description = pattyText(o.description, g);
  });
  toppings.forEach((t, i) => {
    t.name = pattyText(originals.toppings[i], g);
  });
};

export const setPattyGrams = (g: number | null | undefined) => {
  const next: PattyGrams = g === 200 ? 200 : 220;
  if (next === current) return;
  current = next;
  apply(next);
  listeners.forEach((l) => l());
};

export const getPattyGrams = () => current;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Re-renders the caller whenever the patty weight changes. */
export const usePattyGrams = (): PattyGrams => useSyncExternalStore(subscribe, getPattyGrams, getPattyGrams);
