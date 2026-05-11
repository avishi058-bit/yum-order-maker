-- Add tracking column for the 10-minute pre-ready notification
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ten_min_notified_at timestamp with time zone;

-- Replace the cron-invoked function to handle BOTH the 10-min and 5-min reminders
CREATE OR REPLACE FUNCTION public.notify_orders_almost_ready()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  rec RECORD;
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
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('order_id', rec.id::text, 'type', 'ten_minutes')
    );
    UPDATE public.orders
       SET ten_min_notified_at = now()
     WHERE id = rec.id;
  END LOOP;

  -- 5-minute window
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
$function$;