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
} {
  const removes: string[] = [];
  const adds: string[] = [];
  const others: string[] = [];
  for (const r of removals) {
    const m = ING_LOOKUP[r];
    if (m) (m.kind === "remove" ? removes : adds).push(m.label);
    else others.push(r);
  }
  return { removes, adds, others };
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
  source === "kiosk" || source === "station" ? "ישיבה במקום" : "איסוף עצמי";

// ============================================================
// SINGLE KITCHEN BON
// ============================================================
export function buildKitchenBonOps(order: ReceiptOrder): FastOp[] {
  const ops: FastOp[] = [];

  // 1) TOP: customer name (big, bold) + (phone) inline smaller — single bitmap.
  if (order.customer_name || order.customer_phone) {
    ops.push({
      kind: "header",
      name: order.customer_name || "",
      phone: order.customer_phone || undefined,
      namePx: 42,
      phonePx: 22,
    });
  }
  ops.push(sep());

  // 2) Order type
  ops.push(asLine(orderTypeLabel(order.order_source), { align: "C", bold: true, size: 30 }));

  // Optional note right under the order type
  if (order.notes) {
    ops.push(asLine(`הערה: ${order.notes}`, { align: "R", bold: true, size: 28 }));
  }
  ops.push(feed(1));

  // 3) Items + changes (changes are now BOLD like the name)
  for (const it of order.order_items) {
    if (it.item_name === "רטבים") continue;
    const { ownerName, doneness, cleanedRemovals } = extractOwnerName(it.removals);

    if (ownerName) {
      ops.push(asLine(`* ${ownerName}`, { align: "R", bold: true, size: 26 }));
    }

    const qtyStr = it.quantity > 1 ? ` x${it.quantity}` : "";
    ops.push(asLine(`${it.item_name}${qtyStr}`, { align: "R", bold: true, size: 32 }));

    if (doneness) {
      ops.push(asLine(`עשייה: ${doneness}`, { align: "R", bold: true, size: 28 }));
    }

    const isDeal = Array.isArray(it.deal_burgers) && it.deal_burgers.length > 0;
    if (!isDeal && isCustomizableBurger(it.item_name)) {
      const { removes, adds, others } = classifyIngredientChanges(cleanedRemovals);
      const hasToppings = it.toppings && it.toppings.length > 0;
      if (removes.length === 0 && adds.length === 0 && others.length === 0 && !hasToppings) {
        ops.push(asLine("ללא שינויים", { align: "R", bold: true, size: 28 }));
      } else {
        for (const r of removes) ops.push(asLine(`ללא ${r}`, { align: "R", bold: true, size: 28 }));
        for (const a of adds) ops.push(asLine(`להוסיף ${a}`, { align: "R", bold: true, size: 28 }));
        for (const o of others) ops.push(asLine(o, { align: "R", bold: true, size: 26 }));
        if (hasToppings) {
          for (const t of it.toppings!) ops.push(asLine(`+ ${t}`, { align: "R", bold: true, size: 28 }));
        }
      }
    } else {
      if (cleanedRemovals.length > 0) {
        ops.push(asLine(`- ${cleanedRemovals.join(", ")}`, { align: "R", bold: true, size: 26 }));
      }
      if (it.toppings && it.toppings.length > 0) {
        ops.push(asLine(`+ ${it.toppings.join(", ")}`, { align: "R", bold: true, size: 26 }));
      }
    }

    if (it.with_meal) {
      let m = "ארוחה";
      if (it.meal_side) m += ` - ${it.meal_side}`;
      if (it.meal_drink) m += `, ${it.meal_drink}`;
      ops.push(asLine(`-> ${m}`, { align: "R", bold: true, size: 26 }));
    }
    if (Array.isArray(it.deal_burgers)) {
      it.deal_burgers.forEach((b: { name?: string; removals?: string[] }, i: number) => {
        ops.push(asLine(`${i + 1}. ${b.name || ""}`, { align: "R", bold: true, size: 26 }));
        const bRem = b.removals || [];
        if (isCustomizableBurger(b.name || "")) {
          const { removes, adds, others } = classifyIngredientChanges(
            extractOwnerName(bRem).cleanedRemovals,
          );
          if (removes.length === 0 && adds.length === 0 && others.length === 0) {
            ops.push(asLine("ללא שינויים", { align: "R", bold: true, size: 26 }));
          } else {
            for (const r of removes) ops.push(asLine(`ללא ${r}`, { align: "R", bold: true, size: 26 }));
            for (const a of adds) ops.push(asLine(`להוסיף ${a}`, { align: "R", bold: true, size: 26 }));
            for (const o of others) ops.push(asLine(o, { align: "R", bold: true, size: 24 }));
          }
        } else if (bRem.length > 0) {
          ops.push(asLine(`- ${bRem.join(", ")}`, { align: "R", bold: true, size: 24 }));
        }
      });
      ops.push(asLine(`+ צ'יפס ענק`, { align: "R", bold: true, size: 26 }));
    }
    if (Array.isArray(it.deal_drinks)) {
      it.deal_drinks.forEach((d: { name?: string }) => {
        ops.push(asLine(`+ ${d.name || ""}`, { align: "R", bold: true, size: 26 }));
      });
    }
    ops.push(feed(1));
  }
  ops.push(sep());

  // 4) Chef summary (right column) + side sauces (left column)
  const summary = computeChefSummary(order.order_items);
  const chefRows: string[] = [];
  if (summary.regularPatties > 0) chefRows.push(`קציצה רגיל: ${summary.regularPatties}`);
  if (summary.smashPatties > 0) chefRows.push(`קציצה סמאש: ${summary.smashPatties}`);
  if (summary.veganPatties > 0) chefRows.push(`קציצה טבעוני: ${summary.veganPatties}`);
  if (summary.regularBuns > 0) chefRows.push(`לחמנייה רגילה: ${summary.regularBuns}`);
  if (summary.glutenFreeBuns > 0) chefRows.push(`לחמנייה ל"ג: ${summary.glutenFreeBuns}`);
  if (summary.fries > 0) chefRows.push(`צ'יפס: ${summary.fries}`);
  if (summary.sweetPotatoFries > 0) chefRows.push(`צ'יפס בטטה: ${summary.sweetPotatoFries}`);
  if (summary.onionRings > 0) chefRows.push(`טבעות בצל: ${summary.onionRings}`);
  if (summary.tempuraOnionSide > 0) chefRows.push(`טמפורה (מנה): ${summary.tempuraOnionSide}`);
  if (summary.tempuraOnionTopping > 0) chefRows.push(`טמפורה (יח'): ${summary.tempuraOnionTopping}`);
  if (summary.friendsMix > 0) chefRows.push(`מיקס חברים: ${summary.friendsMix}`);
  if (summary.eggs > 0) chefRows.push(`ביצי עין: ${summary.eggs}`);
  if (summary.roastbeef > 0) chefRows.push(`רוסטביף: ${summary.roastbeef}`);

  const sauceRows: string[] = [];
  for (const [name, qty] of summary.sauces.entries()) {
    if (qty > 0) sauceRows.push(`${name}: ${qty}`);
  }

  if (chefRows.length > 0 || sauceRows.length > 0) {
    ops.push(asLine("== סיכום לטבח ==", { align: "C", bold: true, size: 22 }));
    const rowsCount = Math.max(chefRows.length, sauceRows.length);
    for (let i = 0; i < rowsCount; i++) {
      const r = chefRows[i] || "";
      const l = sauceRows[i] || "";
      if (r && !l) {
        ops.push(asLine(r, { align: "R", bold: true, size: 20 }));
      } else if (!r && l) {
        // sauces-only row: keep on the left as the user requested
        ops.push({ kind: "twoCol", right: "", left: l, size: 20, bold: true });
      } else {
        ops.push({ kind: "twoCol", right: r, left: l, size: 20, bold: true });
      }
    }
  }

  // Drink summary (takeaway only) — keep, but small
  const isTakeaway = order.order_source !== "kiosk" && order.order_source !== "station";
  if (isTakeaway) {
    const drinks = computeDrinkSummary(order.order_items).drinks;
    const drinkRows: Array<[string, number]> = [];
    for (const [name, qty] of drinks.entries()) if (qty > 0) drinkRows.push([name, qty]);
    if (drinkRows.length > 0) {
      ops.push(sep());
      ops.push(asLine("== שתייה ==", { align: "C", bold: true, size: 22 }));
      for (const [label, n] of drinkRows) {
        ops.push(asLine(`${label}: ${n}`, { align: "R", bold: true, size: 20 }));
      }
    }
  }

  // 5) Payment block — only show when relevant
  if (order.payment_method === "counter") {
    ops.push(sep());
    ops.push(asLine("לתשלום בקופה", { align: "C", bold: true, size: 26 }));
    ops.push(asLine(`לתשלום ${order.total}₪`, { align: "C", bold: true, size: 30 }));
  } else if (order.payment_method === "cash") {
    ops.push(sep());
    ops.push(asLine("!! לא שולם - מזומן בעת המסירה !!", { align: "C", bold: true, size: 22 }));
    ops.push(asLine(`לתשלום ${order.total}₪`, { align: "C", bold: true, size: 28 }));
  }
  // credit/online: paid → no payment block

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

  ops.push(asLine("הזמנות פעילות", { align: "C", bold: true, size: 26 }));
  ops.push({ kind: "text", text: time, align: "C", size: 1 });
  ops.push({ kind: "text", text: `${orders.length} orders`, align: "C", size: 1 });
  ops.push(sep());

  for (const o of orders) {
    ops.push({ kind: "text", text: `#${o.order_number}`, align: "R", size: 2, bold: true });
    if (o.customer_name) {
      ops.push(asLine(o.customer_name, { align: "R", bold: true, size: 20 }));
    }
    for (const it of o.order_items || []) {
      if (it.item_name === "רטבים") continue;
      const { ownerName, doneness, cleanedRemovals } = extractOwnerName(it.removals);
      if (ownerName) ops.push(asLine(`* ${ownerName}`, { align: "R", bold: true, size: 18 }));
      const qty = it.quantity > 1 ? ` x${it.quantity}` : "";
      ops.push(asLine(`${it.item_name}${qty}`, { align: "R", bold: true, size: 20 }));
      if (doneness) ops.push(asLine(`עשייה: ${doneness}`, { align: "R", size: 16 }));
      if (cleanedRemovals.length > 0) {
        ops.push(asLine(`- ${cleanedRemovals.join(", ")}`, { align: "R", size: 16 }));
      }
      if (it.toppings && it.toppings.length > 0) {
        ops.push(asLine(`+ ${it.toppings.join(", ")}`, { align: "R", size: 16 }));
      }
      if (it.with_meal) {
        let m = "ארוחה";
        if (it.meal_side) m += ` - ${it.meal_side}`;
        if (it.meal_drink) m += `, ${it.meal_drink}`;
        ops.push(asLine(`-> ${m}`, { align: "R", size: 16 }));
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

  ops.push(asLine("סיכום סבב לטבח", { align: "C", bold: true, size: 28 }));
  ops.push({ kind: "text", text: time, align: "C", size: 1 });
  ops.push({ kind: "text", text: `${orders.length} orders`, align: "C", size: 1 });
  ops.push(sep());

  const all: ReceiptOrderItem[] = orders.flatMap((o) => o.order_items || []);
  ops.push(...buildChefSummaryOps(all, "סה\"כ מנות להכנה"));

  // Doneness aggregation
  const donenessRows = formatDonenessRows(computeDonenessSummary(all));
  if (donenessRows.length > 0) {
    ops.push(sep());
    ops.push(asLine("== מידות עשייה ==", { align: "C", bold: true, size: 22 }));
    for (const r of donenessRows) {
      ops.push(asLine(`${r.label}: ${r.n}`, { align: "R", bold: true, size: 20 }));
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

  out.push(asLine(`== ${title} ==`, { align: "C", bold: true, size: 24 }));
  for (const [label, n] of rows) {
    out.push(asLine(`${label}: ${n}`, { align: "R", bold: true, size: 22 }));
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
