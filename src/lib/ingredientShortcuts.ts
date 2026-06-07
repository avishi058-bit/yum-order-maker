// Shared shortcuts for summarising burger removals.
//
// - If the customer removed ALL 4 veggies AND the aioli  → "יבש"
// - If the customer removed ALL 4 veggies but kept aioli → "ללא ירקות"
//
// An ingredient that is currently out of stock counts as if the customer
// removed it (it's not going on the burger anyway).
//
// Returns null if no shortcut applies; the caller should render the
// individual removals as usual.

import { getUnavailableIngredientIds } from "./ingredientAvailability";

const VEGGIE_IDS = ["no-lettuce", "no-onion", "no-tomato", "no-pickles"] as const;
const AIOLI_ID = "no-aioli";

// removalId → ingredient.id (for matching availability)
const REMOVAL_TO_INGREDIENT: Record<string, string> = {
  "no-lettuce": "lettuce",
  "no-onion": "onion",
  "no-tomato": "tomato",
  "no-pickles": "pickles",
  "no-aioli": "aioli",
};

export type RemovalShortcut = "dry" | "no-veggies" | null;

function effectiveRemovalSet(removalIds: string[]): Set<string> {
  const set = new Set(removalIds);
  const unavail = getUnavailableIngredientIds();
  for (const [removalId, ingId] of Object.entries(REMOVAL_TO_INGREDIENT)) {
    if (unavail.has(ingId)) set.add(removalId);
  }
  return set;
}

export function getRemovalShortcut(removalIds: string[]): RemovalShortcut {
  const set = effectiveRemovalSet(removalIds);
  const allVeggies = VEGGIE_IDS.every((id) => set.has(id));
  if (!allVeggies) return null;
  return set.has(AIOLI_ID) ? "dry" : "no-veggies";
}

// IDs that should be hidden from the per-line "ללא X" list when a shortcut applies.
// Only IDs that the customer actually selected get returned — we never want to
// print/show "ללא חמוצים" if the only reason it's in the effective set is that
// pickles are out of stock today.
export function shortcutConsumedIds(s: RemovalShortcut): Set<string> {
  if (s === "dry") return new Set<string>([...VEGGIE_IDS, AIOLI_ID]);
  if (s === "no-veggies") return new Set<string>(VEGGIE_IDS);
  return new Set<string>();
}

export const removalShortcutLabel = (s: RemovalShortcut): string | null =>
  s === "dry" ? "יבש" : s === "no-veggies" ? "ללא ירקות" : null;
