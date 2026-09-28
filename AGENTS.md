# Project architecture rules

- Keep `orders.order_number` as an internal tracking/payment key only; never expose it in UI, notifications, invoices, or printouts. Use the daily `bon_queue_number` for staff-facing identification because it resets each business day and avoids confusing customers.