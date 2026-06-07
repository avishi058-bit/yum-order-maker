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
import {
  computeChefSummary,
  computeDrinkSummary,
  computeDonenessSummary,
  formatDonenessRows,
  extractOwnerName,
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
  const skip = shortcutConsumedIds(shortcut);
  for (const r of removals) {
    if (skip.has(r)) continue;
    const m = ING_LOOKUP[r];
    if (m) (m.kind === "remove" ? removes : adds).push(m.label);
    else others.push(r);
  }
  return { removes, adds, others, shortcut };
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

const orderTypeLabel = (source: string): string =>
  source === "kiosk" || source === "station" ? "לשבת" : "איסוף";

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
      phonePx: 32,
    });
  }
  ops.push(sep());

  // 2) Order type (small) + optional note
  ops.push(asLine(orderTypeLabel(order.order_source), { align: "C", bold: true, size: 26 }));
  if (order.notes) {
    ops.push(asLine(`הערה: ${order.notes}`, { align: "R", bold: true, size: 26 }));
  }
  ops.push(feed(1));

  // Group identical "real" items so two of the same exact dish print once as x2.
  const realItems = order.order_items.filter((it) => it.item_name !== "רטבים");
  const groupKey = (it: ReceiptOrderItem): string => JSON.stringify({
    n: it.item_name,
    r: it.removals || [],
    t: it.toppings || [],
    m: !!it.with_meal,
    ms: it.meal_side || null,
    md: it.meal_drink || null,
    db: it.deal_burgers || null,
    dd: it.deal_drinks || null,
  });
  const groups: Array<{ item: ReceiptOrderItem; qty: number }> = [];
  const idxByKey = new Map<string, number>();
  for (const it of realItems) {
    const k = groupKey(it);
    const existing = idxByKey.get(k);
    if (existing !== undefined) {
      groups[existing].qty += it.quantity;
    } else {
      idxByKey.set(k, groups.length);
      groups.push({ item: it, qty: it.quantity });
    }
  }
  const isMultiItem = groups.length > 1 || (groups.length === 1 && groups[0].qty > 1);
  const LINE_GAP = 0.5; // breathing room between lines within an item

  // Pre-compute drinks summary so we can avoid duplicating standalone drinks
  // both as a "dish" and in the bottom summary.
  const drinksSummaryEntries: Array<[string, number]> = [];
  if (isMultiItem) {
    const drinks = computeDrinkSummary(order.order_items).drinks;
    for (const [name, qty] of drinks.entries()) if (qty > 0) drinksSummaryEntries.push([name, qty]);
  }
  const hasDrinksSummary = drinksSummaryEntries.length > 0;
  const isStandaloneDrinkItem = (it: ReceiptOrderItem) =>
    DRINK_RX.test(it.item_name) && !it.with_meal && !Array.isArray(it.deal_burgers);
  const printedGroups = hasDrinksSummary
    ? groups.filter((g) => !isStandaloneDrinkItem(g.item))
    : groups;

  // 3) Items
  printedGroups.forEach((g, gi) => {
    const it = g.item;
    const totalQty = g.qty;
    const { ownerName, doneness, cleanedRemovals } = extractOwnerName(it.removals);
    const donShort = shortDoneness(doneness);

    if (ownerName) {
      ops.push(asLine(`* ${ownerName}`, { align: "R", bold: true, size: 24 }));
      ops.push(feed(LINE_GAP));
    }

    // Item name (big, bold) — qty only when >1, doneness inline at end
    const qtyStr = totalQty > 1 ? ` x${totalQty}` : "";
    const donSuffix = donShort ? ` ${donShort}` : "";
    ops.push(asLine(`${it.item_name}${qtyStr}${donSuffix}`, { align: "R", bold: true, size: 34 }));
    ops.push(feed(LINE_GAP));

    // Changes
    const isDeal = Array.isArray(it.deal_burgers) && it.deal_burgers.length > 0;
    if (!isDeal && isCustomizableBurger(it.item_name)) {
      const { removes, adds, others, shortcut } = classifyIngredientChanges(cleanedRemovals);
      const shortcutLbl = removalShortcutLabel(shortcut);
      if (!shortcutLbl && removes.length === 0 && adds.length === 0 && others.length === 0) {
        ops.push(asLine("ללא שינויים", { align: "R", bold: true, size: 26 }));
        ops.push(feed(LINE_GAP));
      } else {
        if (shortcutLbl) { ops.push(asLine(shortcutLbl, { align: "R", bold: true, size: 28 })); ops.push(feed(LINE_GAP)); }
        for (const r of removes) { ops.push(asLine(`ללא ${r}`, { align: "R", bold: true, size: 28 })); ops.push(feed(LINE_GAP)); }
        for (const a of adds) { ops.push(asLine(`להוסיף ${a}`, { align: "R", bold: true, size: 28 })); ops.push(feed(LINE_GAP)); }
        for (const o of others) { ops.push(asLine(o, { align: "R", bold: true, size: 26 })); ops.push(feed(LINE_GAP)); }
      }
    } else if (cleanedRemovals.length > 0) {
      ops.push(asLine(`- ${cleanedRemovals.join(", ")}`, { align: "R", bold: true, size: 26 }));
      ops.push(feed(LINE_GAP));
    }

    // Spacing before meal / drink / toppings line
    ops.push(feed(0.6));

    // Per-item drinks (meal drink / deal drinks)
    if (it.with_meal) {
      let m = "ארוחה";
      if (it.meal_side) m += ` - ${it.meal_side}`;
      if (it.meal_drink) m += `, ${cleanDrinkName(it.meal_drink)}`;
      ops.push(asLine(m, { align: "R", bold: true, size: 26 }));
      ops.push(feed(LINE_GAP));
    }
    if (Array.isArray(it.deal_burgers)) {
      it.deal_burgers.forEach((b: { name?: string; removals?: string[] }, i: number) => {
        ops.push(asLine(`${i + 1}. ${b.name || ""}`, { align: "R", bold: true, size: 26 }));
        ops.push(feed(LINE_GAP));
        const bRem = b.removals || [];
        if (isCustomizableBurger(b.name || "")) {
          const { removes, adds, others, shortcut } = classifyIngredientChanges(
            extractOwnerName(bRem).cleanedRemovals,
          );
          const shortcutLbl = removalShortcutLabel(shortcut);
          if (!shortcutLbl && removes.length === 0 && adds.length === 0 && others.length === 0) {
            ops.push(asLine("ללא שינויים", { align: "R", bold: true, size: 24 }));
            ops.push(feed(LINE_GAP));
          } else {
            if (shortcutLbl) { ops.push(asLine(shortcutLbl, { align: "R", bold: true, size: 26 })); ops.push(feed(LINE_GAP)); }
            for (const r of removes) { ops.push(asLine(`ללא ${r}`, { align: "R", bold: true, size: 26 })); ops.push(feed(LINE_GAP)); }
            for (const a of adds) { ops.push(asLine(`להוסיף ${a}`, { align: "R", bold: true, size: 26 })); ops.push(feed(LINE_GAP)); }
            for (const o of others) { ops.push(asLine(o, { align: "R", bold: true, size: 24 })); ops.push(feed(LINE_GAP)); }
          }
        } else if (bRem.length > 0) {
          ops.push(asLine(`- ${bRem.join(", ")}`, { align: "R", bold: true, size: 24 }));
          ops.push(feed(LINE_GAP));
        }
      });
      ops.push(asLine(`צ'יפס ענק`, { align: "R", bold: true, size: 26 }));
      ops.push(feed(LINE_GAP));
    }
    if (Array.isArray(it.deal_drinks)) {
      it.deal_drinks.forEach((d: { name?: string }) => {
        if (d.name) { ops.push(asLine(cleanDrinkName(d.name), { align: "R", bold: true, size: 26 })); ops.push(feed(LINE_GAP)); }
      });
    }

    // Toppings
    if (it.toppings && it.toppings.length > 0) {
      for (const t of it.toppings) { ops.push(asLine(toppingLine(t), { align: "R", bold: true, size: 28 })); ops.push(feed(LINE_GAP)); }
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
      ops.push(asLine(toppingLine(t), { align: "R", bold: true, size: 28 }));
      ops.push(feed(LINE_GAP));
    }
  }

  // 5) Multi-item: aggregated drinks summary at the bottom (no title)
  if (hasDrinksSummary) {
    ops.push(sep());
    for (const [label, n] of drinksSummaryEntries) {
      const line = n > 1 ? `${label} x${n}` : label;
      ops.push(asLine(line, { align: "R", bold: true, size: 26 }));
      ops.push(feed(LINE_GAP));
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

  const sorted = [...orders].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });

  for (const o of sorted) {
    ops.push({ kind: "text", text: `#${o.order_number}`, align: "R", size: 1 });
    if (o.customer_name) {
      ops.push(asLine(o.customer_name, { align: "R", bold: true, size: 34 }));
    }
    for (const it of o.order_items || []) {
      if (it.item_name === "רטבים") continue;
      const { ownerName, doneness, cleanedRemovals } = extractOwnerName(it.removals);
      const donShort = shortDoneness(doneness);
      if (ownerName) ops.push(asLine(`* ${ownerName}`, { align: "R", bold: true, size: 28 }));
      const qty = it.quantity > 1 ? ` x${it.quantity}` : "";
      const donSuffix = donShort ? ` ${donShort}` : "";
      ops.push(asLine(`${it.item_name}${qty}${donSuffix}`, { align: "R", bold: true, size: 34 }));
      if (cleanedRemovals.length > 0) {
        ops.push(asLine(`- ${cleanedRemovals.join(", ")}`, { align: "R", bold: true, size: 28 }));
      }
      if (it.toppings && it.toppings.length > 0) {
        for (const t of it.toppings) {
          ops.push(asLine(toppingLine(t), { align: "R", bold: true, size: 28 }));
        }
      }
      if (it.with_meal) {
        let m = "ארוחה";
        if (it.meal_side) m += ` - ${it.meal_side}`;
        if (it.meal_drink) m += `, ${cleanDrinkName(it.meal_drink)}`;
        ops.push(asLine(m, { align: "R", bold: true, size: 28 }));
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
  if (s.regularBuns > 0) rows.push(["לחמנייה רגילה", s.regularBuns]);
  if (s.glutenFreeBuns > 0) rows.push(["לחמנייה ל\"ג", s.glutenFreeBuns]);
  if (s.fries > 0) rows.push(["צ'יפס", s.fries]);
  if (s.sweetPotatoFries > 0) rows.push(["צ'יפס בטטה", s.sweetPotatoFries]);
  if (s.onionRings > 0) rows.push(["טבעות בצל", s.onionRings]);
  if (s.tempuraOnionSide > 0) rows.push(["טמפורה מנה", s.tempuraOnionSide]);
  if (s.tempuraOnionTopping > 0) rows.push(["טמפורה יחידה", s.tempuraOnionTopping]);
  if (s.friendsMix > 0) rows.push(["מיקס חברים", s.friendsMix]);
  if (s.eggs > 0) rows.push(["ביצי עין", s.eggs]);
  if (s.roastbeef > 0) rows.push(["רוסטביף", s.roastbeef]);
  for (const [name, qty] of s.sauces.entries()) if (qty > 0) rows.push([name, qty]);

  if (rows.length === 0) return out;

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
