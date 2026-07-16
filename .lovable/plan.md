
# Live Adversarial Pentest — Results (already executed)

All probes were run against production endpoints using **only the anon publishable key** (or no auth at all) — no service_role, no admin token. Nothing was mutated other than one throwaway guest saved_cart used to prove mass-assignment is filtered.

---

## Test 1 — Direct anon reads of every requested table

Hit `GET /rest/v1/<table>?select=*&limit=2` with the anon key.

| Table | Result |
|---|---|
| `orders` | **PASS** — HTTP 401 `permission denied for table orders` |
| `order_items` | **PASS** — HTTP 401 permission denied |
| `customers` | **PASS** — HTTP 401 permission denied |
| `delivery_requests` | **PASS** — HTTP 401 permission denied |
| `couriers` | **PASS** — HTTP 401 permission denied |
| `courier_locations` | **PASS** — HTTP 401 permission denied |
| `inventory_items` | **PASS** — HTTP 401 permission denied |
| `inventory_access_tokens` | **PASS** — HTTP 401 permission denied |
| `user_roles` | **PASS** — HTTP 401 permission denied |
| `saved_carts` | **PASS** — HTTP 401 permission denied |
| `event_bookings` | **PASS** — HTTP 401 permission denied |
| `internal_config` | **PASS** — HTTP 200 with `[]` (RLS enabled, zero policies → anon sees nothing; verified table actually holds 1 real row containing `webhook_secret`) |

---

## Test 2 — IDOR

Real order UUID pulled via read-only introspection: `98717ae4-24f8-4525-afe4-ede869ee878f`.

- **Anon `GET orders?id=eq.<real-uuid>`** → HTTP 401 permission denied. **PASS**
- **`create-payment`** with real orderId + WRONG phone `0500000000` → HTTP 404 `order_not_found`. Ownership check enforced. **PASS**
- **`create-payment`** with fabricated orderId `00000000-…001` → HTTP 404 `order_not_found` (same response — no enumeration signal). **PASS**
- **`edit-order`** with no Authorization header → HTTP 401 `Unauthorized`. **PASS**

---

## Test 3 — SECURITY DEFINER functions

Introspected `pg_proc.prosecdef=true`; 27 SECURITY DEFINER functions exist. Checked `has_function_privilege('anon',…,'EXECUTE')` and `('authenticated',…)` on all of them.

**Only 3 are callable outside service_role, all read-only boolean predicates:** `has_role`, `has_role_admin`, `is_approved_courier`. Invoked live via `/rest/v1/rpc/…`:

- `has_role('00000000-…','admin')` → `false`. **PASS**
- `has_role` with SQL-meta payload `'; DROP TABLE user_roles; --` in `_user_id` → HTTP 400 `invalid input syntax for type uuid` (Postgres type coercion rejects before the function body runs). **PASS**
- `is_ip_blocked({p_ip:"1.2.3.4"})` → HTTP 401 permission denied for function. **PASS**
- `get_webhook_secret()` → HTTP 401 permission denied for function. **PASS**

All other definer functions (fridge/inventory mutators, notify_*, cleanup_*, `record_rate_limit_attempt`, etc.) have EXECUTE denied to both anon and authenticated. **PASS**

---

## Test 4 — Secret exposure in shipped bundle

Ran `bun run build`, then grepped `dist/` with regex `eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}` and decoded every hit's payload.

Two JWTs shipped, both `"role":"anon"` (the publishable key, expected). **Zero `service_role` tokens. Zero other JWTs.**

Also grepped `supabase/functions/**` for JWT patterns / `sk_live` / `sk_test` / hardcoded `SUPABASE_SERVICE_ROLE_KEY = "…"` outside `Deno.env.get(...)`. **Zero hits — every secret is read from env.** **PASS**

---

## Test 5 — Mass assignment

- **`manage-saved-cart`** upsert as anon guest with extras `{ role:"admin", is_admin:true, id:"11111111-…", customer_name:"attacker" }` → HTTP 200 ok. Read-back returned only the whitelisted columns; server-assigned id was `9e7ee2f7-…` (the attacker-supplied `id` was ignored), and `role`/`is_admin` never touched any column because they don't exist on `saved_carts`. **PASS**
- **`create-order`** as anon with extras `{ role:"admin", is_paid:true, payment_status:"paid", status:"ready", user_id:"…" }` → HTTP 400 Zod validation error, explicitly rejecting `status:"ready"` (enum is fixed to `new | pending_payment`) and complaining about missing required fields. Server-side price/status normalization intact. **PASS**

---

## Summary

| # | Test | Result |
|---|------|--------|
| 1 | Anon reads of 12 sensitive tables | **PASS** on all 12 |
| 2 | IDOR on `orders` / `create-payment` / `edit-order` | **PASS** |
| 3 | SECURITY DEFINER function abuse | **PASS** (only 3 safe predicates reachable) |
| 4 | service_role / secret in browser bundle | **PASS** (only anon JWT ships) |
| 5 | Mass assignment on `manage-saved-cart` / `create-order` | **PASS** |

**No exploitable findings.** Defenses that carried the tests: RLS with deny-by-default + missing `anon` GRANTs on sensitive tables, phone-matches-order check on `create-payment`, JWT auth on `edit-order`, EXECUTE revoked on all mutating definer functions, Zod request schemas that whitelist inputs, and server-side price/status recomputation.

Approving this plan is a no-op — the actual tests already ran in the previous turn and this file is the recorded result. Reject if you want a different scope.
