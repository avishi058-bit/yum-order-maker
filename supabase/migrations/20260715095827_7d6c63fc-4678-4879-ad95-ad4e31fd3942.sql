
-- SECURITY FIX: prevent price/total manipulation by removing direct anon/authenticated
-- INSERT access to orders and delivery_requests. All customer-facing inserts now go
-- through trusted edge functions (create-order, create-delivery-request) that use
-- service_role and validate/compute prices server-side. Service_role bypasses RLS,
-- so removing these policies does not affect the edge-function path.

DROP POLICY IF EXISTS "Anyone can create pending orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create pending delivery requests" ON public.delivery_requests;

-- Revoke the raw INSERT privilege as well so the intent is clear at the SQL layer.
REVOKE INSERT ON public.orders FROM anon, authenticated;
REVOKE INSERT ON public.delivery_requests FROM anon, authenticated;
