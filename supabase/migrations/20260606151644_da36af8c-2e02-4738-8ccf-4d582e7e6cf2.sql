
-- Function that re-pings kitchen for every "new" order that's still pending
CREATE OR REPLACE FUNCTION public.reping_kitchen_for_pending_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id FROM public.orders
    WHERE status = 'new'
      AND created_at > now() - interval '30 minutes'
  LOOP
    PERFORM net.http_post(
      url := 'https://kdkcygokopwvutwvrgnp.supabase.co/functions/v1/notify-kitchen-new-order',
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('order_id', rec.id::text, 'repeat', true)
    );
  END LOOP;
END;
$$;

-- Schedule it to run every minute
SELECT cron.schedule(
  'reping-kitchen-pending-orders',
  '* * * * *',
  $$ SELECT public.reping_kitchen_for_pending_orders(); $$
);
