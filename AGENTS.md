# Project architecture rules

- Keep the groups campaign booking gate local to the groups page, retaining its disabled form for reactivation without affecting other ordering flows.

- Keep `orders.order_number` as an internal tracking/payment key only; never expose it in UI, notifications, invoices, or printouts. Use the daily `bon_queue_number` for staff-facing identification because it resets each business day and avoids confusing customers.
- Keep inventory workflows progressive: daily actions stay visible, while reports and destructive or uncommon item actions remain behind labeled menus to prevent operational mistakes.- Edge functions get the client IP only via `_shared/clientIp.ts` (cf-connecting-ip, else right-most x-forwarded-for), because left-most forwarded values are caller-controlled.
- The business signature lives only in the admin-only `business_private_settings` table and is attached to event contracts by `submit-event-booking`, so clients can never supply or read it.
- Inventory access tokens are stored as SHA-256 hashes and compared by hash, so a database leak does not expose working links.
- Browser CORS for shared edge helpers is an exact-origin allowlist (ALLOWED_ORIGINS env, else built-in list, plus PUBLIC_APP_URL and localhost), never wildcard subdomains, so other hosted sites cannot call our functions.
- Test customers live in the admin-managed `test_customers` table and every report/summary reads from it, so no personal data is hardcoded.
- Order edits apply through the `edit_order_apply` RPC in one transaction, priced server-side with admin overrides, so a mid-way failure cannot leave an empty order.
- Customer identity, favorites and order history live only in the customer's device storage; `customer-auth`/`get-customer-orders` are disabled stubs and saved carts use only the private guest_id, because there is no OTP to prove phone ownership. Marketing consent is recorded only inside `create-order` with a real order.
- Public-page SEO (title, description, canonical, hreflang, JSON-LD, crawler text) lives only in `src/seo/pages.ts`, read by both `<Seo />` and the build-time prerender plugin in `vite.config.ts`, so raw HTML and the running app never disagree; `index.html` keeps no canonical because it is the fallback for every route.
- `create-order` rejects credit orders whose status is not `pending_payment`; only payment-callback, get-payment-status and pinpad-charge may move a credit order to `new` after the charge is confirmed, so nobody can create a "paid by credit" order without paying.
- `pinpad-charge` claims the order by writing a `pinpad:` marker into the otherwise unused `payment_session_id` before charging and releases it only on an explicit decline, so concurrent calls can never charge one order twice.
- Contract signatures must be plain base64 image data URLs (checked in `submit-event-booking`) and are set on `<img>` elements as properties in `eventContract.ts`, never interpolated into HTML, because the admin renders stored customer signatures.
