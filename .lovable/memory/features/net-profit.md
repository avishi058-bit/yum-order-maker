---
name: Net profit costs
description: Dashboard net profit formula and per-ingredient costs given by owner
type: feature
---
Net = revenue/1.18 − food cost − credit fee (0.78%+VAT, credit only) − monthly fixed/30 × days.
Costs (₪): patty (regular/smash 220) 8.36, bun 2.70, veg+sauces 1.50, 3 side sauces 1.00, egg 1.30, cheese slice 1.61,
onion jam/fried onion/garlic confit/pepper jam 2.00, crispy chicken 9.00, fries portion 3.50. Drinks: no cost given.
Code: src/lib/profitStats.ts; fixed costs in site_settings.monthly_fixed_costs.

Then: wages per month (site_settings.monthly_wages), accountant 350 before VAT/month; monthly costs spread by actual work days (current month: avg work days). Then minus 8% national insurance on pre-tax profit.

Takeaway packaging (only orders with dine_in=false), before VAT: fries/waffle/onion rings/tempura box 0.40 (also meal fries), paper bag 0.39, burger/crispy wrap 0.21 (incl. deal burgers). Bags: 1; >3 burgers → 2; >4 fried portions → +1. Friends deal 1 bag, family deal 2 bags (assumed). Deal giant fries = 3 portions cost, one box 0.80.

Electricity (1000₪/month) is an UNREPORTED expense — owner said remove it as a pre-tax cost; deduct it only at the very end, AFTER the 8% national insurance. profitStats.ts: `unreported` input; DashboardView filters "חשמל" out of fixed_expenses and passes it as unreported.
