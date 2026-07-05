// Kitchen prep calculator for event bookings.
// All numeric values live in event_settings.kitchen_prep so the kitchen can
// tune them without a code change.

export interface KitchenPrepSettings {
  tomato_g: number;
  onion_g: number;
  pickles_g: number;
  lettuce_g: number;
  chips_g: number;
  potatoes_g: number;
  onion_rings_g: number;
  waffle_g: number;
  default_eggs_per_guest: number;
  default_dessert_per_guest: number;
}

export const DEFAULT_PREP_SETTINGS: KitchenPrepSettings = {
  tomato_g: 43,
  onion_g: 13,
  pickles_g: 20,
  lettuce_g: 20,
  chips_g: 250,
  potatoes_g: 250,
  onion_rings_g: 220,
  waffle_g: 220,
  default_eggs_per_guest: 1,
  default_dessert_per_guest: 1,
};

export interface EventBookingLike {
  id: string;
  customer_name: string;
  customer_phone?: string | null;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  event_type?: string | null;
  event_address?: string | null;
  at_venue?: boolean | null;
  guests_count: number;
  package_id: string;
  package_name: string;
  veg_count?: number | null;
  vegan_count?: number | null;
  gf_count?: number | null;
  no_bun_count?: number | null;
  kids_count?: number | null;
  eggs_count?: number | null;
  onion_jam_count?: number | null;
  fried_onion_count?: number | null;
  chili_count?: number | null;
  dessert_count?: number | null;
  kitchen_notes?: string | null;
}

export type PackageTier = "classic" | "upgraded" | "premium" | "meat" | "other";

export function tierOf(packageId: string): PackageTier {
  if (packageId === "classic") return "classic";
  if (packageId === "upgraded") return "upgraded";
  if (packageId === "premium" || packageId === "all-inclusive") return "premium";
  if (packageId === "meat-bar") return "meat";
  return "other";
}

export interface PrepResult {
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
  tier: PackageTier;
}

const g2kg = (g: number) => Math.round(g) / 1000;

export function computePrep(b: EventBookingLike, s: KitchenPrepSettings): PrepResult {
  const guests = Math.max(0, b.guests_count || 0);
  const veg = Math.max(0, b.veg_count || 0);
  const vegan = Math.max(0, b.vegan_count || 0);
  const gf = Math.max(0, b.gf_count || 0);
  const noBun = Math.max(0, b.no_bun_count || 0);
  const tier = tierOf(b.package_id);

  const regularPatties = Math.max(0, guests - veg - vegan);
  const regularBuns = Math.max(0, guests - gf - noBun);
  const gfBuns = gf;

  // Vegetables — computed per burger portion (guests, regardless of variant)
  const burgersForVeg = guests;
  const tomatoG = burgersForVeg * s.tomato_g;
  const onionG = burgersForVeg * s.onion_g;
  const lettuceG = burgersForVeg * s.lettuce_g;
  const picklesG = burgersForVeg * s.pickles_g;

  // Fried sides
  let chipsG = 0;
  let potatoesG = 0;
  let ringsG = 0;
  let waffleG = 0;
  if (tier === "classic") {
    // כל סועד מקבל מנת צ׳יפס מלאה
    chipsG = guests * s.chips_g;
  } else if (tier === "upgraded" || tier === "premium") {
    // חלוקה שווה בין צ׳יפס / וופל צ׳יפס / טבעות בצל
    const perThird = guests / 3;
    chipsG = perThird * s.chips_g;
    ringsG = perThird * s.onion_rings_g;
    waffleG = perThird * s.waffle_g;
  }

  // Premium-only extras — default = per-guest, but manual counts win when set.
  const isPremium = tier === "premium";
  const eggs = isPremium
    ? b.eggs_count ?? Math.round(guests * s.default_eggs_per_guest)
    : 0;
  const desserts = isPremium
    ? b.dessert_count ?? Math.round(guests * s.default_dessert_per_guest)
    : 0;
  const onionJam = isPremium ? b.onion_jam_count ?? 0 : 0;
  const friedOnion = isPremium ? b.fried_onion_count ?? 0 : 0;
  const chili = isPremium ? b.chili_count ?? 0 : 0;

  return {
    guests,
    regularPatties,
    vegPatties: veg,
    veganPatties: vegan,
    regularBuns,
    gfBuns,
    tomatoKg: g2kg(tomatoG),
    onionKg: g2kg(onionG),
    lettuceKg: g2kg(lettuceG),
    picklesKg: g2kg(picklesG),
    chipsKg: g2kg(chipsG),
    potatoesKg: g2kg(potatoesG),
    onionRingsKg: g2kg(ringsG),
    waffleKg: g2kg(waffleG),
    eggs,
    onionJam,
    friedOnion,
    chili,
    desserts,
    tier,
  };
}

const kg = (v: number) => (v > 0 ? `${v.toFixed(2)} ק״ג` : "—");

export function buildPrepHtml(b: EventBookingLike, r: PrepResult): string {
  const dt = new Date(b.event_date + "T00:00:00");
  const dateStr = dt.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeStr = [b.start_time, b.end_time].filter(Boolean).join(" - ");
  const place = b.at_venue ? "אצלנו במקום (המבורגר הבקתה)" : (b.event_address || "");

  const row = (label: string, val: string) =>
    `<tr><td class="lbl">${label}</td><td class="val">${val}</td></tr>`;

  const showFried = r.tier === "upgraded" || r.tier === "premium";
  const showPremium = r.tier === "premium";

  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"/>
<title>בון הכנות — ${b.customer_name}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: 'Heebo', Arial, sans-serif; color: #000; margin: 0; padding: 10px; }
  h1 { text-align: center; font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 12px 0 4px; border-bottom: 2px dashed #000; padding-bottom: 2px; }
  .hdr { text-align: center; margin-bottom: 8px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 3px 2px; vertical-align: top; }
  td.lbl { font-weight: 600; width: 55%; }
  td.val { text-align: left; font-weight: 700; }
  .notes { margin-top: 8px; padding: 6px; border: 1px solid #000; font-size: 13px; white-space: pre-wrap; }
  .tag { display: inline-block; padding: 1px 6px; border: 1px solid #000; border-radius: 4px; font-size: 12px; margin-inline-end: 4px; }
  .muted { color: #444; font-size: 12px; text-align: center; margin-top: 8px; }
  @media print { .noprint { display: none } }
</style></head>
<body>
  <h1>🎉 בון הכנות אירוע</h1>
  <div class="hdr">
    <div><b>${b.customer_name}</b></div>
    <div>${dateStr}${timeStr ? " • " + timeStr : ""}</div>
    <div>${b.event_type || ""}</div>
    <div>${place}</div>
    <div><span class="tag">${b.package_name}</span><span class="tag">${r.guests} סועדים</span></div>
  </div>

  <h2>🍔 קציצות ולחמניות</h2>
  <table>
    ${row("קציצה רגילה (בשר)", String(r.regularPatties))}
    ${r.vegPatties > 0 ? row("קציצה צמחונית", String(r.vegPatties)) : ""}
    ${r.veganPatties > 0 ? row("קציצה טבעונית", String(r.veganPatties)) : ""}
    ${row("לחמניות רגילות", String(r.regularBuns))}
    ${r.gfBuns > 0 ? row("לחמניות ללא גלוטן", String(r.gfBuns)) : ""}
  </table>

  <h2>🥬 ירקות</h2>
  <table>
    ${row("עגבנייה", kg(r.tomatoKg))}
    ${row("בצל", kg(r.onionKg))}
    ${row("חסה", kg(r.lettuceKg))}
    ${row("חמוצים", kg(r.picklesKg))}
  </table>

  <h2>🍟 מטוגנים</h2>
  <table>
    ${row("צ׳יפס", kg(r.chipsKg))}
    ${showFried ? row("פוטטוס", kg(r.potatoesKg)) : ""}
    ${showFried ? row("טבעות בצל", kg(r.onionRingsKg)) : ""}
    ${showFried ? row("וופל צ׳יפס", kg(r.waffleKg)) : ""}
  </table>

  ${showPremium ? `<h2>✨ תוספות מפנק</h2>
  <table>
    ${row("ביצי עין", String(r.eggs))}
    ${row("ריבת בצל (מנות)", String(r.onionJam))}
    ${row("בצל מטוגן (מנות)", String(r.friedOnion))}
    ${row("פלפל חריף מטוגן (מנות)", String(r.chili))}
    ${row("קינוח (מנות)", String(r.desserts))}
  </table>` : ""}

  ${b.kitchen_notes ? `<div class="notes"><b>הערות:</b><br/>${b.kitchen_notes}</div>` : ""}

  <div class="muted">הופק אוטומטית • ${new Date().toLocaleString("he-IL")}</div>
  <div class="noprint" style="text-align:center; margin-top:12px">
    <button onclick="window.print()" style="padding:8px 14px; font-size:14px">הדפס</button>
  </div>
  <script>setTimeout(function(){ try { window.focus(); window.print(); } catch(e){} }, 300);</script>
</body></html>`;
}

export function openPrepWindow(b: EventBookingLike, s: KitchenPrepSettings): void {
  const r = computePrep(b, s);
  const html = buildPrepHtml(b, r);
  const w = window.open("", "_blank", "width=520,height=800");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
