// Kitchen receipt builder + chef-summary calculator.
// 80mm thermal printers (printable area ~72mm). Black & white only.
//
// CHEF SUMMARY RULES:
//   Patties (split by type):
//     - "חף מפשע" / "haf-mifsha"  → vegan patty
//     - "כפולה" / "ארוחת כפולה"   → +2 regular
//     - "סמאש" / "קרייזי"         → smash
//     - any other meat burger     → +1 regular
//   Topping "אקסטרה קציצה" → +1 regular patty (per the burger's category;
//     for חף מפשע we still treat it as regular meat — that's a customer
//     decision, no auto-promotion to vegan).
//   Egg ("ביצת עין"): +1 per topping; "אבישי" includes one
//   Roastbeef: +1 per topping; "אבישי" includes one
//   Buns: +1 per main item (kept regular by default, GF swap if requested).
//
// FRIED ITEMS (split by source — never merge):
//   - Standalone sides → counted by quantity
//   - Meal side       → the chosen side (default fries if missing)
//   - Friends-mix     → single un-split line
//   - Special-Hadegel → auto +2 of tempuraOnionSide for every burger ordered
//                       (the recipe ships with 2 tempura rings on top, but the
//                        chef preps them as a side portion — listed separately).
//   - Topping "שלושטבעות בצל ביתיות" → tempuraOnionTopping (separate counter)
//
// SAUCES: read from a synthetic "רטבים" order_item line.
//   item_name === "רטבים", toppings carry "name × qty" labels we parse back.
//
// NOT in summary (already prepped):
//   onion jam, lettuce, tomato, pickles, fried onion, sauces*, garlic confit,
//   peanut butter, vegan cheddar, hot pepper jam, maple.
//   (* sauces ARE shown in their own block, just not aggregated as ingredients)

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
  // Patties — split by type
  regularPatties: number;
  smashPatties: number;
  veganPatties: number;
  // Built-in extras
  eggs: number;
  roastbeef: number;
  // Buns
  regularBuns: number;
  glutenFreeBuns: number;
  // Fried sides (sources kept separate)
  fries: number;
  waffleFries: number;
  onionRings: number;          //טבעות בצל (מנה בצד)
  tempuraOnionSide: number;    //טבעות בצל בטמפורה (מנה בצד / מתוך עסקית / ספיישל הדגל)
  tempuraOnionTopping: number; // שלוש טבעות בצל ביתיות (טופינג מעל ההמבורגר)
  friendsMix: number;
  // Sauces — aggregated by name
  sauces: Map<string, number>;
}

// ---------- helpers ----------

const isSmashName = (name: string): boolean => /סמאש|קרייזי/.test(name);

const isDoubleName = (name: string): boolean => /כפולה/.test(name);

const isVeganBurgerName = (name: string): boolean =>
  /חף\s*מפשע|haf[-\s]?mifsha/i.test(name);

// "Avishai" burger ships with egg + roastbeef built-in.
const isAvishai = (name: string): boolean => /אבישי|שחוט לי פרה/.test(name);

const isFriendsMix = (name: string): boolean => /מיקס\s*חברים/.test(name);

const isSpecialHadegel = (name: string): boolean => /ספיישל\s*הדגל/.test(name);

// Drinks/non-burger items that don't add patty/bun.
const isDrinkOrMisc = (name: string): boolean =>
  /פחית|בקבוק|בירה|ויינשטפאן|קולה|זירו|פאנ忒|ספרייט|בלו|גולדסטאר|הייניקן|קורונה|קאלסברג|קלסטברג|לאפ|לאף|גינס|אנפילטר|הוגרדן|מים|מוחיטו|אבטיח/.test(name);

// Detect fried-side items by name. Order matters.
type FriedKind = "friendsMix" | "tempuraOnionSide" | "waffleFries" | "onionRings" | "fries" | null;
const detectFried = (name: string): FriedKind => {
  if (!name) return null;
  if (isFriendsMix(name)) return "friendsMix";
  // "טבעות בצל בטמפורה" / "טבעות בצל ביתיות בטמפורה" / "טמפורה"
  if (/טבעות.*טמפורה|טמפורה/.test(name)) return "tempuraOnionSide";
  if (/וופל/.test(name)) return "waffleFries";
  if (/טבעות\s*בצל/.test(name)) return "onionRings";
  if (/צ['׳]?יפס/.test(name)) return "fries";
  return null;
};

// Counts how many entries in `arr` match ANY of the needles (each entry once).
const includesAny = (arr: string[] | null | undefined, needles: string[]): number => {
  if (!arr || arr.length === 0) return 0;
  let n = 0;
  for (const t of arr) {
    if (needles.some((needle) => t.includes(needle))) n++;
  }
  return n;
};

// Parse "name × qty" strings (the synthetic sauces line stores them this way).
const parseSauceLabel = (label: string): { name: string; qty: number } => {
  const m = label.match(/^(.+?)\s*[×x]\s*(\d+)\s*$/);
  if (m) return { name: m[1].trim(), qty: parseInt(m[2], 10) || 1 };
  return { name: label.trim(), qty: 1 };
};

// ---------- chef summary ----------

export function computeChefSummary(items: ReceiptOrderItem[]): ChefSummary {
  let regularPatties = 0;
  let smashPatties = 0;
  let veganPatties = 0;
  let eggs = 0;
  let roastbeef = 0;
  let regularBuns = 0;
  let glutenFreeBuns = 0;
  let fries = 0;
  let waffleFries = 0;
  let onionRings = 0;
  let tempuraOnionSide = 0;
  let tempuraOnionTopping = 0;
  let friendsMix = 0;
  const sauces = new Map<string, number>();

  const addFried = (kind: FriedKind, qty: number) => {
    if (!kind) return;
    if (kind === "friendsMix") friendsMix += qty;
    else if (kind === "tempuraOnionSide") tempuraOnionSide += qty;
    else if (kind === "waffleFries") waffleFries += qty;
    else if (kind === "onionRings") onionRings += qty;
    else if (kind === "fries") fries += qty;
  };

  for (const it of items) {
    const qty = it.quantity || 1;
    const name = it.item_name;

    // ---- sauces synthetic line ----
    if (name === "רטבים") {
      for (const lbl of it.toppings || []) {
        const { name: sn, qty: sq } = parseSauceLabel(lbl);
        sauces.set(sn, (sauces.get(sn) || 0) + sq);
      }
      continue;
    }

    // ---- deal items (family-deal / friends-deal) ----
    if (it.deal_burgers && Array.isArray(it.deal_burgers)) {
      for (const b of it.deal_burgers) {
        const bn = String(b?.name || "");
        if (isVeganBurgerName(bn)) veganPatties += qty;
        else if (isSmashName(bn)) smashPatties += qty;
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

    // ---- patties (by type) ----
    if (isVeganBurgerName(name)) veganPatties += qty;
    else if (isSmashName(name)) smashPatties += qty;
    else if (isDoubleName(name)) regularPatties += 2 * qty;
    else regularPatties += qty;

    // ---- bun (1 per main item, even for double) ----
    regularBuns += qty;

    // ---- built-in extras for "Avishai" ----
    if (isAvishai(name)) {
      eggs += qty;
      roastbeef += qty;
    }

    // ---- Special-Hadegel auto-extras: 2 tempura rings as a side portion
    //      per burger ordered (the recipe lists them as a topping but the
    //      chef preps them in the fryer like a side).
    if (isSpecialHadegel(name)) {
      tempuraOnionSide += 2 * qty;
    }

    // ---- topping-driven extras ----
    regularPatties += includesAny(it.toppings, ["אקסטרה קציצה"]) * qty;
    eggs += includesAny(it.toppings, ["ביצת עין"]) * qty;
    roastbeef += includesAny(it.toppings, ["רצועות רוסטביף", "רוסטביף"]) * qty;
    // Onion-rings TOPPING ("שלושטבעות בצל ביתיות") — kept SEPARATE from side.
    tempuraOnionTopping += includesAny(it.toppings, ["שלושטבעות בצל", "טבעות בצל ביתיות"]) * qty;

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
      const sideKind = detectFried(it.meal_side || "") || "fries";
      addFried(sideKind, qty);
    }
  }

  return {
    regularPatties,
    smashPatties,
    veganPatties,
    eggs,
    roastbeef,
    regularBuns,
    glutenFreeBuns,
    fries,
    waffleFries,
    onionRings,
    tempuraOnionSide,
    tempuraOnionTopping,
    friendsMix,
    sauces,
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
    // Don't merge the synthetic sauces line into the menu listing — it has its
    // own block at the bottom of the receipt.
    if (it.item_name === "רטבים") continue;
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

  // ---- Chef summary (sectioned for fast scanning) ----
  const row = (label: string, n: number, gf = false) =>
    `<div class="sum-row${gf ? " gf" : ""}"><span>${escapeHtml(label)}</span><span class="sum-num">${n}</span></div>`;

  const section = (title: string, rows: string[]) =>
    rows.length === 0
      ? ""
      : `<div class="sum-section">
           <div class="sum-section-title">${escapeHtml(title)}</div>
           ${rows.join("")}
         </div>`;

  // Patties
  const pattyRows: string[] = [];
  if (summary.regularPatties > 0) pattyRows.push(row("רגיל", summary.regularPatties));
  if (summary.smashPatties > 0) pattyRows.push(row("סמאש", summary.smashPatties));
  if (summary.veganPatties > 0) pattyRows.push(row("טבעוני (חף מפשע)", summary.veganPatties));

  // Buns
  const bunRows: string[] = [];
  if (summary.regularBuns > 0) bunRows.push(row("לחמנייה רגילה", summary.regularBuns));
  if (summary.glutenFreeBuns > 0) bunRows.push(row("לחמנייה ללא גלוטן", summary.glutenFreeBuns, true));

  // Fried sides — keep types separate
  const friedRows: string[] = [];
  if (summary.fries > 0) friedRows.push(row("צ׳יפס", summary.fries));
  if (summary.waffleFries > 0) friedRows.push(row("וופל צ׳יפס", summary.waffleFries));
  if (summary.onionRings > 0) friedRows.push(row("טבעות בצל (מנה)", summary.onionRings));
  if (summary.tempuraOnionSide > 0)
    friedRows.push(row("טבעות בצל בטמפורה (מנה)", summary.tempuraOnionSide));
  if (summary.friendsMix > 0) friedRows.push(row("מיקס חברים", summary.friendsMix));

  // Toppings ON the burger (separate from sides)
  const toppingRows: string[] = [];
  if (summary.eggs > 0) toppingRows.push(row("ביצי עין", summary.eggs));
  if (summary.roastbeef > 0) toppingRows.push(row("רצועות רוסטביף", summary.roastbeef));
  if (summary.tempuraOnionTopping > 0)
    toppingRows.push(row("טבעות בצל בטמפורה (טופינג)", summary.tempuraOnionTopping));

  // Sauces
  const sauceRows: string[] = [];
  for (const [name, qty] of summary.sauces.entries()) {
    if (qty > 0) sauceRows.push(row(name, qty));
  }

  const summaryBody =
    section("קציצות", pattyRows) +
    section("לחמניות", bunRows) +
    section("מטוגנים", friedRows) +
    section("תוספות מעל ההמבורגר", toppingRows) +
    section("רטבים", sauceRows);

  const summaryHtml = summaryBody
    ? `<div class="summary">
         <div class="summary-title">סיכום לטבח</div>
         ${summaryBody}
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
    font-size: 15pt;
    font-weight: 900;
    border-bottom: 2px solid #fff;
    padding-bottom: 1mm;
    margin-bottom: 2mm;
    letter-spacing: 1px;
  }
  .sum-section {
    margin-top: 2mm;
    padding-top: 1mm;
    border-top: 1px dashed #fff;
  }
  .sum-section:first-of-type { border-top: none; padding-top: 0; margin-top: 0; }
  .sum-section-title {
    font-size: 11pt;
    font-weight: 800;
    text-align: center;
    padding: 1mm 0;
    margin-bottom: 1mm;
    background: #fff; color: #000;
    border-radius: 2px;
    letter-spacing: 0.5px;
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
    font-style: italic;
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
