-- Add kitchen push subscriptions support
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS is_kitchen boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_kitchen_endpoint_key
  ON public.push_subscriptions (endpoint)
  WHERE is_kitchen = true;

-- Function: notify all kitchen subscribers when a new order is created
CREATE OR REPLACE FUNCTION public.notify_kitchen_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://kdkcygokopwvutwvrgnp.supabase.co/functions/v1/notify-kitchen-new-order',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('order_id', NEW.id::text)
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_kitchen_new_order ON public.orders;
CREATE TRIGGER trg_notify_kitchen_new_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_kitchen_new_order();