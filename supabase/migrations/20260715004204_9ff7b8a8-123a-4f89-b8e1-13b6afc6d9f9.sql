-- Block anon/authenticated from inserting order_items directly.
-- create-order edge function uses SERVICE_ROLE and bypasses RLS,
-- so this only removes a tampering vector where anyone knowing a fresh order_id could append items.
DROP POLICY IF EXISTS "Anyone can create items for recent orders" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
-- No INSERT policy for anon/authenticated => inserts are blocked by RLS.
-- SELECT/other policies remain unchanged; service_role continues to have full access.