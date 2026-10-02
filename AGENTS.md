# Project architecture rules

- Keep `orders.order_number` as an internal tracking/payment key only; never expose it in UI, notifications, invoices, or printouts. Use the daily `bon_queue_number` for staff-facing identification because it resets each business day and avoids confusing customers.
- Keep inventory workflows progressive: daily actions stay visible, while reports and destructive or uncommon item actions remain behind labeled menus to prevent operational mistakes.- Edge functions get the client IP only via `_shared/clientIp.ts` (cf-connecting-ip, else right-most x-forwarded-for), because left-most forwarded values are caller-controlled.
- The business signature lives only in the admin-only `business_private_settings` table and is attached to event contracts by `submit-event-booking`, so clients can never supply or read it.
- Inventory access tokens are stored as SHA-256 hashes and compared by hash, so a database leak does not expose working links.
