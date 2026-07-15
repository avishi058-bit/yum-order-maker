
-- Internal shared config (read-only for service_role; RLS blocks everyone else)
CREATE TABLE IF NOT EXISTS public.internal_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.internal_config TO service_role;
ALTER TABLE public.internal_config ENABLE ROW LEVEL SECURITY;
-- No policies -> anon/authenticated cannot read or write; service_role bypasses.

-- Seed the webhook secret once with a strong random value (only used server-side).
INSERT INTO public.internal_config(key, value)
VALUES ('webhook_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_webhook_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.internal_config WHERE key = 'webhook_secret'
$$;

-- Update triggers to include the internal secret header
CREATE OR REPLACE FUNCTION public.notify_kitchen_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://kdkcygokopwvutwvrgnp.supabase.co/functions/v1/notify-kitchen-new-order',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-internal-secret', public.get_webhook_secret()
    ),
    body := jsonb_build_object('order_id', NEW.id::text)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_couriers_new_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM net.http_post(
      url := 'https://kdkcygokopwvutwvrgnp.supabase.co/functions/v1/notify-couriers-new-delivery',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-internal-secret', public.get_webhook_secret()
      ),
      body := jsonb_build_object('request_id', NEW.id::text)
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_order_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $function$
DECLARE
  v_type text := NULL;
BEGIN
  IF NEW.status = 'ready' AND (OLD.status IS DISTINCT FROM 'ready') THEN
    v_type := 'ready';
  ELSIF NEW.status = 'preparing' AND (OLD.status IS DISTINCT FROM 'preparing') THEN
    v_type := 'preparing';
  END IF;

  IF v_type IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://kdkcygokopwvutwvrgnp.supabase.co/functions/v1/send-order-ready-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', public.get_webhook_secret()
      ),
      body := jsonb_build_object('order_id', NEW.id::text, 'type', v_type)
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_orders_almost_ready()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $function$
DECLARE
  rec RECORD;
  v_secret text := public.get_webhook_secret();
BEGIN
  -- 10-minute window
  FOR rec IN
    SELECT id
    FROM public.orders
    WHERE status = 'preparing'
      AND ten_min_notified_at IS NULL
      AND estimated_ready_at IS NOT NULL
      AND estimated_ready_at > now() + interval '5 minutes'
      AND estimated_ready_at <= now() + interval '10 minutes'
  LOOP
    PERFORM net.http_post(
      url := 'https://kdkcygokopwvutwvrgnp.supabase.co/functions/v1/send-order-ready-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret),
      body := jsonb_build_object('order_id', rec.id::text, 'type', 'ten_minutes')
    );
    UPDATE public.orders SET ten_min_notified_at = now() WHERE id = rec.id;
  END LOOP;

  FOR rec IN
    SELECT id
    FROM public.orders
    WHERE status = 'preparing'
      AND almost_ready_notified_at IS NULL
      AND estimated_ready_at IS NOT NULL
      AND estimated_ready_at > now()
      AND estimated_ready_at <= now() + interval '5 minutes'
  LOOP
    PERFORM net.http_post(
      url := 'https://kdkcygokopwvutwvrgnp.supabase.co/functions/v1/send-order-ready-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret),
      body := jsonb_build_object('order_id', rec.id::text, 'type', 'almost_ready')
    );
    UPDATE public.orders SET almost_ready_notified_at = now() WHERE id = rec.id;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reping_kitchen_for_pending_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $function$
DECLARE
  rec RECORD;
  v_secret text := public.get_webhook_secret();
BEGIN
  FOR rec IN
    SELECT id FROM public.orders
    WHERE status = 'new' AND created_at > now() - interval '30 minutes'
  LOOP
    PERFORM net.http_post(
      url := 'https://kdkcygokopwvutwvrgnp.supabase.co/functions/v1/notify-kitchen-new-order',
      headers := jsonb_build_object('Content-Type','application/json','x-internal-secret', v_secret),
      body := jsonb_build_object('order_id', rec.id::text, 'repeat', true)
    );
  END LOOP;
END;
$function$;
