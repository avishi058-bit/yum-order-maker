// Shared shortcuts for summarising burger removals.
//
// - If the customer removed ALL 4 veggies AND the aioli  → "יבש"
// - If the customer removed ALL 4 veggies but kept aioli → "ללא ירקות"
//
// Returns null if no shortcut applies; the caller should render the
// individual removals as usual.

const VEGGIE_IDS = ["no-lettuce", "no-onion", "no-tomato", "no-pickles"] as const;
const AIOLI_ID = "no-aioli";

export type RemovalShortcut = "dry" | "no-veggies" | null;

export function getRemovalShortcut(removalIds: string[]): RemovalShortcut {
  const set = new Set(removalIds);
  const allVeggies = VEGGIE_IDS.every((id) => set.has(id));
  if (!allVeggies) return null;
  return set.has(AIOLI_ID) ? "dry" : "no-veggies";
}

// IDs that should be hidden from the per-line "ללא X" list when a shortcut applies.
export function shortcutConsumedIds(s: RemovalShortcut): Set<string> {
  if (s === "dry") return new Set<string>([...VEGGIE_IDS, AIOLI_ID]);
  if (s === "no-veggies") return new Set<string>(VEGGIE_IDS);
  return new Set<string>();
}

export const removalShortcutLabel = (s: RemovalShortcut): string | null =>
  s === "dry" ? "יבש" : s === "no-veggies" ? "ללא ירקות" : null;
