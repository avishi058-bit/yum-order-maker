# Project architecture rules

- Keep `orders.order_number` as an internal tracking/payment key only; never expose it in UI, notifications, invoices, or printouts. Use the daily `bon_queue_number` for staff-facing identification because it resets each business day and avoids confusing customers.
- Keep inventory workflows progressive: daily actions stay visible, while reports and destructive or uncommon item actions remain behind labeled menus to prevent operational mistakes.- Edge functions get the client IP only via `_shared/clientIp.ts` (cf-connecting-ip, else right-most x-forwarded-for), because left-most forwarded values are caller-controlled.
- The business signature lives only in the admin-only `business_private_settings` table and is attached to event contracts by `submit-event-booking`, so clients can never supply or read it.
- Inventory access tokens are stored as SHA-256 hashes and compared by hash, so a database leak does not expose working links.
- Browser CORS for shared edge helpers is an exact-origin allowlist (ALLOWED_ORIGINS env, else built-in list, plus PUBLIC_APP_URL and localhost), never wildcard subdomains, so other hosted sites cannot call our functions.
- The Android print agent secret is generated per install on the device and entered once in /station-setup (tablet localStorage), never shipped in site code.
- Test customers live in the admin-managed `test_customers` table and every report/summary reads from it, so no personal data is hardcoded.
- Order edits apply through the `edit_order_apply` RPC in one transaction, priced server-side with admin overrides, so a mid-way failure cannot leave an empty order.
- Customer identity, favorites and order history live only in the customer's device storage; `customer-auth`/`get-customer-orders` are disabled stubs and saved carts use only the private guest_id, because there is no OTP to prove phone ownership. Marketing consent is recorded only inside `create-order` with a real order.
