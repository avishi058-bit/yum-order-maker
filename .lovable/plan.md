# IDOR / BOLA audit — findings only (no code changes proposed)

Scope: every customer-facing edge function + tables reachable via public URLs. Staff-only endpoints (`edit-order`, `create-order` admin paths, `inventory-action` under `admin` scope) are noted where relevant but not the primary focus.

---

## 1. Object-level authorization (does the caller own THIS record?)

### ✅ Solid
- **`get-order-by-token`** — requires `order_number` **AND** matching `customer_phone` on the row. Rate-limited 10/15min per IP. Wrong phone returns the same `not_found` as missing order (no oracle). Strips `customer_phone` from the response.
- **`get-customer-orders`** — requires a valid `deviceToken` (≥32 chars) → resolves the customer row → filters `orders` by that customer's phone (with all phone-format variants). No way to pass an order id/phone parameter.
- **`manage-saved-cart`** — phone-keyed access requires `device_token` proving ownership of that phone (verified against `customers`). Guest-keyed access requires a `guest_id` that matches a UUID/high-entropy regex, blocking sequential guesses like `guest-1`. Guest_id is generated with `crypto.randomUUID` on the client.
- **`cancel-delivery-request`** — requires `id` + matching `client_token` (UUID stored on the row) and only touches rows still in `pending`/`claimed`. Direct anon UPDATE on the table is blocked by RLS.
- **`edit-order`** — validates a real Supabase JWT, resolves the user, and requires `admin` or `kitchen` role from `user_roles`. Manual discount field is admin-only. Prices are always recomputed server-side; client-supplied `price` is ignored.
- **`customer-auth`** — every sensitive action is rate-limited by IP (`register` 5/h, `login` 10/h, `auto-login` 60/h, `link-from-order` 5/h). Device tokens are 32 random bytes.
- **`inventory-action`** — every call requires a row in `inventory_access_tokens` that isn't revoked/expired; financial actions (`stats`, token management) require `scope='admin'`. This is a shared-admin-token model rather than per-user, which is fine for a single-tenant kitchen tool.
- **Table RLS** — `customers`, `orders`, `order_items`, `saved_carts`, `delivery_requests`, `courier_locations`, `couriers`, `user_roles`, `blocked_ips` are all closed to anon; role-scoped for authenticated. The `enforce_courier_delivery_update` trigger blocks couriers from mutating anything on `delivery_requests` besides `status`/`courier_id` — a real column-level defence.

### ⚠️ Real gaps

**G1. `create-payment` has no ownership check on the target order.**
It looks up `orders` by `orderId` and verifies `total` matches, but does **not** verify the caller is the customer who placed that order (no `customer_phone`/device_token/JWT check).
- Impact: anyone who guesses an order UUID (unpredictable, so hard) can spawn a Z-Credit checkout session pointing at that order id. Because the success/callback URLs are hard-coded server-side and `payment-callback` requires a shared secret, they cannot hijack the payment result — but they *could* pay someone else's order or use the endpoint to generate arbitrary Z-Credit sessions with a target's name/phone in `AdditionalText`.
- Severity: **low** (needs the UUID, and worst case is "someone paid your bill"), but it's the one endpoint that fetches-by-id without proving relationship. Worth documenting or tightening.

**G2. `create-delivery-request` accepts arbitrary customer_name/phone/address from the caller.**
No ownership check — that's by design (guest checkout creates the row and gets back a `client_token`). But it means an attacker can spam pending delivery rows tied to *any* phone/name they choose. Only mitigation today is IP rate-limit (10/10min).
- Severity: **low** (nuisance / social-engineering seed), not a classical IDOR.

**G3. `inventory-action` — single shared token, no per-actor identity.**
If any admin token leaks (URL bookmark, screenshot, browser history), full stock control + P&L stats are exposed. Tokens support `expires_at`/`revoked_at`/`scope`, so mitigation exists, but there is no per-user attribution in `inventory_movements` for token-authenticated writes.
- Severity: **medium** — token model, not IDOR per se, but worth flagging in the same category.

---

## 2. Data minimization (are responses returning only what the screen needs?)

### ✅ Solid
- **`get-order-by-token`** — response explicitly `delete`s `customer_phone` before sending. Fields returned are exactly what the tracker renders (name, status, total, estimated_ready_at, timestamps).
- **`get-customer-orders`** — returns only the customer's own rows; item projection is a whitelist (`item_id, item_name, price, quantity, toppings, removals, with_meal, meal_side, meal_drink, deal_burgers, deal_drinks`). No `cost`, no internal notes about *other* customers.
- **`manage-saved-cart`** returns the caller's own saved cart only (filtered by `identityColumn`/`identityValue`).
- **`inventory-action` list actions** — financial fields (`unit_cost`, revenue in `stats`) gated behind `scope='admin'`. `inventory` scope tokens cannot read P&L.

### ⚠️ Real gaps

**M1. `get-customer-orders` returns `notes` and `payment_method`.**
These are the customer's *own* fields, so it's not a cross-tenant leak, but `notes` sometimes contains staff/internal free text written from the kitchen UI. If kitchen ever writes non-customer-facing remarks there, the customer sees them. Confirm intent, or split into `customer_notes` vs `internal_notes`.
- Severity: **low**, depends on how staff use the field.

**M2. `manage-saved-cart` "get" uses `select("*")`.**
Returns every column of the row (including `resumed_count`, `last_action`) to the client. Not sensitive today, but a `SELECT *` shape is fragile — any future column added to `saved_carts` is exposed automatically.
- Severity: **low** (hygiene).

**M3. Courier reads via RLS (not an edge function).**
`delivery_requests` policy for couriers grants full-row SELECT on rows they claimed (or are pending for their approval). That includes `payout` and `price`, meaning a courier sees both what the customer paid and what they get — which may or may not be desired (margin transparency). Also `customer_phone` and `address` are exposed post-claim (necessary), but the entire row is exposed pre-claim on pending rows in some flows. Worth reviewing the exact `USING` clauses if you want to hide margin.
- Severity: **low** (business decision, not a security bug).

---

## 3. Unpredictable IDs on public-facing lookups

### ✅ Solid
- `orders.id`, `delivery_requests.id`, `delivery_requests.client_token`, `saved_carts.id`, `customers.id`, `customers.device_token` — all UUID / 32-byte random.
- `inventory_access_tokens.token` — server-generated (min 16 char guard on the reader).
- `guest_id` in localStorage — `crypto.randomUUID()`, and the server-side regex rejects short/sequential guesses.

### ⚠️ Real gaps

**I1. `orders.order_number` is a 4-digit integer per day (`1000-9999`).**
This is what appears in the public tracking URL (`/track?order=1234&phone=...`). Alone it's guessable, but the lookup requires a matching `customer_phone` and IP rate-limit is 10/15min. So it is defence-in-depth, not defence-alone.
- Severity: **low** (mitigated by phone match + rate limit + attack-mode auto-block), but by strict "unpredictable IDs" criterion this is the one guessable public identifier.

**I2. `guest_id` lives in `localStorage`.**
UUIDs are unpredictable, but anyone who reads the device (shared kiosk, XSS in a third-party script) can steal a guest's cart. Not IDOR — noted for completeness.

**I3. `inventory_access_tokens.token` length not enforced by CHECK/GENERATED.**
The reader requires ≥16 chars but the column is free `text`. If a token were ever inserted manually with a short value it would pass. Add a length/format constraint.
- Severity: **very low** (operational).

---

## Summary — one-line verdicts

| Concern | Verdict |
|---|---|
| Object-level auth on customer-facing reads | Strong (phone+order_number, device_token, client_token, RLS). |
| Object-level auth on customer-facing writes | Strong for edits (staff-only) and cancellations (client_token). |
| Object-level auth on `create-payment` | **Gap G1** — no ownership binding beyond order-total match. |
| Data minimization on lookup APIs | Mostly explicit whitelists; two `SELECT *` / free-text notes gotchas (M1, M2). |
| Data minimization for couriers | Full-row RLS SELECT includes `payout`/`price` (M3). |
| Public IDs unpredictable | UUIDs everywhere except `order_number` (4-digit, phone-gated, rate-limited) (I1). |

No changes made — this is a findings-only report. Say the word if you want me to switch to build mode and address any of G1–I3 specifically.
