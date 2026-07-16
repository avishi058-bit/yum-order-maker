# Client-side exposure audit (dev-tools / network / storage)

Scope: what an anonymous or normally-authenticated visitor sees via browser dev tools during normal use — no crafted requests. Findings only; nothing changed yet.

## Summary table

| # | Where | What leaks | Severity | Real risk |
|---|---|---|---|---|
| F1 | `delivery_requests` read on courier page — `select("*")` | `client_token` (customer's private tracking token) visible to every approved courier for every pending/own request | **Medium-High** | A courier can impersonate/track any customer's delivery via the tracking link |
| F2 | `event_settings` — public `select("*")` on `/events` booking page | `kitchen_prep` (internal kitchen prep notes) served to anon visitors | Low-Medium | Internal ops text exposed; not a credential |
| F3 | `couriers` — `select("*")` on courier's own row | `approved_by` (admin's user UUID), `user_id` sent to the courier's browser | Low | UUID enumeration only; not directly exploitable |
| F4 | `site_settings` — `select("*")` in `useSiteSettings.ts` | All 22 columns to anon | **None** | Every column is public-facing theme/hours/banner config — verified, no secrets |
| F5 | `localStorage` `habakta_customer` | Full customer object incl. `phone`, `loginCount`, `lastLoginAt`, `favoriteItems`, `device_token` (separate key) | Low (by design) | Standard device-token auth; only readable by same-origin JS. Worth being aware but not a bug |
| F6 | `menu.ts` bundled data | Only `id/name/price/description/weight/badge/image` — no cost, no margin, no SKU | **None** | Clean |
| F7 | `OrderTracking` network (`get-order-by-token`) | Already stripped `customer_phone` in prior audit | **None** | Fine |
| F8 | `custom_toppings`, `menu_availability`, `delivery_zones`, `restaurant_status` anon reads | Explicit column whitelists, no PII columns exist | **None** | Fine |
| F9 | Supabase Storage | No buckets exist in the project | **None** | N/A |
| F10 | Direct `.select("*")` calls on `event_bookings`, `orders`, `inventory_items`, `couriers` list, `event_blocked_dates`, `courier_locations` | All gated by RLS to admin/kitchen/approved-courier roles — anon sees nothing | **None** | Fine, but wide columns still reach staff browsers (not a leak to outsiders) |

## Details on the two real findings

### F1 — `client_token` leaked to couriers (Medium-High)

`src/pages/Courier.tsx:126-127` does `select("*")` on `delivery_requests`. RLS lets an approved courier see every row where `status='pending'` OR `courier_id = current_courier_id()`. That row includes `client_token` — the private token the customer uses on the public delivery tracking link. Any courier browsing the deliveries screen can read every pending customer's tracking token in the Network tab and later access/track that delivery as if they were the customer.

Fix (later, on approval): replace both `select("*")` calls with an explicit whitelist of the fields the UI actually renders (id, customer_name, customer_phone, address, zone_name, price, payout, status, order_id, created_at, courier_id, claimed_at, lat, lng) — deliberately omit `client_token`.

### F2 — `kitchen_prep` leaked on public booking page (Low-Medium)

`src/pages/EventBooking.tsx:73` calls `event_settings.select("*").eq("id",1)`. That table's SELECT policy is `qual: true` for `public` (anon). The row includes `kitchen_prep` — internal kitchen preparation instructions — which the public booking page has no reason to render. Anon visitor can see it in the Network tab.

Fix (later, on approval): change the public call to `select("contract_template, minimum_amount")` (only what EventBooking actually uses). The kitchen/admin pages that legitimately need `kitchen_prep` already select it explicitly.

## Non-findings worth being explicit about

- **`site_settings.select("*")`** was flagged in your friend's likely list, but I inspected every column: id, kiosk_font_scale, website_font_scale, primary_color, background_color, menu_item_overrides, menu_order, banner_text, banner_enabled, business_hours, kiosk_* layout knobs, google_review_url. All of this is either rendered client-side or intentionally public. No admin passwords, no secrets, no cost data. Safe as-is.
- **`localStorage.habakta_device_token`** — this is the auth material for the phone-OTP device-token flow. Storing it in localStorage is the standard tradeoff (same as any JWT-in-localStorage app). Only same-origin JS can read it; a friend "glancing at dev tools" seeing it on their own device is not a leak of anyone else's data.
- **`customer_phone` on `OrderTracking`** — already fixed in a previous pass (`get-order-by-token` strips it). Confirmed still stripped.
- **No Storage buckets exist**, so Storage-URL leakage / EXIF concerns don't apply.
- **`menu.ts` bundle** — no internal fields; only what the UI shows.

## Proposed follow-up (awaiting your go-ahead)

Two small, targeted fixes, both frontend-only (no schema changes):

1. `Courier.tsx` — replace both `select("*")` on `delivery_requests` with explicit column list (drop `client_token`).
2. `EventBooking.tsx` — narrow the `event_settings` select to `contract_template, minimum_amount`.

Everything else in the audit is already clean. Say the word and I'll implement just those two.
