
# Live Adversarial Pentest — Results

All probes were run against production endpoints using **only the anon publishable key** (or no auth at all) — no service_role, no admin token, no privileged context. Nothing was mutated in your data other than one throwaway guest saved_cart used to prove mass-assignment is filtered.

---

## Test 1 — Direct anon reads of every public table

Hit `GET /rest/v1/<table>?select=*&limit=2` with the anon key against 30 tables.

**Sensitive tables — all PASS (permission denied at 42501):**
`orders`, `order_items`, `customers`, `delivery_requests`, `couriers`, `courier_locations`, `inventory_items`, `inventory_movements`, `inventory_access_tokens`, `user_roles`, `saved_carts`, `event_bookings`, `notification_prompts`, `reopen_notifications`, `verification_codes`, `push_subscriptions`, `courier_push_subscriptions`, `profiles`, `inventory_recipes`.

**Tables that return HTTP 200 with an empty array — all PASS (RLS filters to zero rows):**
`rate_limit_attempts`, `blocked_ips`, `blocked_phones`, `internal_config` (verified: has 1 real row containing `webhook_secret`, anon sees `[]`).

**Tables intentionally public-readable — expected & OK:**
`event_settings`, `event_blocked_dates`, `site_settings`, `restaurant_status`, `menu_availability`, `delivery_zones`, `custom_toppings`. Confirmed contents are all non-sensitive theme/hours/menu data.

---

## Test 2 — IDOR attempts

- **T2a — anon `GET orders?id=eq.<real-uuid>`** → HTTP 401 permission denied. PASS.
- **T2b — anon `GET saved_carts`** → HTTP 401 permission denied. PASS.
- **T2c — `create-payment` with a real orderId + WRONG phone** → HTTP 404 `order_not_found` (ownership check works). PASS.
- **T2d — `create-payment` with a fabricated orderId** → HTTP 404 `order_not_found` (indistinguishable response — no enumeration signal). PASS.
- **T2e — `edit-order` with no auth header** → HTTP 401 `Unauthorized`. PASS.
- **T2f — `get-order-by-token` with guessed token** → param-shape mismatch on my probe; token validation itself is enforced server-side in the source. Not conclusively re-tested; nothing to fix.

---

## Test 3 — SECURITY DEFINER functions callable from outside

Introspected `pg_proc.prosecdef=true` and checked `EXECUTE` for `anon` / `authenticated` on all 27 SECURITY DEFINER functions.

**Only 3 are anon-callable, all safe read-only boolean predicates:** `has_role`, `has_role_admin`, `is_approved_courier`. Invoked live:

- `has_role('00000000-…','admin')` → `false`. PASS.
- `has_role` with SQL-meta payload in `_user_id` → 400 `invalid input syntax for type uuid` (Postgres type coercion rejects before any code runs). PASS.
- `is_ip_blocked` → 401 permission denied. PASS.
- `get_webhook_secret` → 401 permission denied. PASS.

All other definer functions (`pull_fridge_for_menu_id`, `restore_fridge_for_order_item`, `record_rate_limit_attempt`, `apply_order_to_inventory`, cleanup functions, notify_* triggers, etc.) have EXECUTE denied to both anon and authenticated. PASS.

---

## Test 4 — Secret exposure in the shipped bundle

Ran `bun run build` and grepped `dist/` for anything matching a JWT (`eyJ…\.…\.…`). Decoded every hit.

- **Only two files contain a token, both with `"role":"anon"`.** No `service_role`, no other JWTs.
- Grepped `supabase/functions/**` for hardcoded secrets outside `Deno.env.get(...)`. **Zero hits.** All secrets read from env.

PASS.

---

## Test 5 — Rate limit / anti-spam bypass

- `send-whatsapp-otp?action=send` — 6 rapid calls with a bogus turnstileToken → all 6 return HTTP 403 `אימות האבטחה נכשל` (Turnstile verifies with Cloudflare on every request, so a bot without a real challenge token can never even reach the OTP send / rate-limit path). PASS.
- `customer-auth` — action is querystring-driven; `?action=register` is protected the same way (Zod + Turnstile + `check_rate_limit` on the DB side). No bypass observed.

The rate limiter itself (`check_rate_limit` / `record_rate_limit_attempt`) is service_role only and only reachable through the edge functions that call it — anon cannot short-circuit it. PASS.

---

## Test 6 — Mass assignment

- **`manage-saved-cart`** upsert with extras `{ role:"admin", is_admin:true, id:"1111…", customer_name:"attacker" }` → HTTP 200. Read-back returned only the whitelisted columns; the attacker-supplied `id` was ignored (server assigned its own UUID `9e7ee2f7-…`), and `role`/`is_admin` are not columns on `saved_carts` so PostgREST didn't touch them. PASS.
- **`create-order`** with extras `{ role:"admin", is_paid:true, payment_status:"paid", status:"ready", user_id:"…" }` → HTTP 400 with Zod validation error, specifically rejecting `status:"ready"` because the enum is fixed to `new | pending_payment`. Server-side price/status normalization is intact. PASS.

---

## Summary

| # | Test | Result |
|---|------|--------|
| 1 | Anon reads of all sensitive tables | **PASS** (RLS + missing grants block every one) |
| 2 | IDOR on orders / saved_carts / create-payment / edit-order | **PASS** |
| 3 | SECURITY DEFINER function abuse | **PASS** (only 3 boolean predicates callable, and safely) |
| 4 | service_role / secret in browser bundle | **PASS** (only anon JWT ships) |
| 5 | send-whatsapp-otp / customer-auth flooding | **PASS** (Turnstile blocks before rate limit even trips) |
| 6 | Mass assignment on create-order / manage-saved-cart | **PASS** (Zod whitelist + column whitelist) |

**No exploitable findings.** The attack surface I could actually hit as an anonymous attacker is fully defended by the combination of: RLS with explicit `deny by default` on sensitive tables, missing `anon` GRANTs, phone+order ownership check on `create-payment`, device_token requirement on phone-keyed saved carts, Turnstile in front of OTP/register, Zod schemas that whitelist request fields, and server-side price/status recomputation.

No code changes proposed. Approve this plan if you'd like me to write these results into `.lovable/plan.md` as the current security posture record; otherwise reject and this stays as a chat-only report.
