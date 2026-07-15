-- Close anonymous update on delivery_requests. Only staff/couriers can update;
-- customer-side finalize/cancel now goes through an edge function using a client_token.

ALTER TABLE public.delivery_requests
  ADD COLUMN IF NOT EXISTS client_token uuid NOT NULL DEFAULT gen_random_uuid();

DROP POLICY IF EXISTS "Anon can finalize own delivery request" ON public.delivery_requests;