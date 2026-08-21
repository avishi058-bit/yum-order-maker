ALTER TABLE public.consent_events
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consent_text text,
  ADD COLUMN IF NOT EXISTS item_ref text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS consent_events_created_at_idx ON public.consent_events (created_at DESC);
CREATE INDEX IF NOT EXISTS consent_events_phone_idx ON public.consent_events (phone);
CREATE INDEX IF NOT EXISTS consent_events_order_idx ON public.consent_events (order_id);

GRANT SELECT ON public.consent_events TO authenticated;
GRANT ALL ON public.consent_events TO service_role;