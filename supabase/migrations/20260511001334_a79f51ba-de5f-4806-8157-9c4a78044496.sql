ALTER TABLE public.push_subscriptions ALTER COLUMN order_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_phone
  ON public.push_subscriptions (customer_phone);

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_phone_endpoint_key
  ON public.push_subscriptions (customer_phone, endpoint)
  WHERE customer_phone IS NOT NULL;