// Kitchen receipt builder + chef-summary calculator.
// Designed for 80mm thermal printers (printable area ~72mm).
// Black & white only, large fonts, no decorations.
//
// CHEF SUMMARY RULES:
//   Patties:
//     - "כפולה" / "ארוחת כפולה"  → +2 regular
//     - any other non-smash burger → +1 regular
//     - smash/קרייזי → +1 smash
//   Topping "אקסטרה קציצה" → +1 regular patty
//   Egg ("ביצת עין"): +1 per topping; "אבישי שחוט לי פרה" includes one
//   Roastbeef ("רצועות רוסטביף"): +1 per topping; "אבישי" includes one
//   Buns: +1 per main item; gluten-free swap based on removal/topping flag.
//
// FRIED ITEMS (added per actual order):
//   צ'יפס, וופל צ'יפס, טבעות בצל, טבעות בצל בטמפורה
//   - Standalone sides count by quantity
//   - Meal side: count the chosen side (default fries if not specified)
//   - Friends-mix ("מיקס חברים"): show as a single unsplit line
//
// NOT in summary (already prepped / assembled at last second):
//   onion jam, lettuce, tomato, pickles, fried onion, sauces, garlic confit,
//   peanut butter, vegan cheddar, hot pepper jam, onion rings topping, maple.

export interface ReceiptOrderItem {
  id: string;
  item_name: string;
  price: number;
  quantity: number;
  toppings: string[] | null;
  removals: string[] | null;
  with_meal: boolean | null;
  meal_side: string | null;
  meal_drink: string | null;
  deal_burgers: any;
  deal_drinks: any;
}

export interface ReceiptOrder {
  order_number: number;
  customer_name: string;
  customer_phone: string;
  notes: string | null;
  total: number;
  created_at: string;
  payment_method: string | null;
  order_source: string;
  order_items: ReceiptOrderItem[];
}

export interface ChefSummary {
  regularPatties: number;
  smashPatties: number;
  eggs: number;
  roastbeef: number;
  regularBuns: number;
  glutenFreeBuns: number;
  fries: number;          // צ'יפס רגיל
  waffleFries: number;    // וופל צ'יפס
  onionRings: number;     // טבעות בצל
  tempuraOnion: number;   // טבעות בצל בטמפורה
  friendsMix: number;     // מיקס חברים (לא לפרק)
}

// ---------- helpers ----------

const isSmashName = (name: string): boolean =>
  /סמאש|קרייזי/.test(name);

const isDoubleName = (name: string): boolean =>
  /כפולה/.test(name);

// "Avishai" burger ships with egg + roastbeef built-in.
const isAvishai = (name: string): boolean =>
  /אבישי|שחוט לי פרה/.test(name);

const isFriendsMix = (name: string): boolean =>
  /מיקס\s*חברים/.test(name);

// Drinks/non-burger items that don't add patty/bun.
// Hebrew uses ׳ (U+05F3) and ״ (U+05F4), not ASCII apostrophe.
const isDrinkOrMisc = (name: string): boolean =>
  /פחית|בקבוק|בירה|ויינשטפאן|קולה|זירו|פאנטה|ספרייט|בלו|גולדסטאר|הייניקן|קורונה|קאלסברג|קלסטברג|לאפ|לאף|גינס|אנפילטר|הוגרדן|מים|מוחיטו|אבטיח/.test(name);

// Detect fried-side items by name. Order matters: tempura before plain rings,
// waffle before plain fries, mix before fries.
type FriedKind = "friendsMix" | "tempuraOnion" | "waffleFries" | "onionRings" | "fries" | null;
const detectFried = (name: string): FriedKind => {
  if (!name) return null;
  if (isFriendsMix(name)) return "friendsMix";
  if (/טבעות.*טמפורה|טמפורה/.test(name)) return "tempuraOnion";
  if (/וופל/.test(name)) return "waffleFries";
  if (/טבעות\s*בצל/.test(name)) return "onionRings";
  if (/צ['׳]?יפס/.test(name)) return "fries";
  return null;
};

// Counts how many entries in `arr` match ANY of the given needles.
// Each entry is counted at most once even if it matches multiple needles.
const includesAny = (arr: string[] | null | undefined, needles: string[]): number => {
  if (!arr || arr.length === 0) return 0;
  let n = 0;
  for (const t of arr) {
    if (needles.some((needle) => t.includes(needle))) n++;
  }
  return n;
};

// ---------- chef summary ----------

export function computeChefSummary(items: ReceiptOrderItem[]): ChefSummary {
  let regularPatties = 0;
  let smashPatties = 0;
  let eggs = 0;
  let roastbeef = 0;
  let regularBuns = 0;
  let glutenFreeBuns = 0;
  let fries = 0;
  let waffleFries = 0;
  let onionRings = 0;
  let tempuraOnion = 0;
  let friendsMix = 0;

  const addFried = (kind: FriedKind, qty: number) => {
    if (!kind) return;
    if (kind === "friendsMix") friendsMix += qty;
    else if (kind === "tempuraOnion") tempuraOnion += qty;
    else if (kind === "waffleFries") waffleFries += qty;
    else if (kind === "onionRings") onionRings += qty;
    else if (kind === "fries") fries += qty;
  };

  for (const it of items) {
    const qty = it.quantity || 1;
    const name = it.item_name;

    // ---- deal items (family-deal / friends-deal) ----
    if (it.deal_burgers && Array.isArray(it.deal_burgers)) {
      for (const b of it.deal_burgers) {
        const bn = String(b?.name || "");
        if (isSmashName(bn)) smashPatties += qty;
        else if (isDoubleName(bn)) regularPatties += 2 * qty;
        else regularPatties += qty;
        if (isAvishai(bn)) {
          eggs += qty;
          roastbeef += qty;
        }
        regularBuns += qty;
      }
      // Deals include giant fries by default
      fries += qty;
      continue;
    }

    // ---- standalone fried side / friends-mix ----
    const friedKind = detectFried(name);
    if (friedKind) {
      addFried(friedKind, qty);
      continue;
    }

    // ---- pure drinks: skip ----
    if (isDrinkOrMisc(name)) continue;

    // ---- patties ----
    if (isSmashName(name)) smashPatties += qty;
    else if (isDoubleName(name)) regularPatties += 2 * qty;
    else regularPatties += qty;

    // ---- bun (1 per main item) ----
    regularBuns += qty;

    // ---- built-in extras for "Avishai" ----
    if (isAvishai(name)) {
      eggs += qty;
      roastbeef += qty;
    }

    // ---- topping-driven extras ----
    regularPatties += includesAny(it.toppings, ["אקסטרה קציצה"]) * qty;
    eggs += includesAny(it.toppings, ["ביצת עין"]) * qty;
    roastbeef += includesAny(it.toppings, ["רצועות רוסטביף", "רוסטביף"]) * qty;

    // ---- gluten-free bun swap ----
    const gfFlag =
      includesAny(it.removals, ["ללא גלוטן", "גלוטן"]) +
      includesAny(it.toppings, ["ללא גלוטן"]);
    if (gfFlag > 0) {
      const swap = Math.min(gfFlag * qty, regularBuns);
      regularBuns -= swap;
      glutenFreeBuns += swap;
    }

    // ---- meal side (only meals/business deals carry their own side) ----
    if (it.with_meal || /ארוחת/.test(name)) {
      const sideKind = detectFried(it.meal_side || "") || "fries"; // default to fries if unspecified
      addFried(sideKind, qty);
    }
  }

  return {
    regularPatties,
    smashPatties,
    eggs,
    roastbeef,
    regularBuns,
    glutenFreeBuns,
    fries,
    waffleFries,
    onionRings,
    tempuraOnion,
    friendsMix,
  };
}

// ---------- merging identical lines ----------

interface MergedLine {
  key: string;
  item: ReceiptOrderItem;
  totalQty: number;
}

const lineKey = (it: ReceiptOrderItem): string =>
  JSON.stringify({
    n: it.item_name,
    t: [...(it.toppings || [])].sort(),
    r: [...(it.removals || [])].sort(),
    m: it.with_meal || false,
    ms: it.meal_side || null,
    md: it.meal_drink || null,
    db: it.deal_burgers || null,
    dd: it.deal_drinks || null,
  });

function mergeItems(items: ReceiptOrderItem[]): MergedLine[] {
  const map = new Map<string, MergedLine>();
  for (const it of items) {
    const k = lineKey(it);
    const existing = map.get(k);
    if (existing) existing.totalQty += it.quantity;
    else map.set(k, { key: k, item: it, totalQty: it.quantity });
  }
  return Array.from(map.values());
}

// ---------- HTML builder ----------

const orderTypeLabel = (source: string): string => {
  if (source === "kiosk" || source === "station") return "ישיבה במקום";
  return "איסוף עצמי";
};

export function buildReceiptHtml(order: ReceiptOrder): string {
  const merged = mergeItems(order.order_items);
  const summary = computeChefSummary(order.order_items);
  const isCash = order.payment_method === "cash";

  const time = new Date(order.created_at).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemsHtml = merged
    .map((line) => {
      const it = line.item;
      const qtyStr = line.totalQty > 1 ? ` ×${line.totalQty}` : "";
      let html = `<div class="line"><div class="line-name">${escapeHtml(it.item_name)}${qtyStr}</div>`;

      if (it.removals && it.removals.length > 0) {
        html += `<div class="sub">— ללא: ${escapeHtml(it.removals.join(", "))}</div>`;
      }
      if (it.toppings && it.toppings.length > 0) {
        html += `<div class="sub">+ ${escapeHtml(it.toppings.join(", "))}</div>`;
      }
      if (it.with_meal) {
        let mealText = "ארוחה";
        if (it.meal_side) mealText += ` — ${it.meal_side}`;
        if (it.meal_drink) mealText += `, ${it.meal_drink}`;
        html += `<div class="sub">→ ${escapeHtml(mealText)}</div>`;
      }
      if (it.deal_burgers && Array.isArray(it.deal_burgers)) {
        it.deal_burgers.forEach((b: any, i: number) => {
          let bLine = `${i + 1}. ${b.name || ""}`;
          if (b.removals?.length > 0) bLine += ` — ללא ${b.removals.join(", ")}`;
          html += `<div class="sub">${escapeHtml(bLine)}</div>`;
        });
        html += `<div class="sub">+ צ׳יפס ענק</div>`;
      }
      if (it.deal_drinks && Array.isArray(it.deal_drinks)) {
        it.deal_drinks.forEach((d: any) => {
          html += `<div class="sub">+ ${escapeHtml(d.name)}</div>`;
        });
      }
      html += `</div>`;
      return html;
    })
    .join("");

  // Chef summary block
  const summaryRows: string[] = [];
  const row = (label: string, n: number, gf = false) =>
    `<div class="sum-row${gf ? " gf" : ""}"><span>${label}</span><span class="sum-num">${n}</span></div>`;

  if (summary.regularPatties > 0) summaryRows.push(row("קציצות רגילות", summary.regularPatties));
  if (summary.smashPatties > 0) summaryRows.push(row("קציצות סמאש", summary.smashPatties));
  if (summary.eggs > 0) summaryRows.push(row("ביצי עין", summary.eggs));
  if (summary.roastbeef > 0) summaryRows.push(row("רצועות רוסטביף", summary.roastbeef));
  if (summary.regularBuns > 0) summaryRows.push(row("לחמניות", summary.regularBuns));
  if (summary.glutenFreeBuns > 0) summaryRows.push(row("לחמניות ללא גלוטן", summary.glutenFreeBuns, true));
  if (summary.fries > 0) summaryRows.push(row("צ׳יפס", summary.fries));
  if (summary.waffleFries > 0) summaryRows.push(row("וופל צ׳יפס", summary.waffleFries));
  if (summary.onionRings > 0) summaryRows.push(row("טבעות בצל", summary.onionRings));
  if (summary.tempuraOnion > 0) summaryRows.push(row("טבעות בצל בטמפורה", summary.tempuraOnion));
  if (summary.friendsMix > 0) summaryRows.push(row("מיקס חברים", summary.friendsMix));

  const summaryHtml = summaryRows.length > 0
    ? `<div class="summary">
         <div class="summary-title">סיכום לטבח</div>
         ${summaryRows.join("")}
       </div>`
    : "";

  const paymentLine = isCash
    ? `<div class="warn">לא שולם — מזומן בעת המסירה</div>`
    : `<div class="paid">שולם באשראי</div>`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8" />
<title>בון #${order.order_number}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: #fff; color: #000;
    font-family: 'Heebo', 'Arial', sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    width: 72mm;
    padding: 2mm;
    font-size: 12pt;
    line-height: 1.3;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .order-num {
    text-align: center;
    font-size: 28pt;
    font-weight: 900;
    line-height: 1;
    margin: 0 0 2mm;
  }
  .order-num small { font-size: 11pt; font-weight: 700; display: block; margin-top: 1mm; }
  .type {
    text-align: center;
    font-size: 14pt;
    font-weight: 900;
    background: #000; color: #fff;
    padding: 2mm 0;
    margin-bottom: 2mm;
    letter-spacing: 1px;
  }
  .customer {
    border-bottom: 1px dashed #000;
    padding-bottom: 2mm;
    margin-bottom: 2mm;
    font-size: 11pt;
  }
  .customer .name { font-weight: 900; font-size: 13pt; }
  .notes {
    border: 2px solid #000;
    padding: 2mm;
    margin: 2mm 0;
    font-weight: 700;
    font-size: 12pt;
  }
  .line {
    border-bottom: 1px dashed #000;
    padding: 2mm 0;
    page-break-inside: avoid;
  }
  .line:last-of-type { border-bottom: 2px solid #000; }
  .line-name {
    font-size: 15pt;
    font-weight: 900;
    line-height: 1.2;
  }
  .sub {
    font-size: 11pt;
    font-weight: 600;
    padding-right: 3mm;
    margin-top: 1mm;
  }
  .summary {
    border: 3px solid #000;
    margin-top: 3mm;
    padding: 2mm;
    background: #000; color: #fff;
  }
  .summary-title {
    text-align: center;
    font-size: 14pt;
    font-weight: 900;
    border-bottom: 2px solid #fff;
    padding-bottom: 1mm;
    margin-bottom: 2mm;
    letter-spacing: 1px;
  }
  .sum-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13pt;
    font-weight: 800;
    padding: 1mm 0;
  }
  .sum-row.gf {
    border-top: 1px dashed #fff;
    padding-top: 2mm;
    margin-top: 1mm;
  }
  .sum-num {
    font-size: 16pt;
    font-weight: 900;
    min-width: 8mm;
    text-align: center;
    background: #fff; color: #000;
    border-radius: 2px;
    padding: 0 2mm;
  }
  .warn {
    border: 3px solid #000;
    text-align: center;
    font-size: 13pt;
    font-weight: 900;
    padding: 2mm;
    margin-top: 2mm;
  }
  .paid {
    text-align: center;
    font-size: 11pt;
    font-weight: 700;
    margin-top: 2mm;
  }
  .footer {
    text-align: center;
    font-size: 10pt;
    margin-top: 2mm;
    padding-bottom: 5mm;
  }
  @media print {
    body { width: auto; padding: 1mm 2mm; }
  }
</style>
</head>
<body>
  <div class="order-num">#${order.order_number}<small>${time}</small></div>
  <div class="type">${orderTypeLabel(order.order_source)}</div>

  <div class="customer">
    <div class="name">${escapeHtml(order.customer_name)}</div>
    <div>${escapeHtml(order.customer_phone)}</div>
  </div>

  ${order.notes ? `<div class="notes">הערה: ${escapeHtml(order.notes)}</div>` : ""}

  ${itemsHtml}

  ${summaryHtml}

  ${paymentLine}

  <div class="footer">סה״כ ₪${order.total}</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printReceipt(order: ReceiptOrder) {
  const html = buildReceiptHtml(order);
  const w = window.open("", "_blank", "width=380,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch (e) {
      console.warn("[receipt] print failed", e);
    }
  }, 250);
}
