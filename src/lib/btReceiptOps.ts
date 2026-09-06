// Hybrid Bluetooth ESC/POS receipt builders.
//
// Builds a sequence of FastOps (text / hebrew-bitmap / sep / feed / cut) that
// the printer can stream very quickly:
// - ASCII / digits / dashes go as native ESC/POS text (tiny byte payload).
// - Hebrew lines are rasterised individually as narrow per-line bitmaps,
//   tightly cropped to the actual letters (no black backgrounds, no padding).
//
// This is ~10-30x faster than rendering the full HTML receipt with html2canvas
// and avoids the dense black areas that bog down thermal printers.

import type { FastOp } from "./bluetoothPrinter";
import { getUnavailableIngredientIds } from "@/lib/ingredientAvailability";
import {
  computeChefSummary,
  computeDrinkSummary,
  computeDonenessSummary,
  formatDonenessRows,
  extractOwnerName,
  sortByQueue,
  type ReceiptOrder,
  type ReceiptOrderItem,
  type RoundOrder,
} from "./kitchenReceipt";
import { ingredients } from "@/data/menu";
import {
  getRemovalShortcut,
  shortcutConsumedIds,
  removalShortcutLabel,
  type RemovalShortcut,
} from "./ingredientShortcuts";

// ---- Ingredient diff (matches the customizer view) ----
// Translates the opaque removalId / addId tokens stored on order items into
// human-readable Hebrew changes — exactly what the kitchen sees in the bun
// preview in the app: "ללא בצל", "להוסיף עגבנייה", or "ללא שינויים".
const ING_LOOKUP: Record<string, { label: string; kind: "remove" | "add" }> = (() => {
  const m: Record<string, { label: string; kind: "remove" | "add" }> = {};
  for (const ing of ingredients) {
    const clean = ing.name.replace(/🥬/g, "").trim();
    m[ing.removalId] = { label: clean, kind: "remove" };
    if (ing.addId) m[ing.addId] = { label: clean, kind: "add" };
  }
  return m;
})();

const FRIED_RX = /צ['׳]?יפס|בטטה|טבעות|טמפורה|מיקס\s*חברים/;
const DRINK_RX = /פחית|בקבוק|בירה|קולה|זירו|פאנטה|ספרייט|בלו|גולדסטאר|הייניקן|קורונה|מים|מוחיטו|אבטיח|ויינשטפאן|לאף|לאפ|גינס|הוגרדן|קאלסברג|קלסטברג|אנפילטר/;
function isCustomizableBurger(name: string): boolean {
  if (!name || name === "רטבים") return false;
  if (FRIED_RX.test(name) || DRINK_RX.test(name)) return false;
  return true;
}

function classifyIngredientChanges(removals: string[]): {
  removes: string[];
  adds: string[];
  others: string[];
  shortcut: RemovalShortcut;
} {
  const removes: string[] = [];
  const adds: string[] = [];
  const others: string[] = [];
  const shortcut: RemovalShortcut = getRemovalShortcut(removals);
  const skip = shortcutConsumedIds(shortcut, removals);
  for (const r of removals) {
    if (skip.has(r)) continue;
    const m = ING_LOOKUP[r];
    if (m) (m.kind === "remove" ? removes : adds).push(m.label);
    else others.push(r);
  }
  return { removes, adds, others, shortcut };
}

// ===== Veggie summary model (Habakta) =====
// Concise kitchen-facing summary of what veggies/aioli end up on the bun.
const VEGGIE_HEBREW: Record<string, string> = {
  lettuce: "חסה",
  tomato: "עגבנייה",
  onion: "בצל",
  pickles: "חמוצים",
  aioli: "איולי",
};
const VEG_ORDER = ["lettuce", "tomato", "onion", "pickles", "aioli"] as const;
const REM_TO_VEG: Record<string, string> = {
  "no-lettuce": "lettuce",
  "no-tomato": "tomato",
  "no-onion": "onion",
  "no-pickles": "pickles",
  "no-aioli": "aioli",
};
const ADD_TO_VEG: Record<string, string> = {
  "add-tomato": "tomato",
  "add-onion": "onion",
};

const HEBREW_REMOVE_TO_VEG: Record<string, string> = {
  "ללא חסה": "lettuce",
  "ללא עגבנייה": "tomato",
  "ללא בצל": "onion",
  "ללא חמוצים": "pickles",
  "ללא איולי": "aioli",
  "ללא אאיולי": "aioli",
};

const HEBREW_ADD_TO_VEG: Record<string, string> = {
  "להוסיף עגבנייה": "tomato",
  "להוסיף בצל": "onion",
};

function isSmashBurger(name: string): boolean {
  return /סמאש|קרייזי/.test(name || "");
}

// Crispy chicken never comes with tomato.
function isChickenBurger(name: string): boolean {
  return /קריספי/.test(name || "");
}

// Ingredients that are out of stock are simply not on the bun — they must
// never be printed as remaining, nor as "ללא X".
function soldOutVeg(): Set<string> {
  const out = new Set<string>();
  for (const id of getUnavailableIngredientIds()) {
    if (VEGGIE_HEBREW[id]) out.add(id);
  }
  return out;
}

function defaultsForBurger(name: string): Set<string> {
  const base = isSmashBurger(name)
    ? new Set(["lettuce", "pickles", "aioli"])
    : isChickenBurger(name)
    ? new Set(["lettuce", "onion", "pickles", "aioli"])
    : new Set(["lettuce", "tomato", "onion", "pickles", "aioli"]);
  for (const id of soldOutVeg()) base.delete(id);
  return base;
}

function buildVeggieSummary(
  name: string,
  removalsRaw: string[],
): { veg: string; others: string[] } {
  const def = defaultsForBurger(name);
  const final = new Set(def);
  const soldOut = soldOutVeg();
  const others: string[] = [];
  for (const r of removalsRaw) {
    const normalized = String(r || "").trim();
    const removeVeg = REM_TO_VEG[normalized] || HEBREW_REMOVE_TO_VEG[normalized];
    const addVeg = ADD_TO_VEG[normalized] || HEBREW_ADD_TO_VEG[normalized];
    if (removeVeg) {
      // Ignore removals of ingredients that are out of stock anyway.
      if (soldOut.has(removeVeg)) continue;
      final.delete(removeVeg);
    } else if (addVeg) {
      if (soldOut.has(addVeg)) continue;
      final.add(addVeg);
    } else {
      const m = ING_LOOKUP[normalized];
      if (m) others.push(m.kind === "remove" ? `ללא ${m.label}` : `להוסיף ${m.label}`);
      else others.push(normalized);
    }
  }
  const finalArr = VEG_ORDER.filter((id) => final.has(id));
  const defArr = VEG_ORDER.filter((id) => def.has(id));

  // ===== Regular burger (4 veggies + aioli) — new spec =====
  // Only applies when there are no add-ons that changed the default set
  // (e.g. add-tomato on a smash) — and only for non-smash burgers.
  if (!isSmashBurger(name)) {
    const chicken = isChickenBurger(name);
    const VEG4 = ((chicken
      ? ["lettuce", "onion", "pickles"]
      : ["lettuce", "tomato", "onion", "pickles"]) as readonly string[]).filter(
      (id) => !soldOut.has(id),
    );
    const removedVeg = VEG4.filter((id) => !final.has(id));
    const addedVeg = (chicken ? (["onion"] as const) : (["tomato", "onion"] as const)).filter(
      (id) => final.has(id) && !def.has(id),
    ) as readonly string[];
    const aioliRemoved = def.has("aioli") && !final.has("aioli");
    const aioliKept = final.has("aioli");
    const vegCount = removedVeg.length;

    // No customer-driven veg/aioli changes (and no add-ons) → default bun
    if (vegCount === 0 && !aioliRemoved && addedVeg.length === 0) {
      if (others.length === 0) return { veg: "ללא שינויים", others };
      return { veg: "כל הירקות + איולי", others };
    }

    // Added veg (no removals) → "להוסיף X"
    if (vegCount === 0 && addedVeg.length === 1 && !aioliRemoved) {
      return { veg: `להוסיף ${VEGGIE_HEBREW[addedVeg[0]]}`, others };
    }

    // All veggies + aioli removed → "יבש"
    if (vegCount === VEG4.length && aioliRemoved) return { veg: "יבש", others };

    // All veggies removed, aioli kept → "רק איולי"
    if (vegCount === VEG4.length && aioliKept) return { veg: "רק איולי", others };

    // 1 veggie removed only, aioli kept → "ללא X"
    if (vegCount === 1 && !aioliRemoved && addedVeg.length === 0) {
      return { veg: `ללא ${VEGGIE_HEBREW[removedVeg[0]]}`, others };
    }

    // Aioli only removed → "ללא איולי"
    if (vegCount === 0 && aioliRemoved && addedVeg.length === 0) {
      return { veg: "ללא איולי", others };
    }

    // 2+ removals total → list what stays on the bun, not multiple "ללא" lines.
    if (vegCount + (aioliRemoved ? 1 : 0) >= 2 && addedVeg.length === 0) {
      const remaining = VEG_ORDER.filter((id) => final.has(id)).map((id) => VEGGIE_HEBREW[id]);
      if (remaining.length === 0) return { veg: "יבש", others };
      if (remaining.length === 1) return { veg: `רק ${remaining[0]}`, others };
      return { veg: remaining.join(" "), others };
    }

    // Fallback for unusual combinations (e.g. mixed add+remove) — list final state
    return {
      veg: finalArr.length === 0 ? "בלי כלום" : finalArr.map((id) => VEGGIE_HEBREW[id]).join(" "),
      others,
    };
  }

  // ===== Smash burger — new spec =====
  // Default = lettuce + pickles + aioli. Optional adds: tomato, onion.
  const SMASH_DEF = (["lettuce", "pickles", "aioli"] as readonly string[]).filter(
    (id) => !soldOut.has(id),
  );
  const removedSmash = SMASH_DEF.filter((id) => !final.has(id));
  const addedSmash = (["tomato", "onion"] as const).filter((id) => final.has(id));
  const aioliRemovedS = !final.has("aioli");
  const removeCount = removedSmash.length;

  // No customer changes
  if (removeCount === 0 && addedSmash.length === 0) {
    if (others.length === 0) return { veg: "ללא שינויים", others };
    return { veg: SMASH_DEF.map((id) => VEGGIE_HEBREW[id]).join(", "), others };
  }

  // All 3 removed → "יבש"
  if (removeCount === SMASH_DEF.length) return { veg: "יבש", others };

  // Added both tomato + onion (no removals) → "כל הירקות + איולי"
  if (addedSmash.length === 2 && removeCount === 0) {
    return { veg: "כל הירקות + איולי", others };
  }

  // Added one of tomato/onion (no removals) → "להוסיף X"
  if (addedSmash.length === 1 && removeCount === 0) {
    return { veg: `להוסיף ${VEGGIE_HEBREW[addedSmash[0]]}`, others };
  }

  // lettuce+pickles removed, aioli kept, no adds → "רק איולי"
  if (
    removeCount === 2 &&
    !aioliRemovedS &&
    removedSmash.includes("lettuce") &&
    removedSmash.includes("pickles") &&
    addedSmash.length === 0
  ) {
    return { veg: "רק איולי", others };
  }

  // 1-2 removed (no adds) → list what remains on the bun
  if (addedSmash.length === 0 && removeCount >= 1) {
    const remaining = (["lettuce", "tomato", "onion", "pickles", "aioli"] as const)
      .filter((id) => final.has(id))
      .map((id) => VEGGIE_HEBREW[id]);
    if (remaining.length === 0) return { veg: "יבש", others };
    if (remaining.length === 1) return { veg: `רק ${remaining[0]}`, others };
    return { veg: remaining.join(", "), others };
  }

  // Fallback for mixed add+remove
  return {
    veg: finalArr.length === 0 ? "יבש" : finalArr.map((id) => VEGGIE_HEBREW[id]).join(", "),
    others,
  };
}



const HEB = /[\u0590-\u05FF]/;
const NON_ASCII = /[^\x20-\x7E]/;

// Decide whether a line must be rendered as a bitmap (Hebrew or any non-ASCII
// like ₪ / × / dashes / emoji) or can ride the fast ESC/POS text rail.
function asLine(
  text: string,
  o: { align?: "L" | "C" | "R"; bold?: boolean; size?: number } = {},
): FastOp {
  if (HEB.test(text) || NON_ASCII.test(text)) {
    return { kind: "heb", text, align: o.align ?? "R", bold: !!o.bold, size: o.size ?? 22 };
  }
  return { kind: "text", text, align: o.align ?? "L", bold: !!o.bold, size: 1 };
}


function sep(): FastOp {
  return { kind: "sep" };
}

function feed(n = 1): FastOp {
  return { kind: "feed", n };
}

const orderTypeLabel = (order: ReceiptOrder): string => {
  if (order.dine_in === true) return "לשבת";
  if (order.dine_in === false) return "איסוף";
  return order.order_source === "kiosk" || order.order_source === "station" ? "לשבת" : "איסוף";
};

// Normalize legacy stored topping names so old orders print the new labels too.
function normalizeToppingName(s: string): string {
  if (!s) return s;
  let out = s;
  out = out.replace(/ריבת פלפלים חריפים/g, "ריבת פלפלים");
  out = out.replace(/זוג קציצות סמאש 110 גרם כל אחת/g, "+ קציצת סמאש");
  out = out.replace(/אקסטרה קציצה \(220 גרם\)/g, "תוספת קציצה");
  return out;
}

// Format a topping line with a big "+" prefix (skip if the name already starts with +).
function toppingLine(s: string): string {
  const n = normalizeToppingName(s).trim();
  return n.startsWith("+") ? n : `+ ${n}`;
}

const PATTY_RX = /קציצה/;
function isPattyTopping(s: string): boolean {
  return PATTY_RX.test(s);
}

function printableToppings(toppings: string[] | null | undefined): string[] {
  return (toppings || []).filter((t) => String(t || "").trim() !== "כל הירקות + איולי");
}

// A thin dashed separator line between dishes.
function dashSep(): FastOp {
  return { kind: "text", text: "- - - - - - - - - - - - - - - -", align: "C", size: 1 };
}

// Map doneness label like "M — מדיום" / "MW — מדיום וואל" to short "M"/"MW"/"WD".
function shortDoneness(label: string | null): string | null {
  if (!label) return null;
  const m = label.match(/\b(MW|WD|M)\b/);
  return m ? m[1] : label;
}

// Normalize drink name from meal/standalone "פחית — קולה" → "קולה"
function cleanDrinkName(s: string): string {
  return s.replace(/^.*?[—\-–]\s*/, "").trim();
}

// ============================================================
// SINGLE KITCHEN BON
// ============================================================
export function buildKitchenBonOps(order: ReceiptOrder): FastOp[] {
  const ops: FastOp[] = [];

  // 1) TOP: customer name (big bold) + phone next to it (large, thin), centered.
  if (order.customer_name || order.customer_phone) {
    ops.push({
      kind: "header",
      name: order.customer_name || "",
      phone: order.customer_phone || undefined,
      namePx: 48,
      phonePx: 44,
    });
  }

  // Daily running number, printed right under the name, extra big & bold, so
  // the kitchen can order bons by arrival. Assigned at order creation and
  // restarts from 1 every business day — unrelated to the order number.
  const bonNum = (order as any).bon_queue_number ?? order.queue_number ?? null;
  if (bonNum != null) {
    ops.push(asLine(`מס׳ ${bonNum}`, { align: "C", bold: true, size: 64 }));
  }
  // (QR טלפון מודפס כבון נפרד דרך כפתור נפרד — לא כאן.)
  ops.push(sep());

  // 2) Order type (small) + optional note
  ops.push(asLine(orderTypeLabel(order), { align: "C", bold: true, size: 34 }));
  if (order.notes) {
    ops.push(asLine(`הערה: ${order.notes}`, { align: "R", bold: true, size: 26 }));
  }
  ops.push(feed(1));

  const realItems = order.order_items.filter((it) => it.item_name !== "רטבים");

  // Identical dishes are intentionally NOT merged — each cart line prints on
  // its own, per kitchen request.
  const groups: Array<{ item: ReceiptOrderItem; qty: number }> = realItems.map((it) => ({
    item: it,
    qty: it.quantity,
  }));

  const isMultiItem = groups.length > 1 || (groups.length === 1 && groups[0].qty > 1);
  const LINE_GAP = 2.0; // breathing room between lines within an item

  // Pre-compute drinks summary so we can avoid duplicating standalone drinks
  // both as a "dish" and in the bottom summary (takeaway only).
  const isTakeawayPre =
    order.dine_in === false ||
    (order.dine_in === null && order.order_source !== "kiosk" && order.order_source !== "station");
  const drinksSummaryEntries: Array<[string, number]> = [];
  if (isMultiItem && isTakeawayPre) {
    const drinks = computeDrinkSummary(order.order_items).drinks;
    for (const [name, qty] of drinks.entries()) if (qty > 0) drinksSummaryEntries.push([name, qty]);
  }
  const hasDrinksSummary = drinksSummaryEntries.length > 0;
  const isStandaloneDrinkItem = (it: ReceiptOrderItem) =>
    DRINK_RX.test(it.item_name) && !it.with_meal && !Array.isArray(it.deal_burgers);
  const printedGroups = hasDrinksSummary
    ? groups.filter((g) => !isStandaloneDrinkItem(g.item))
    : groups;

  // Running dish number — printed on every main dish (burgers/mains) so the
  // kitchen can write the same number on the wrapped dish. Fries/sides and
  // drinks are intentionally NOT numbered.
  let dishNo = 0;

  // 3) Items
  printedGroups.forEach((g, gi) => {
    const it = g.item;
    const totalQty = g.qty;
    const { ownerName, doneness, cleanedRemovals } = extractOwnerName(it.removals, it.item_name);
    const donShort = shortDoneness(doneness);
    const isDealItem = Array.isArray(it.deal_burgers) && it.deal_burgers.length > 0;
    const numberable = !isDealItem && isCustomizableBurger(it.item_name);
    let numPrefix = "";
    if (numberable) {
      const start = dishNo + 1;
      dishNo += totalQty;
      numPrefix = totalQty > 1 ? `${start}-${dishNo}. ` : `${start}. `;
    }

    if (ownerName) {
      ops.push(asLine(`* ${ownerName}`, { align: "R", bold: true, size: 24 }));
      ops.push(feed(LINE_GAP));
    }

    // Item name (big, bold) — qty only when >1, doneness inline at end
    // If it's a meal (upgraded or originally a meal), prefix with "ארוחת"
    const qtyStr = totalQty > 1 ? ` x${totalQty}` : "";
    const donSuffix = donShort ? ` ${donShort}` : "";
    const displayName = it.with_meal && !it.item_name.startsWith("ארוחת")
      ? `ארוחת ${it.item_name}`
      : it.item_name;
    ops.push(asLine(`${numPrefix}${displayName}${qtyStr}${donSuffix}`, { align: "R", bold: true, size: 34 }));
    ops.push(feed(LINE_GAP));


    // Changes
    const isDeal = Array.isArray(it.deal_burgers) && it.deal_burgers.length > 0;
    if (!isDeal && isCustomizableBurger(it.item_name)) {
      const { veg, others } = buildVeggieSummary(it.item_name, cleanedRemovals);
      ops.push(asLine(veg, { align: "R", bold: true, size: 28 }));
      ops.push(feed(LINE_GAP));
      for (const o of others) {
        ops.push(asLine(o, { align: "R", bold: true, size: 26 }));
        ops.push(feed(LINE_GAP));
      }
    } else if (cleanedRemovals.length > 0) {
      ops.push(asLine(`- ${cleanedRemovals.join(", ")}`, { align: "R", bold: true, size: 26 }));
      ops.push(feed(LINE_GAP));
    }


    // Toppings — printed right after the burger preferences/changes, before
    // the meal side / drinks / deal extras.
    const toppingsToPrint = printableToppings(it.toppings);
    if (toppingsToPrint.length > 0) {
      for (const t of toppingsToPrint) {
        const line = toppingLine(t);
        if (isPattyTopping(t)) {
          ops.push(asLine(line, { align: "R", bold: true, size: 38 }));
          ops.push(feed(LINE_GAP));
          ops.push(asLine("- - - - - - - - - - - - -", { align: "C", bold: false, size: 22 }));
        } else {
          ops.push(asLine(line, { align: "R", bold: true, size: 32 }));
        }
        ops.push(feed(LINE_GAP));
      }
    }

    // Spacing before meal / drink line
    ops.push(feed(0.6));

    // Per-item drinks (meal drink / deal drinks)
    if (it.with_meal) {
      const parts: string[] = [];
      if (it.meal_side) parts.push(it.meal_side);
      if (it.meal_drink) parts.push(cleanDrinkName(it.meal_drink));
      if (parts.length > 0) {
        ops.push(asLine(parts.join(", "), { align: "R", bold: true, size: 28 }));
        ops.push(feed(LINE_GAP));
      }
    }
    if (Array.isArray(it.deal_burgers)) {
      ops.push(feed(1.2));
      it.deal_burgers.forEach((b: { name?: string; removals?: string[] }, i: number) => {
        if (i > 0) {
          ops.push(feed(1.0));
          ops.push(asLine("- - - - - - - - - - - - - -", { align: "C", bold: false, size: 22 }));
          ops.push(feed(1.0));
        }
        dishNo += 1;
        ops.push(asLine(`${dishNo}. מנה ${i + 1}: ${b.name || ""}`.trim(), { align: "R", bold: true, size: 28 }));

        ops.push(feed(LINE_GAP));
        const bRem = b.removals || [];
        // Deal burgers are always classic burgers; b.name is the optional
        // owner-name label, so we pass the real burger type to the summary.
        const { veg, others } = buildVeggieSummary(
          "קלאסי",
          extractOwnerName(bRem).cleanedRemovals,
        );
        ops.push(asLine(veg, { align: "R", bold: true, size: 26 }));
        ops.push(feed(LINE_GAP));
        for (const o of others) {
          ops.push(asLine(o, { align: "R", bold: true, size: 24 }));
          ops.push(feed(LINE_GAP));
        }
        const bTops = (b as any).toppings;
        if (Array.isArray(bTops) && bTops.length > 0) {
          for (const t of bTops) {
            const n = normalizeToppingName(t).trim();
            const line = n.startsWith("+") ? n : `+ ${n}`;
            if (isPattyTopping(t)) {
              ops.push(asLine(line, { align: "R", bold: true, size: 30 }));
              ops.push(feed(LINE_GAP));
              ops.push(asLine("- - - - - - - - - - - - -", { align: "C", bold: false, size: 22 }));
            } else {
              ops.push(asLine(line, { align: "R", bold: true, size: 24 }));
            }
            ops.push(feed(LINE_GAP));
          }
        }


      });
      ops.push(feed(1.0));
      ops.push(asLine("- - - - - - - - - - - - - -", { align: "C", bold: false, size: 22 }));
      ops.push(feed(1.0));
      ops.push(asLine(`צ'יפס ענק`, { align: "R", bold: true, size: 28 }));
      ops.push(feed(LINE_GAP));
    }
    if (Array.isArray(it.deal_drinks)) {
      it.deal_drinks.forEach((d: { name?: string }) => {
        if (d.name) { ops.push(asLine(cleanDrinkName(d.name), { align: "R", bold: true, size: 26 })); ops.push(feed(LINE_GAP)); }
      });
    }


    // Dashed separator between distinct dishes (skip after last)
    if (gi < printedGroups.length - 1) {
      ops.push(feed(0.6));
      ops.push(dashSep());
      ops.push(feed(0.6));
    }
  });

  // 4) Order-level sauces (synthetic "רטבים" line) — always at bottom, no title
  const sauceItem = order.order_items.find((it) => it.item_name === "רטבים");
  if (sauceItem && sauceItem.toppings && sauceItem.toppings.length > 0) {
    ops.push(sep());
    for (const t of sauceItem.toppings) {
      ops.push(asLine(toppingLine(t), { align: "R", bold: true, size: 32 }));
      ops.push(feed(LINE_GAP));
    }
  }

  // 5) Multi-item takeaway: aggregated order summary (drinks + sides) under one title
  const isTakeaway =
    order.dine_in === false ||
    (order.dine_in === null && order.order_source !== "kiosk" && order.order_source !== "station");
  if (isMultiItem && isTakeaway) {
    const detectFriedKind = (name: string): string | null => {
      if (!name) return null;
      if (/מיקס\s*חברים/.test(name)) return "מיקס חברים";
      if (/טבעות.*טמפורה|טמפורה/.test(name)) return "טבעות בצל בטמפורה";
      if (/וופל|בטטה/.test(name)) return "וופל צ'יפס";
      if (/טבעות\s*בצל/.test(name)) return "טבעות בצל";
      if (/צ['׳]?יפס\s*ענק/.test(name)) return "צ'יפס ענק";
      if (/צ['׳]?יפס/.test(name)) return "צ'יפס רגיל";
      return null;
    };
    const sidesMap = new Map<string, number>();
    const addSide = (label: string | null, qty: number) => {
      if (!label) return;
      sidesMap.set(label, (sidesMap.get(label) || 0) + qty);
    };
    for (const it of order.order_items) {
      if (it.item_name === "רטבים") continue;
      const qty = it.quantity || 1;
      if (Array.isArray(it.deal_burgers) && it.deal_burgers.length > 0) {
        addSide("צ'יפס ענק", qty);
        continue;
      }
      const standalone = detectFriedKind(it.item_name);
      if (standalone) {
        addSide(standalone, qty);
        continue;
      }
      if (it.with_meal && it.meal_side) {
        addSide(detectFriedKind(it.meal_side) || it.meal_side, qty);
      }
    }
    const sidesEntries = Array.from(sidesMap.entries()).filter(([, n]) => n > 0);
    const hasAny = hasDrinksSummary || sidesEntries.length > 0;
    if (hasAny) {
      ops.push(sep());
      ops.push(asLine("סיכום הזמנה", { align: "C", bold: true, size: 30 }));
      ops.push(feed(LINE_GAP));
      for (const [label, n] of sidesEntries) {
        const line = n > 1 ? `${label} x${n}` : label;
        ops.push(asLine(line, { align: "R", bold: true, size: 26 }));
        ops.push(feed(LINE_GAP));
      }
      for (const [label, n] of drinksSummaryEntries) {
        const line = n > 1 ? `${label} x${n}` : label;
        ops.push(asLine(line, { align: "R", bold: true, size: 26 }));
        ops.push(feed(LINE_GAP));
      }
    }
  }



  // 6) Payment block — only when relevant
  if (order.payment_method === "counter") {
    ops.push(sep());
    ops.push(asLine("לתשלום בקופה", { align: "C", bold: true, size: 30 }));
    ops.push(asLine(`לתשלום ${order.total}₪`, { align: "C", bold: true, size: 34 }));
  } else if (order.payment_method === "cash") {
    ops.push(sep());
    ops.push(asLine("!! לא שולם - מזומן בעת המסירה !!", { align: "C", bold: true, size: 26 }));
    ops.push(asLine(`לתשלום ${order.total}₪`, { align: "C", bold: true, size: 32 }));
  }

  ops.push(feed(2));
  ops.push({ kind: "cut" });
  return ops;
}

// ============================================================
// ROUND SUMMARY (per-order detail, compact)
// ============================================================
export function buildRoundSummaryOps(orders: RoundOrder[]): FastOp[] {
  const ops: FastOp[] = [];
  const time = new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  ops.push(asLine(`הזמנות פעילות ${time}`, { align: "C", bold: true, size: 36 }));
  ops.push(sep());

  const sorted = sortByQueue(orders);

  for (const o of sorted) {
    const qNum = (o as any).bon_queue_number ?? o.queue_number;
    if (qNum) {
      ops.push(asLine(`${qNum}`, { align: "R", bold: true, size: 0 }));
    }
    ops.push({ kind: "text", text: `#${o.order_number}`, align: "R", size: 1 });
    if (o.customer_name) {
      ops.push(asLine(o.customer_name, { align: "R", bold: true, size: 34 }));
    }
    for (const it of o.order_items || []) {
      if (it.item_name === "רטבים") continue;
      const { ownerName, doneness, cleanedRemovals } = extractOwnerName(it.removals, it.item_name);
      const donShort = shortDoneness(doneness);
      if (ownerName) ops.push(asLine(`* ${ownerName}`, { align: "R", bold: true, size: 28 }));
      const qty = it.quantity > 1 ? ` x${it.quantity}` : "";
      const donSuffix = donShort ? ` ${donShort}` : "";
      const displayName = it.with_meal && !it.item_name.startsWith("ארוחת")
        ? `ארוחת ${it.item_name}`
        : it.item_name;
      ops.push(asLine(`${displayName}${qty}${donSuffix}`, { align: "R", bold: true, size: 34 }));
      if (cleanedRemovals.length > 0) {
        ops.push(asLine(`- ${cleanedRemovals.join(", ")}`, { align: "R", bold: true, size: 28 }));
      }
      if (it.toppings && it.toppings.length > 0) {
        for (const t of it.toppings) {
          ops.push(asLine(toppingLine(t), { align: "R", bold: true, size: 28 }));
        }
      }
      if (it.with_meal) {
        const parts: string[] = [];
        if (it.meal_side) parts.push(it.meal_side);
        if (it.meal_drink) parts.push(cleanDrinkName(it.meal_drink));
        if (parts.length > 0) {
          ops.push(asLine(parts.join(", "), { align: "R", bold: true, size: 28 }));
        }
      }
    }
    ops.push(sep());
  }

  // Total chef summary at the bottom
  const all: ReceiptOrderItem[] = orders.flatMap((o) => o.order_items || []);
  ops.push(...buildChefSummaryOps(all, "סיכום לטבח - סה\"כ"));

  ops.push(feed(2));
  ops.push({ kind: "cut" });
  return ops;
}

// ============================================================
// ROUND CHEF SUMMARY (aggregated only)
// ============================================================
export function buildRoundChefOps(orders: RoundOrder[]): FastOp[] {
  const ops: FastOp[] = [];
  const time = new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  ops.push(asLine(`סיכום סבב ${time}`, { align: "C", bold: true, size: 36 }));
  ops.push(sep());

  const all: ReceiptOrderItem[] = orders.flatMap((o) => o.order_items || []);
  ops.push(...buildChefSummaryOps(all, "סה\"כ מנות להכנה"));

  // Doneness aggregation
  const donenessRows = formatDonenessRows(computeDonenessSummary(all));
  if (donenessRows.length > 0) {
    ops.push(sep());
    ops.push(asLine("== מידות עשייה ==", { align: "C", bold: true, size: 32 }));
    for (const r of donenessRows) {
      ops.push(asLine(`${r.label}: ${r.n}`, { align: "R", bold: true, size: 34 }));
    }
  }

  ops.push(feed(2));
  ops.push({ kind: "cut" });
  return ops;
}

function buildChefSummaryOps(items: ReceiptOrderItem[], title: string): FastOp[] {
  const out: FastOp[] = [];
  const s = computeChefSummary(items);
  const rows: Array<[string, number]> = [];
  if (s.regularPatties > 0) rows.push(["קציצה רגיל", s.regularPatties]);
  if (s.smashPatties > 0) rows.push(["קציצה סמאש", s.smashPatties]);
  if (s.veganPatties > 0) rows.push(["קציצה טבעוני", s.veganPatties]);
  if (s.chickenFillets > 0) rows.push(["חתיכות קריספי צ׳יקן", s.chickenFillets]);
  if (s.regularBuns > 0) rows.push(["לחמנייה רגילה", s.regularBuns]);
  if (s.glutenFreeBuns > 0) rows.push(["לחמנייה ל\"ג", s.glutenFreeBuns]);
  if (s.fries > 0) rows.push(["צ'יפס", s.fries]);
  if (s.sweetPotatoFries > 0) rows.push(["וופל צ'יפס", s.sweetPotatoFries]);
  if (s.onionRings > 0) rows.push(["טבעות בצל", s.onionRings]);
  if (s.tempuraOnionSide > 0) rows.push(["טמפורה מנה", s.tempuraOnionSide]);
  if (s.tempuraOnionTopping > 0) rows.push(["טמפורה יחידה", s.tempuraOnionTopping]);
  if (s.friendsMix > 0) rows.push(["מיקס חברים", s.friendsMix]);
  if (s.eggs > 0) rows.push(["ביצי עין", s.eggs]);
  if (s.roastbeef > 0) rows.push(["רוסטביף", s.roastbeef]);

  // Cheese counts get their own section, same style as doneness
  const cheeseRows: Array<[string, number]> = [];
  if (s.smashDoubleCheesePatties > 0) cheeseRows.push(["דאבל צ'יז", s.smashDoubleCheesePatties]);
  for (const [pattyLabel, n] of s.cheddarByPatty)
    if (n > 0) cheeseRows.push([`${pattyLabel} עם צ'דר`, n]);
  if (s.blueCheese > 0) cheeseRows.push(["גבינה כחולה", s.blueCheese]);

  if (rows.length === 0 && cheeseRows.length === 0) return out;
  if (cheeseRows.length > 0) {
    out.push(asLine(`== ${title} ==`, { align: "C", bold: true, size: 32 }));
    for (const [label, n] of rows) {
      out.push(asLine(`${label}: ${n}`, { align: "R", bold: true, size: 34 }));
    }
    out.push(asLine("== גבינות ==", { align: "C", bold: true, size: 32 }));
    for (const [label, n] of cheeseRows) {
      out.push(asLine(`${label}: ${n}`, { align: "R", bold: true, size: 34 }));
    }
    return out;
  }

  out.push(asLine(`== ${title} ==`, { align: "C", bold: true, size: 32 }));
  for (const [label, n] of rows) {
    out.push(asLine(`${label}: ${n}`, { align: "R", bold: true, size: 34 }));
  }
  return out;
}

// ============================================================
// TEST PRINT
// ============================================================
export function buildTestOps(): FastOp[] {
  return [
    asLine("הבקתה", { align: "C", bold: true, size: 32 }),
    sep(),
    asLine("שלום מהבקתה", { align: "R", bold: true, size: 26 }),
    asLine("בדיקת עברית 123", { align: "R", size: 22 }),
    sep(),
    { kind: "text", text: new Date().toLocaleString("en-GB"), align: "C", size: 1 },
    feed(2),
    { kind: "cut" },
  ];
}

// ============================================================
// PHONE QR — standalone bon
// ============================================================
export function buildPhoneQrOps(order: ReceiptOrder): FastOp[] {
  const phone = (order.customer_phone || "").trim();
  const telDigits = phone.replace(/[^\d+]/g, "");
  const ops: FastOp[] = [];
  if (order.customer_name || phone) {
    ops.push({
      kind: "header",
      name: order.customer_name || "",
      phone: phone || undefined,
      namePx: 44,
      phonePx: 32,
    });
  }
  if (telDigits) {
    ops.push(feed(0.6));
    ops.push({ kind: "qr", data: `tel:${telDigits}`, modulePx: 6, align: "C" });
    ops.push(feed(0.6));
  }
  if ((order as any).order_number) {
    ops.push(asLine(`הזמנה #${(order as any).order_number}`, { align: "C", bold: true, size: 26 }));
  }
  ops.push(feed(2));
  ops.push({ kind: "cut" });
  return ops;
}

// ============================================================
// FRIDGE REFILL BON
// ============================================================
export interface FridgeRefillLine {
  name: string;
  needed: number;
}

export function buildFridgeRefillOps(items: FridgeRefillLine[]): FastOp[] {
  const ops: FastOp[] = [];
  const time = new Date().toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  ops.push(asLine("מילוי מקרר", { align: "C", bold: true, size: 54 }));
  ops.push(asLine(time, { align: "C", bold: false, size: 33 }));
  ops.push(sep());

  const refill = items.filter((i) => i.needed > 0);
  if (refill.length === 0) {
    ops.push(asLine("המקרר מלא", { align: "C", bold: true, size: 45 }));
  } else {
    for (const r of refill) {
      ops.push(asLine(`${r.needed} x ${r.name}`, { align: "R", bold: true, size: 51 }));
      ops.push(feed(2));
    }
  }

  ops.push(feed(2));
  ops.push({ kind: "cut" });
  return ops;
}

// ============================================================
// EVENT PREP BON (kitchen prep for a signed event booking)
// ============================================================
export interface EventPrepBookingLike {
  customer_name: string;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  event_type?: string | null;
  event_address?: string | null;
  at_venue?: boolean | null;
  package_name: string;
  kitchen_notes?: string | null;
}

export interface EventPrepResultLike {
  guests: number;
  regularPatties: number;
  vegPatties: number;
  veganPatties: number;
  regularBuns: number;
  gfBuns: number;
  tomatoKg: number;
  onionKg: number;
  lettuceKg: number;
  picklesKg: number;
  chipsKg: number;
  potatoesKg: number;
  onionRingsKg: number;
  waffleKg: number;
  eggs: number;
  onionJam: number;
  friedOnion: number;
  chili: number;
  desserts: number;
  tier: "classic" | "upgraded" | "premium" | "meat" | "other";
}

const kgStr = (v: number) => `${v.toFixed(2)} ק"ג`;

export function buildEventPrepOps(
  b: EventPrepBookingLike,
  r: EventPrepResultLike,
): FastOp[] {
  const ops: FastOp[] = [];

  const dt = new Date(b.event_date + "T00:00:00");
  const dateStr = dt.toLocaleDateString("he-IL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const timeStr = [b.start_time, b.end_time].filter(Boolean).join(" - ");
  const place = b.at_venue ? "אצלנו במקום" : (b.event_address || "");

  ops.push(asLine("בון הכנות אירוע", { align: "C", bold: true, size: 54 }));
  ops.push(asLine(b.customer_name, { align: "C", bold: true, size: 42 }));
  ops.push(asLine(dateStr, { align: "C", size: 30 }));
  if (timeStr) ops.push(asLine(timeStr, { align: "C", size: 30 }));
  if (b.event_type) ops.push(asLine(b.event_type, { align: "C", size: 30 }));
  if (place) ops.push(asLine(place, { align: "C", size: 30 }));
  ops.push(asLine(`${b.package_name} · ${r.guests} סועדים`, { align: "C", bold: true, size: 33 }));
  ops.push(sep());

  ops.push(asLine("קציצות ולחמניות", { align: "C", bold: true, size: 36 }));
  ops.push(asLine(`קציצה רגילה: ${r.regularPatties}`, { align: "R", bold: true, size: 42 }));
  if (r.vegPatties > 0) ops.push(asLine(`קציצה צמחונית: ${r.vegPatties}`, { align: "R", bold: true, size: 42 }));
  if (r.veganPatties > 0) ops.push(asLine(`קציצה טבעונית: ${r.veganPatties}`, { align: "R", bold: true, size: 42 }));
  ops.push(asLine(`לחמניות: ${r.regularBuns}`, { align: "R", bold: true, size: 42 }));
  if (r.gfBuns > 0) ops.push(asLine(`ללא גלוטן: ${r.gfBuns}`, { align: "R", bold: true, size: 42 }));
  ops.push(sep());

  ops.push(asLine("ירקות", { align: "C", bold: true, size: 36 }));
  ops.push(asLine(`עגבנייה: ${kgStr(r.tomatoKg)}`, { align: "R", bold: true, size: 39 }));
  ops.push(asLine(`בצל: ${kgStr(r.onionKg)}`, { align: "R", bold: true, size: 39 }));
  ops.push(asLine(`חסה: ${kgStr(r.lettuceKg)}`, { align: "R", bold: true, size: 39 }));
  ops.push(asLine(`חמוצים: ${kgStr(r.picklesKg)}`, { align: "R", bold: true, size: 39 }));
  ops.push(sep());

  ops.push(asLine("מטוגנים", { align: "C", bold: true, size: 36 }));
  if (r.chipsKg > 0) ops.push(asLine(`צ'יפס: ${kgStr(r.chipsKg)}`, { align: "R", bold: true, size: 42 }));
  if (r.waffleKg > 0) ops.push(asLine(`וופל צ'יפס: ${kgStr(r.waffleKg)}`, { align: "R", bold: true, size: 42 }));
  if (r.onionRingsKg > 0) ops.push(asLine(`טבעות בצל: ${kgStr(r.onionRingsKg)}`, { align: "R", bold: true, size: 42 }));
  if (r.potatoesKg > 0) ops.push(asLine(`פוטטוס: ${kgStr(r.potatoesKg)}`, { align: "R", bold: true, size: 42 }));

  if (r.tier === "premium") {
    ops.push(sep());
    ops.push(asLine("תוספות מפנק", { align: "C", bold: true, size: 36 }));
    ops.push(asLine(`ביצי עין: ${r.eggs}`, { align: "R", bold: true, size: 39 }));
    ops.push(asLine(`ריבת בצל: ${r.onionJam}`, { align: "R", bold: true, size: 39 }));
    ops.push(asLine(`בצל מטוגן: ${r.friedOnion}`, { align: "R", bold: true, size: 39 }));
    ops.push(asLine(`פלפל חריף: ${r.chili}`, { align: "R", bold: true, size: 39 }));
    ops.push(asLine(`קינוח: ${r.desserts}`, { align: "R", bold: true, size: 39 }));
  }

  if (b.kitchen_notes && b.kitchen_notes.trim()) {
    ops.push(sep());
    ops.push(asLine("הערות למטבח", { align: "C", bold: true, size: 33 }));
    for (const line of b.kitchen_notes.split(/\r?\n/)) {
      if (line.trim()) ops.push(asLine(line, { align: "R", size: 33 }));
    }
  }

  ops.push(feed(2));
  ops.push({ kind: "cut" });
  return ops;
}


