---
name: Soldier fund ("הזמן חייל/ת")
description: Checkout donation to a soldier fund; credited when order is paid; kitchen/dashboard pay orders from fund; public counter
type: feature
---
- Offered at checkout on website AND kiosk: buttons 5,10,20,30,40,50,60 or custom, max 1,000₪.
- Added to the order total; any payment method. Credited to fund only when the order is actually paid (paid_at set) — credit confirmed, or cash/paybox marked paid.
- Fund balance managed by owner; kitchen AND dashboard can mark an order "paid from soldier fund" (deducts order total).
- Public transparency: show total collected + number of soldiers fed.
- Accounting: donation is NOT revenue when received (not a legal donation — prepayment); revenue counted when fund pays an order. Advise accountant re VAT timing.
- Entry page (HeroSection): prominent "פנק חייל/ת 🫡" button + "איך זה עובד?" below it (SoldierFundHowItWorks dialog) — shows even when closed for orders.
- Donor MUST approve the regulation (תקנון, soldier-fund-v1) before donating: checkbox in SoldierDonation at checkout; enforced in create-order (400 without soldierFundTermsAcceptedAt) and logged to consent_events as kind "soldier_fund". Entry-page approval cached in localStorage key soldier-fund-terms-approved-v1 (display only — real proof is server-side).
- Regulation text is a DRAFT in SoldierFundHowItWorks.tsx — owner will send final wording.
- Name everywhere is exactly "הזמן חייל/ת" (🫡) — no "קופת חיילים"/"פנק חייל".
- Kitchen toggle restaurant_status.soldier_fund_enabled: off → hidden on entry page + checkout, server rejects donations.
- Entry page dialog lets donor pick amount + approve, then "continue to order" (prefills checkout) or "donation only" (credit only, orders.donation_only → auto-completed, no kitchen/bon number).
- Payment buttons disabled until regulation approved; regulation window opens automatically on choosing an amount.
