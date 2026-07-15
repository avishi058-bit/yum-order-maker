
-- Update the function: only ping the kitchen when the order is in status 'new'.
-- Fires on INSERT (cash/counter orders) AND on UPDATE from pending_payment → new
-- (credit orders confirmed by payment-callback).
CREATE OR REPLACE FUNCTION public.notify_kitchen_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  -- Skip if not (yet) in 'new' status
  IF NEW.status IS DISTINCT FROM 'new' THEN
    RETURN NEW;
  END IF;

  -- On UPDATE: only fire on the transition INTO 'new' (avoid double-notify
  -- on later edits of a 'new' order).
  IF TG_OP = 'UPDATE' AND OLD.status = 'new' THEN
    RETURN NEW;
  END IF;

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
$$;

-- Replace the INSERT-only trigger with one covering both INSERT and status UPDATE.
DROP TRIGGER IF EXISTS trg_notify_kitchen_new_order ON public.orders;

CREATE TRIGGER trg_notify_kitchen_new_order
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_kitchen_new_order();
