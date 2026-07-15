
# Security Audit — Findings Only

Read-only audit against the repo's current state + linter + security scanner. No code changes proposed here; each finding lists the concrete file/table so you can decide what to fix.

Overall posture is **good**: earlier permissive "Anyone can read/write" RLS policies on `orders`, `order_items`, `customers`, `verification_codes`, `delivery_requests`, `event_bookings`, etc. were dropped and replaced with role/`auth.uid()`-scoped policies in later migrations. Payment flow (`create-order` → `create-payment` → `payment-callback`) recomputes prices from a shared server module and verifies a shared-secret callback token. `.env` and the client bundle are clean of private secrets.

Remaining issues below.

---

## 🔴 Critical
None currently exploitable **assuming all committed hardening migrations were applied**. If any of the "drop old permissive policy" migrations failed to run in production, several of the Medium items below jump to Critical. Verifiable with a live `pg_policies` query — flagged as an open question, not a code fix.

## 🟠 High

**H1. `edit-order` trusts client-supplied prices**
File: `supabase/functions/edit-order/index.ts` (~L133–152)
`rowsToInsert` copies `it.price` from the request and `newTotal = Σ (it.price × it.quantity)`. Unlike `create-order`, it does **not** call the shared `menu-pricing.ts` module. An admin/kitchen session (the role check on ~L56 is the only gate) can submit an edit with an arbitrary low price and permanently rewrite `orders.total`. Insider-risk, but breaks the "server recomputes prices" invariant.

**H2. `inventory-action` token model is coarse and long-lived**
Files: `supabase/functions/inventory-action/index.ts` (L1–52, L246–256), `src/App.tsx:109–110`, `src/pages/Inventory.tsx`
Full inventory CRUD + financial stats (reads `orders`/`order_items` totals) is gated by a single opaque bearer token from `inventory_access_tokens`. No per-token scoping, no expiry, no rate-limit on token guessing, and the token lives in the URL (`/inventory/:token`). Any leak of that URL (screenshot, browser history, referrer to the print agent, chat share) grants indefinite full inventory write + financial read. Route is intentionally outside `ProtectedRoute`, so this token *is* the only control.

**H3. Historical window on `inventory_access_tokens` readability**
Files: `supabase/migrations/20260614001343…sql:67–76`, `20260714235500…sql:20`
The initial migration created the tokens table without a `REVOKE`; a later migration added `REVOKE SELECT … FROM anon, authenticated`. If the intermediate state was live in production, tokens were briefly listable by any authenticated session. Needs confirmation against production `information_schema.role_table_grants`.

## 🟡 Medium

**M1. Wildcard CORS on every edge function, including internal ones**
Files: `supabase/functions/notify-couriers-new-delivery/index.ts:6`, `notify-kitchen-new-order/index.ts:9`, `send-order-ready-push/index.ts:8`, `inventory-action/index.ts:7`, and all others.
`Access-Control-Allow-Origin: *`. These endpoints are also gated by `x-internal-secret` / bearer token, so CORS `*` doesn't itself grant access, but it lets any origin probe response shape/timing. Recommend locking privileged endpoints to your own origin(s).

**M2. Delivery-requests UPDATE policy is column-unrestricted** *(from security scanner)*
Table: `public.delivery_requests` — policy `courier claim own`.
Approved couriers can `UPDATE` pending or self-claimed rows with no column whitelist, so they can rewrite `price`, `payout`, `customer_phone`, `customer_name`, `address`, etc., not just `status`/`courier_id`. Needs a `WITH CHECK` that pins non-status columns or a `BEFORE UPDATE` trigger.

**M3. `get-customer-orders` scans a global 50-row window**
File: `supabase/functions/get-customer-orders/index.ts:47–63`
Fetches the latest 50 orders across **all** customers and then filters by normalized phone in-function. Not an authz bypass (filtering happens before response), but a customer's older orders silently disappear once the shop is busy, and it wastes DB work. Recommend filtering by phone in the SQL query.

**M4. `manage-saved-cart` guest identity is client-provided**
File: `supabase/functions/manage-saved-cart/index.ts:76–81`
Trusts any `guest_id` string ≥8 chars as identity. Security depends purely on UUID entropy — no cookie/IP binding. A leaked/logged `guest_id` (analytics, referrer, error log) allows read/overwrite of that cart. Low probability but zero defense-in-depth.

**M5. Android print agent has no auth token, only loopback binding**
File: `android-print-agent/app/src/main/java/co/habakta/printagent/HttpServer.kt:1–29`
`Access-Control-Allow-Origin: *` and no shared-secret header on `/print-raw`. Loopback binding blocks remote-network abuse, but any webpage the tablet visits, or any local app, can POST base64 ESC/POS bytes and cause paper-waste / disruptive prints (CSRF-from-localhost). Add a shared-secret header the browser client also sends.

## 🟢 Low / Informational

**L1. `get-order-by-token` name is misleading**
File: `supabase/functions/get-order-by-token/index.ts`
No HMAC token — ownership is `{order_number, phone}` + 10/15-min IP rate limit + generic `not_found` response. Control is sound; name is confusing.

**L2. `dangerouslySetInnerHTML` usage is safe**
File: `src/components/ui/chart.tsx:70` — injects a static `<style>` block built from config keys, not user input. No XSS.

**L3. `.env` and client bundle are clean**
Only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY` (anon JWT), `VITE_TURNSTILE_SITE_KEY`, and a Google Maps *browser* key. No `SERVICE_ROLE`, `TWILIO_API_KEY`, `ZCREDIT_*`, `VAPID_PRIVATE_KEY`, `INTERNAL_WEBHOOK_SECRET`, or `TURNSTILE_SECRET_KEY` anywhere in `src/` or `public/`.

**L4. Admin/staff routing is properly role-gated**
`src/App.tsx`: `AdminSettings`, `AdminAvailability`, `AdminCouriers`, `EventsAdmin`, `StationSetup` → `<ProtectedRoute requiredRole="admin">`. `Kitchen`, `EventsKitchen` → `["kitchen","admin"]`. `Courier` implements its own in-page Supabase auth backed by `auth.uid()`-scoped RLS on `couriers` / `courier_locations` — functionally protected.

**L5. Payment integrity is correctly server-side**
`create-order/index.ts` computes totals from `_shared/menu-pricing.ts`; `create-payment` uses the DB total; `payment-callback` verifies a Z-Credit shared-secret token before flipping status. No client `total` is trusted along this path (only along the `edit-order` path — see H1).

**L6. RLS linter output**
Supabase linter reported 4 × "RLS enabled, no policy" INFO findings (tables not named in output). Not exploitable on its own (no policies = deny-all through Data API), but means those tables are unreachable except via `service_role`, which may be intentional (e.g., `inventory_movements`, `inventory_recipes`, `inventory_access_tokens`, `courier_locations` history) — worth eyeballing to confirm each is intentional.

---

## Open questions before deciding fixes

1. Have all committed migrations actually been applied in production, in order? (query `pg_policies` to confirm none of the old permissive policies survive)
2. For **H1** — does the order-edit UI ever legitimately send a price different from menu price (e.g., manual discounts), or should the server always recompute from `menu-pricing.ts`?
3. For **H2** — how many inventory tokens are live, are they per-user, and is there a rotation policy? This drives whether H2 should be Critical.
4. For **M5** — do you want a shared-secret header on the print agent, or is loopback-only acceptable for your kiosk hardware?

Tell me which findings you want addressed and in what order, and I'll switch to build mode and fix them.
