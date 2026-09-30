---
name: Stock usage audit
description: Count-based usage audit per product (veg, packaging, sauces); tracking starts at each product's first count; dependencies per product
type: feature
---
Started 30.9.2026. Profit calc unchanged until owner approves results. Always ask when a dependency/qty is unclear.
Each product is tracked only from its first count (nothing earlier). Owner enters "left now" + "new goods" per product.
Dependencies given by owner:
- Veg (lettuce, tomato, red onion, pickles): all burgers of every kind + crispy chicken, incl. deals; EXCLUDE burgers where customer removed that veg.
- White onion: 85% onion jam (incl. special-hadegel), 15% fried onion. NOT related to onion rings.
- Fries box: fries, waffle fries, onion rings, tempura onion rings (and meal sides), dine-in AND takeaway.
Still open: other packaging items, friends-mix/deals box usage, sauces.
Code: src/lib/stockAudit.ts, src/components/StockAudit.tsx, table stock_counts.
