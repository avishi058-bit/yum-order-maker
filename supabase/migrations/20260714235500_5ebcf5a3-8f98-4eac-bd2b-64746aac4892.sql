
REVOKE SELECT ON public.orders FROM anon;
REVOKE SELECT ON public.order_items FROM anon;
REVOKE SELECT ON public.customers FROM anon;
REVOKE SELECT ON public.delivery_requests FROM anon;
REVOKE SELECT ON public.event_bookings FROM anon;
REVOKE SELECT ON public.saved_carts FROM anon;
REVOKE SELECT ON public.couriers FROM anon;
REVOKE SELECT ON public.courier_locations FROM anon;
REVOKE SELECT ON public.courier_push_subscriptions FROM anon;
REVOKE SELECT ON public.verification_codes FROM anon, authenticated;
REVOKE SELECT ON public.push_subscriptions FROM anon;
REVOKE SELECT ON public.reopen_notifications FROM anon;
REVOKE SELECT ON public.user_roles FROM anon;
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.notification_prompts FROM anon;
REVOKE SELECT ON public.inventory_items FROM anon;
REVOKE SELECT ON public.inventory_movements FROM anon, authenticated;
REVOKE SELECT ON public.inventory_recipes FROM anon, authenticated;
REVOKE SELECT ON public.inventory_access_tokens FROM anon, authenticated;

-- Also revoke UPDATE/DELETE at grant level from anon on tables anon should never modify
REVOKE UPDATE, DELETE ON public.orders FROM anon;
REVOKE UPDATE, DELETE ON public.order_items FROM anon;
REVOKE UPDATE, DELETE ON public.customers FROM anon;
REVOKE UPDATE, DELETE ON public.event_bookings FROM anon;
REVOKE UPDATE, DELETE ON public.couriers FROM anon;
REVOKE UPDATE, DELETE ON public.saved_carts FROM anon;
REVOKE UPDATE, DELETE ON public.user_roles FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.profiles FROM anon;
