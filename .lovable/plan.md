# Remaining security-checklist audit — findings only

## 1. Rate limiting coverage

**✅ Already throttled** (via `check_rate_limit` RPC, per-IP or per-phone):
- `customer-auth` — every action (register/login/auto-login/link-from-order/set-favorite/update-name/logout).
- `send-whatsapp-otp` — multi-layer: IP block check, attack-mode check, per-phone + per-IP hard/soft caps, auto-activates 24h attack mode.
- `get-order-by-token` — 10 / 15 min per IP.
- `create-order` — has both a submit cap and a duplicate-order cap.
- `create-delivery-request` — 10 / 10 min per IP.
- `calculate-delivery-price` — 30 / 10 min per IP.

**⚠️ Gaps — unthrottled customer-facing endpoints:**

- **`manage-saved-cart`** — no rate limit at all. Guest_id/device_token-gated, but a valid caller could hammer upsert/get in a loop. Low abuse risk (cost is a single row per identity, unique index prevents fanout), but no ceiling on request volume. **Real gap — low severity.**
- **`cancel-delivery-request`** — no rate limit. Requires `id` + matching `client_token` (UUID), so an attacker without the token cannot cancel anyone's delivery, but a malicious client that DID create a request can spam cancel attempts. **Very low — not really exploitable.**
- **`create-payment`** — no rate limit. Requires order UUID + matching customer_phone + matching total (after G1 fix). Realistic abuse: someone with a valid pending order spawning many Z-Credit sessions. Z-Credit is the paying-party here so cost isn't ours, but it's noise. **Low.**
- **`edit-order`** — no rate limit, but requires staff JWT + role. Not customer-facing. **Not a gap.**
- **`inventory-action`** — no rate limit, gated by admin/inventory token. **Not a gap.**

**Recommendation if you want to fix later:** add `check_rate_limit`/`record_rate_limit_attempt` to `manage-saved-cart` (say 120 / 10 min per IP) and `create-payment` (10 / 10 min per IP). Skip `cancel-delivery-request`.

## 2. Password / credential storage

- **Staff (admin/kitchen)** — `useAuth` uses `supabase.auth.signInWithPassword`. Supabase Auth stores password hashes with **bcrypt** in the managed `auth.users` table; the app never sees the hash and never handles a plaintext password beyond the login form. `Login.tsx` sends the plaintext to `signInWithPassword` over HTTPS/TLS — standard and correct.
- **Couriers** — `Courier.tsx` also uses `signInWithPassword` / `signUp`. Same guarantees.
- **Customers** — no password at all. Phone + WhatsApp OTP, with a 64-hex-char device token stored client-side for auto-login. Tokens are minted from `crypto.getRandomValues(32 bytes)`.
- **No custom password table exists** — no `passwords`, `credentials`, `secrets` columns anywhere in `public`. Grep of `password` in `src/` matches only form inputs. No plaintext storage.
- **HIBP leaked-password check** — cannot see from here whether it's enabled in the Auth config. Worth confirming in the backend Auth settings (Cloud → Users → Auth Settings → activate *Password HIBP Check*). Not a bug if off, but a nice-to-have.

**Verdict: solid, no plaintext anywhere.** Only open item is the HIBP toggle.

## 3. HTTPS enforcement

- Deployed on Lovable hosting → HTTPS-only by platform default. Both custom domain and `lovable.app` domain are served over TLS with automatic HTTP→HTTPS redirect at the edge.
- `index.html` CSP includes `upgrade-insecure-requests`, so any accidental `http://` reference is upgraded by the browser.
- No mixed content: every third-party origin in CSP (`connect-src`/`script-src`/`frame-src`) is `https://`, no bare-http entries.

**Verdict: fine, handled by hosting + CSP.**

## 4. Security headers

Set via `<meta http-equiv>` in `index.html`:
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `X-Frame-Options: DENY` (also `frame-ancestors 'none'` in CSP)
- ✅ `Referrer-Policy: strict-origin-when-cross-origin`
- ✅ CSP with tight `default-src 'self'`, allow-listed script/style/connect origins (Cloudflare Turnstile, Google Maps, Google Analytics, Z-Credit, Supabase, GPT-Engineer)
- ⚠️ `script-src` includes `'unsafe-inline'` and `'unsafe-eval'` — required by GPT-Engineer's dev script and some analytics vendors. Not tightenable without breaking those integrations.
- ⚠️ **HSTS is not set here** — but HSTS *must* be an HTTP response header, not a `<meta>` tag (browsers ignore HSTS in meta). Lovable hosting sets this at the edge; you can't set it from the app.

**Verdict:** good baseline. `'unsafe-inline'`/`'unsafe-eval'` is a known trade-off, not a gap you can easily close. HSTS is a hosting-platform responsibility — worth confirming with Lovable support if you need documentation for compliance.

## 5. SQL injection surface

- All edge functions use `@supabase/supabase-js` client with `.from().select/.eq/.update/.insert` — parameterized. No `execute_sql`-style RPC exists.
- All `.rpc()` calls pass named parameters (`p_action`, `p_key`, `p_ip_address`, `p_order_id`, etc.), not concatenated strings.
- Every DB function (`has_role`, `check_rate_limit`, `resolve_fridge_menu_ids`, `pull_fridge_for_menu_id`, `is_ip_blocked`, etc.) is SQL/PLPGSQL with named args; no `EXECUTE` of a dynamic string built from user input. `is_ip_blocked` uses parameterized `LIKE p_ip || '%'` — safe.
- Migrations are static DDL. No user input reaches them.

**Verdict: no SQLi surface.**

## 6. XSS surface

Two `innerHTML`/`dangerouslySetInnerHTML` sites:
- ✅ **`src/components/ui/chart.tsx`** — shadcn chart component. Injects a static CSS string built from a chart config object; no user data reaches it.
- ✅ **`src/lib/eventContract.ts`** — renders the signed event contract to PDF. All interpolations use `escapeHtml()` (`bookingId`, `contractText`, `signedAt`, `clientIp`). Signature images are data-URLs generated locally from `<canvas>`, not user URLs.

Everywhere else, user text (customer name, notes, address, admin messages) is rendered as normal React children → auto-escaped by React. Sample check on Kitchen.tsx confirms `{order.notes}`, `{order.customer_name}`, etc. use JSX text nodes.

**Verdict: no XSS surface.**

## 7. CSRF

- Staff auth uses Supabase JWT via localStorage → sent explicitly in `Authorization: Bearer …` headers by the Supabase client. No cookie-borne auth for the app's API calls.
- Customer auth uses a device token (localStorage) sent in JSON request bodies.
- Edge functions verify identity via header/body tokens, not cookies.
- Two `document.cookie` sites: `CustomerAuthContext` for a **non-security** UX cookie (`SameSite=Lax`) and the shadcn sidebar open/closed state cookie. Neither authorizes anything server-side.
- Third-party CSRF: Z-Credit callback is verified with a shared secret in the URL, not a cookie, so a browser CSRF cannot forge it.

**Verdict: not vulnerable — token/header-based end to end.**

## 8. Dependency vulnerabilities

Ran `code--dependency_scan` (npm audit under the hood):

> **No high or critical severity vulnerabilities found in dependencies.**

Moderate/low advisories were not surfaced by the scanner. Re-run before every deploy is cheap; no action needed today.

## 9. Backups / point-in-time recovery

Cannot determine from here. Lovable Cloud runs on Supabase, which provides **daily automated backups on all paid plans and PITR on Pro+**. Whether PITR is on for this specific project is a project-plan setting.

**Outside my visibility — check the Lovable backend settings for backup/PITR status.**

## 10. Logging / monitoring

Existing signals:
- **`rate_limit_attempts` table** — every rate-limited action records action + key + IP. This IS your failed-auth log (customer registrations, OTP sends, order lookups, etc.).
- **`blocked_ips`** — persistent record of IPs auto-blocked, with reason and timestamp.
- **`internal_config.attack_mode_until`** — timestamp of the last attack-mode activation.
- **`inventory_movements`** — every stock change is logged with `reason`, `note`, `order_id`, and (for purchases) `unit_cost`. This is the inventory audit trail.
- **`customers.login_count`**, `last_login_at`, `device_token_created_at` — audit fields on customer logins.
- Edge function `console.error`/`console.warn` calls go to Supabase edge logs (visible in the backend logs page).

**Gaps:**
- **No `inventory_access_tokens.last_used_at` write-log with IP.** The column is updated but not paired with a movement/audit row. A leaked token would leave no forensic trail beyond a single `last_used_at` timestamp.
- **No admin/kitchen login audit table.** Supabase Auth logs sign-in events internally, viewable in the backend Auth → Logs page, but there's no app-side audit table you can query alongside orders. **Real gap if you need to trace "who edited order X".** `edit-order` doesn't record `edited_by` on the order itself.
- **No `edited_by` / `cancelled_by` column on `orders`.** If a kitchen user cancels or edits an order, there's no way to prove which staff account did it from the DB alone.

**Verdict:** rate-limit and inventory logging is genuinely good. Order-edit audit trail and admin-token usage logging are the two real gaps.

---

## Summary table

| # | Area | Status |
|---|---|---|
| 1 | Rate limiting | ⚠️ `manage-saved-cart`, `create-payment` uncapped (low-severity) |
| 2 | Passwords | ✅ Supabase bcrypt for staff; no customer passwords; HIBP toggle unverified |
| 3 | HTTPS | ✅ Platform-enforced + CSP upgrade |
| 4 | Security headers | ✅ CSP/XFO/nosniff/referrer set; HSTS is hosting-side |
| 5 | SQLi | ✅ Parameterized everywhere, no dynamic EXECUTE |
| 6 | XSS | ✅ Both innerHTML sites are static/escaped |
| 7 | CSRF | ✅ Token/header auth, not cookies |
| 8 | Dependencies | ✅ No high/critical advisories today |
| 9 | Backups / PITR | ❓ Outside my visibility — check backend |
| 10 | Logging | ⚠️ Missing order-edit `edited_by` and admin-token usage log |

**Real gaps worth fixing later (all optional, none urgent):**
1. Add rate limits to `manage-saved-cart` and `create-payment`.
2. Turn on HIBP leaked-password check in Auth settings.
3. Add `edited_by` / `cancelled_by` columns on `orders` (populated by `edit-order`).
4. Log inventory-token uses with action + IP for forensic trail.

**Outside my visibility:**
- Backup / PITR status → check Lovable Cloud backend project settings.
- Hosting-level HSTS header → confirm with Lovable if a compliance auditor asks.

No changes made. Tell me which of the four gaps (if any) you want me to fix and I'll switch to build mode.
