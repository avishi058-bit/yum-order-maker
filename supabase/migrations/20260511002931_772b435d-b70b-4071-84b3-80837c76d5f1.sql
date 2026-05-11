
-- 1. Add column to track 5-min-left notification (avoid duplicates)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS almost_ready_notified_at TIMESTAMPTZ;

-- 2. Replace trigger function: handle both 'preparing' and 'ready'
CREATE OR REPLACE FUNCTION public.notify_order_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('order_id', NEW.id::text, 'type', v_type)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger already exists from previous migration; recreate to be safe
DROP TRIGGER IF EXISTS trg_notify_order_ready ON public.orders;
CREATE TRIGGER trg_notify_order_ready
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_ready();

-- 3. Function to fire "5 minutes left" pushes (called by cron)
CREATE OR REPLACE FUNCTION public.notify_orders_almost_ready()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  rec RECORD;
BEGIN
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
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('order_id', rec.id::text, 'type', 'almost_ready')
    );
    UPDATE public.orders
       SET almost_ready_notified_at = now()
     WHERE id = rec.id;
  END LOOP;
END;
$$;

-- 4. Schedule cron to run every minute
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Remove old job if exists
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'notify_orders_almost_ready_every_minute';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'notify_orders_almost_ready_every_minute',
  '* * * * *',
  $$ SELECT public.notify_orders_almost_ready(); $$
);
