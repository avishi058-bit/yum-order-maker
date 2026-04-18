// Kitchen receipt builder + chef-summary calculator.
// All output is black & white, large fonts, designed for 80mm thermal printers
// but works fine in any browser print dialog.
//
// CHEF SUMMARY RULES (per product owner):
//   Regular patties:
//     - "כפולה" or "ארוחת כפולה"  → +2
//     - any other non-smash burger  → +1
//   Smash patties:
//     - any item whose name contains "סמאש" or "קרייזי" → +1 (smash)
//   Topping "אקסטרה קציצה" → +1 regular patty per topping
//   Egg ("ביצת עין"):
//     - +1 per topping
//     - "אבישי שחוט לי פרה" includes one by default → +1
//   Roastbeef strips ("רצועות רוסטביף"):
//     - +1 per topping
//     - "אבישי שחוט לי פרה" includes by default → +1
//   Buns: +1 per main item.
//   Gluten-free bun (removal "לחמניה ללא גלוטן" / topping "ללא גלוטן"):
//     - swap one regular bun → gluten-free
//
// Items NOT shown in summary (already prepped / assembled at last second):
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
}

// ---------- helpers ----------

const isSmashName = (name: string): boolean =>
  /סמאש|קרייזי/.test(name);

const isDoubleName = (name: string): boolean =>
  /כפולה/.test(name);

// "Avishai" burger ships with egg + roastbeef built-in.
const isAvishai = (name: string): boolean =>
  /אבישי|שחוט לי פרה/.test(name);

// Items that SHOULDN'T add a patty/bun (drinks, sides, sauces).
const isNonBurgerItem = (name: string): boolean =>
  /צ'?יפס|טבעות|מיקס|פחית|בקבוק|בירה|ויינשטפאן|קולה|זירו|פאנטה|ספרייט|בלו|גולדסטאר|הייניקן|קורונה|קאלסברג|לאפ|גינס|אנפילטר|מים/.test(name);

const includesAny = (arr: string[] | null | undefined, needles: string[]): number => {
  if (!arr || arr.length === 0) return 0;
  let n = 0;
  for (const t of arr) {
    for (const needle of needles) {
      if (t.includes(needle)) n++;
    }
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

  for (const it of items) {
    const qty = it.quantity || 1;
    const name = it.item_name;

    // ---- deal items (family-deal / friends-deal) ----
    if (it.deal_burgers && Array.isArray(it.deal_burgers)) {
      for (const b of it.deal_burgers) {
        const bn = String(b?.name || "");
        if (isSmashName(bn)) {
          smashPatties += qty;
        } else if (isDoubleName(bn)) {
          regularPatties += 2 * qty;
        } else {
          regularPatties += qty;
        }
        if (isAvishai(bn)) {
          eggs += qty;
          roastbeef += qty;
        }
        regularBuns += qty;
      }
      continue;
    }

    // ---- skip pure non-burger items (drinks, sides) ----
    if (isNonBurgerItem(name)) continue;

    // ---- patties ----
    if (isSmashName(name)) {
      smashPatties += qty;
    } else if (isDoubleName(name)) {
      regularPatties += 2 * qty;
    } else {
      regularPatties += qty;
    }

    // ---- bun (1 per main item) ----
    regularBuns += qty;

    // ---- built-in extras for "Avishai" ----
    if (isAvishai(name)) {
      eggs += qty;
      roastbeef += qty;
    }

    // ---- topping-driven extras ----
    const extraPatty = includesAny(it.toppings, ["אקסטרה קציצה"]);
    regularPatties += extraPatty * qty;

    const extraEgg = includesAny(it.toppings, ["ביצת עין"]);
    eggs += extraEgg * qty;

    const extraRb = includesAny(it.toppings, ["רצועות רוסטביף", "רוסטביף"]);
    roastbeef += extraRb * qty;

    // ---- gluten-free bun swap ----
    const glutenFreeFlag =
      includesAny(it.removals, ["ללא גלוטן", "גלוטן"]) +
      includesAny(it.toppings, ["ללא גלוטן"]);
    if (glutenFreeFlag > 0) {
      const swap = Math.min(glutenFreeFlag * qty, regularBuns);
      regularBuns -= swap;
      glutenFreeBuns += swap;
    }
  }

  return { regularPatties, smashPatties, eggs, roastbeef, regularBuns, glutenFreeBuns };
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
    if (existing) {
      existing.totalQty += it.quantity;
    } else {
      map.set(k, { key: k, item: it, totalQty: it.quantity });
    }
  }
  return Array.from(map.values());
}

// ---------- HTML builder ----------

const orderTypeLabel = (source: string): string => {
  if (source === "kiosk" || source === "station") return "🍽️  ישיבה במקום";
  return "🛍️  איסוף עצמי";
};

export function buildReceiptHtml(order: ReceiptOrder): string {
  const merged = mergeItems(order.order_items);
  const summary = computeChefSummary(order.order_items);
  const isCash = order.payment_method === "cash";

  const time = new Date(order.created_at).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = new Date(order.created_at).toLocaleDateString("he-IL");

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
          let bLine = `המבורגר ${i + 1}`;
          if (b.name) bLine += `: ${b.name}`;
          if (b.removals?.length > 0) bLine += ` — ללא ${b.removals.join(", ")}`;
          html += `<div class="sub">• ${escapeHtml(bLine)}</div>`;
        });
        html += `<div class="sub">• צ׳יפס ענק</div>`;
      }
      if (it.deal_drinks && Array.isArray(it.deal_drinks)) {
        it.deal_drinks.forEach((d: any) => {
          html += `<div class="sub">• ${escapeHtml(d.name)}</div>`;
        });
      }
      html += `</div>`;
      return html;
    })
    .join("");

  // Chef summary block
  const summaryRows: string[] = [];
  if (summary.regularPatties > 0) summaryRows.push(`<div class="sum-row"><span>קציצות רגילות</span><span class="sum-num">${summary.regularPatties}</span></div>`);
  if (summary.smashPatties > 0) summaryRows.push(`<div class="sum-row"><span>קציצות סמאש</span><span class="sum-num">${summary.smashPatties}</span></div>`);
  if (summary.eggs > 0) summaryRows.push(`<div class="sum-row"><span>ביצי עין</span><span class="sum-num">${summary.eggs}</span></div>`);
  if (summary.roastbeef > 0) summaryRows.push(`<div class="sum-row"><span>רצועות רוסטביף</span><span class="sum-num">${summary.roastbeef}</span></div>`);
  if (summary.regularBuns > 0) summaryRows.push(`<div class="sum-row"><span>לחמניות</span><span class="sum-num">${summary.regularBuns}</span></div>`);
  if (summary.glutenFreeBuns > 0) summaryRows.push(`<div class="sum-row gf"><span>לחמניות ללא גלוטן</span><span class="sum-num">${summary.glutenFreeBuns}</span></div>`);

  const summaryHtml = summaryRows.length > 0
    ? `<div class="summary">
         <div class="summary-title">סיכום לטבח</div>
         ${summaryRows.join("")}
       </div>`
    : "";

  const paymentLine = isCash
    ? `<div class="warn">⚠️  לא שולם — מזומן בעת המסירה</div>`
    : `<div class="paid">✓  שולם באשראי</div>`;

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
  body { width: 76mm; padding: 4mm; font-size: 14pt; line-height: 1.35; }
  .order-num {
    text-align: center;
    font-size: 36pt;
    font-weight: 900;
    line-height: 1;
    margin: 0 0 4px;
  }
  .order-num small { font-size: 14pt; font-weight: 700; }
  .meta {
    text-align: center;
    font-size: 14pt;
    font-weight: 700;
    border-bottom: 2px solid #000;
    padding-bottom: 6px;
    margin-bottom: 8px;
  }
  .type {
    text-align: center;
    font-size: 18pt;
    font-weight: 900;
    background: #000; color: #fff;
    padding: 6px 0;
    margin-bottom: 10px;
    letter-spacing: 1px;
  }
  .customer {
    border-bottom: 1px dashed #000;
    padding-bottom: 6px;
    margin-bottom: 8px;
    font-size: 13pt;
  }
  .customer .name { font-weight: 900; font-size: 16pt; }
  .notes {
    border: 2px solid #000;
    padding: 6px 8px;
    margin: 6px 0 10px;
    font-weight: 700;
    font-size: 14pt;
  }
  .line {
    border-bottom: 1px dashed #000;
    padding: 8px 0;
    page-break-inside: avoid;
  }
  .line:last-of-type { border-bottom: 2px solid #000; }
  .line-name {
    font-size: 18pt;
    font-weight: 900;
    line-height: 1.2;
  }
  .sub {
    font-size: 13pt;
    font-weight: 600;
    padding-right: 10px;
    margin-top: 2px;
  }
  .summary {
    border: 3px solid #000;
    margin-top: 12px;
    padding: 10px;
    background: #000; color: #fff;
  }
  .summary-title {
    text-align: center;
    font-size: 18pt;
    font-weight: 900;
    border-bottom: 2px solid #fff;
    padding-bottom: 6px;
    margin-bottom: 8px;
    letter-spacing: 1px;
  }
  .sum-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 16pt;
    font-weight: 800;
    padding: 4px 0;
  }
  .sum-row.gf {
    border-top: 1px dashed #fff;
    padding-top: 6px;
    margin-top: 4px;
  }
  .sum-num {
    font-size: 22pt;
    font-weight: 900;
    min-width: 32px;
    text-align: center;
    background: #fff; color: #000;
    border-radius: 4px;
    padding: 2px 8px;
  }
  .warn {
    border: 3px solid #000;
    text-align: center;
    font-size: 16pt;
    font-weight: 900;
    padding: 8px;
    margin-top: 10px;
  }
  .paid {
    text-align: center;
    font-size: 13pt;
    font-weight: 700;
    margin-top: 10px;
  }
  .footer {
    text-align: center;
    font-size: 11pt;
    margin-top: 8px;
    color: #000;
  }
  @media print {
    body { width: auto; }
  }
</style>
</head>
<body>
  <div class="order-num">#${order.order_number}<br/><small>${time} · ${date}</small></div>
  <div class="type">${orderTypeLabel(order.order_source)}</div>

  <div class="customer">
    <div class="name">${escapeHtml(order.customer_name)}</div>
    <div>📞 ${escapeHtml(order.customer_phone)}</div>
  </div>

  ${order.notes ? `<div class="notes">📝 ${escapeHtml(order.notes)}</div>` : ""}

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
  // Give the browser a tick to render fonts before printing.
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch (e) {
      console.warn("[receipt] print failed", e);
    }
  }, 250);
}
