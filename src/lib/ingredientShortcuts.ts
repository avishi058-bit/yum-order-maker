// Customer-preferences shortcut for the kitchen receipt / kitchen view.
//
// Rules (regular burger — 4 veggies + aioli, defined by user):
//   Veggies = חסה, בצל, עגבנייה, חמוצים
//   Sauce   = איולי (separate, NOT a veggie)
//
// 0 changes                                  → nothing printed (default bun)
// 1 veggie removed only                      → render normally ("ללא בצל")
// aioli only removed                         → render normally ("ללא איולי")
// 2-3 veggies removed                        → "חסה, חמוצים בלבד" (list remaining
//                                              veggies). Aioli still rendered
//                                              separately if removed.
// 4 veggies removed, aioli kept              → "רק איולי"
// 4 veggies removed + aioli removed          → "יבש"
//
// An out-of-stock ingredient counts as removed (it isn't going on the burger).

import { getUnavailableIngredientIds } from "./ingredientAvailability";

const VEGGIE_IDS = ["lettuce", "onion", "tomato", "pickles"] as const;
const VEGGIE_ORDER: readonly string[] = ["lettuce", "tomato", "onion", "pickles"];
const VEGGIE_HE: Record<string, string> = {
  lettuce: "חסה",
  tomato: "עגבנייה",
  onion: "בצל",
  pickles: "חמוצים",
};

const REMOVAL_TO_INGREDIENT: Record<string, string> = {
  "no-lettuce": "lettuce",
  "no-onion": "onion",
  "no-tomato": "tomato",
  "no-pickles": "pickles",
  "no-aioli": "aioli",
};

const VEG_REMOVAL_IDS = new Set(["no-lettuce", "no-onion", "no-tomato", "no-pickles"]);
const AIOLI_REMOVAL_ID = "no-aioli";

export type RemovalShortcut = "dry" | "only-aioli" | "remaining" | null;

interface ShortcutInfo {
  kind: RemovalShortcut;
  // Label to print on the receipt (or null when none).
  label: string | null;
  // Removal IDs that the shortcut already covered — caller must skip them when
  // rendering the per-line "ללא X" list to avoid duplicates.
  consumed: Set<string>;
}

function effectiveRemovalSet(removalIds: string[]): Set<string> {
  const set = new Set(removalIds);
  const unavail = getUnavailableIngredientIds();
  for (const [removalId, ingId] of Object.entries(REMOVAL_TO_INGREDIENT)) {
    if (unavail.has(ingId)) set.add(removalId);
  }
  return set;
}

function computeShortcut(removalIds: string[]): ShortcutInfo {
  const set = effectiveRemovalSet(removalIds);
  const removedVeggies = [...VEG_REMOVAL_IDS].filter((id) => set.has(id));
  const aioliRemoved = set.has(AIOLI_REMOVAL_ID);
  const vegCount = removedVeggies.length;

  // All veggies + aioli removed → "יבש"
  if (vegCount === 4 && aioliRemoved) {
    return {
      kind: "dry",
      label: "יבש",
      consumed: new Set<string>([...VEG_REMOVAL_IDS, AIOLI_REMOVAL_ID]),
    };
  }

  // All veggies removed, aioli kept → "רק איולי"
  if (vegCount === 4) {
    return {
      kind: "only-aioli",
      label: "רק איולי",
      consumed: new Set<string>(VEG_REMOVAL_IDS),
    };
  }

  // 2-3 veggies removed → list remaining veggies (aioli handled independently)
  if (vegCount === 2 || vegCount === 3) {
    const removedVegIngredients = new Set(removedVeggies.map((r) => REMOVAL_TO_INGREDIENT[r]));
    const remainingNames = VEGGIE_ORDER
      .filter((id) => !removedVegIngredients.has(id))
      .map((id) => VEGGIE_HE[id]);
    return {
      kind: "remaining",
      label: `${remainingNames.join(", ")} בלבד`,
      consumed: new Set<string>(removedVeggies),
    };
  }

  // 0 or 1 veggie removed → no shortcut; standard "ללא X" rendering handles it.
  return { kind: null, label: null, consumed: new Set<string>() };
}

// ===== Public API (kept stable for existing callers) =====

export function getRemovalShortcut(removalIds: string[]): RemovalShortcut {
  return computeShortcut(removalIds).kind;
}

export function removalShortcutLabel(_s: RemovalShortcut, removalIds?: string[]): string | null {
  // When caller passes the original removals, recompute to get the dynamic
  // "X, Y בלבד" label. Otherwise return the static labels.
  if (removalIds) return computeShortcut(removalIds).label;
  if (_s === "dry") return "יבש";
  if (_s === "only-aioli") return "רק איולי";
  return null;
}

export function shortcutConsumedIds(_s: RemovalShortcut, removalIds?: string[]): Set<string> {
  if (removalIds) return computeShortcut(removalIds).consumed;
  if (_s === "dry") return new Set<string>([...VEG_REMOVAL_IDS, AIOLI_REMOVAL_ID]);
  if (_s === "only-aioli") return new Set<string>(VEG_REMOVAL_IDS);
  return new Set<string>();
}

// Richer accessor for callers that want the full result in one shot.
export function getShortcutInfo(removalIds: string[]): ShortcutInfo {
  return computeShortcut(removalIds);
}
