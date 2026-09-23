CREATE OR REPLACE FUNCTION public.assign_bon_queue_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_day date := ((now() - interval '6 hours') AT TIME ZONE 'Asia/Jerusalem')::date;
  v_next integer;
BEGIN
  -- Orders still awaiting payment must not consume a bon number: many are
  -- abandoned and would create gaps in the daily 1,2,3 sequence.
  IF NEW.status = 'pending_payment' THEN
    NEW.bon_queue_number := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.bon_queue_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('orders_bon_queue', 7));
  SELECT COALESCE(MAX(bon_queue_number), 0) + 1 INTO v_next
  FROM public.orders
  WHERE ((created_at - interval '6 hours') AT TIME ZONE 'Asia/Jerusalem')::date = v_day;
  NEW.bon_queue_number := GREATEST(COALESCE(v_next, 1), 1);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_assign_bon_queue_number_update ON public.orders;
CREATE TRIGGER trg_assign_bon_queue_number_update
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (OLD.status = 'pending_payment' AND NEW.status <> 'pending_payment')
EXECUTE FUNCTION public.assign_bon_queue_number();