---
name: Stock usage audit
description: Count-based usage audit (veg in units, packaging, bags, sauces with box/liter conversions); dependencies per owner; profit unchanged
type: feature
---
Started 30.9.2026. Profit calc unchanged until owner approves. Always ask when a dependency/qty is unclear.
Each product tracked only from its first count; owner enters "left now" + "new goods".
Units & conversions (owner answers):
- Lettuce: counted in units (not kg). Pickles: units = cans (פחית שימורים).
- Tomato: units; invoice in kg; average 140 g → ÷0.14. Red onion: units; average 135 g → ÷0.135.
- White onion: kg; 85% onion jam (incl. special-hadegel), 15% fried onion; NOT onion rings.
- מארז לצ׳יפס: fries, waffle fries, onion rings, tempura onion rings + meal sides, dine-in AND takeaway.
- מארז צ׳יפס גדול: dedicated item for deals; 1 per family-deal / friends-deal / friends-mix.
- שקיות: takeaway orders only; audit usage vs number AND size of takeaway orders.
- קטשופ מנות & מיונז מנות: pre-portioned, takeaway ONLY; box = 996 / 900 portions; owner enters boxes.
- קטשופ פאוץ׳ (13 ליטר) & מיונז דלי (5 ק״ג): dine-in ONLY; liters (mayo entered in kg ≈ liters).
- שזיפים, צ׳ילי חריף, איולי: dine-in AND takeaway side; counted in liters from invoice; if liters missing — ask and remember product name.
Invoice scan (save_invoice) auto-enters veg lines as audit "received" (kg→units: tomato ÷0.14, red_onion ÷0.135, white_onion kept kg); kg lines without known average are skipped for manual entry. Sauces still entered manually in the audit screen.
No other sauces tracked. Drivers in audit: takeaway/dine-in orders (counted once per order) and items; side sauce toppings sold.
Code: src/lib/stockAudit.ts, src/components/StockAudit.tsx, table stock_counts.
