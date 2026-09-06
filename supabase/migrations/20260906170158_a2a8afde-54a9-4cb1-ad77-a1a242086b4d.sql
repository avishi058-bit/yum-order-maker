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
  PERFORM pg_advisory_xact_lock(hashtextextended('orders_bon_queue', 7));
  SELECT COALESCE(MAX(bon_queue_number), 0) + 1 INTO v_next
  FROM public.orders
  WHERE ((created_at - interval '6 hours') AT TIME ZONE 'Asia/Jerusalem')::date = v_day;
  NEW.bon_queue_number := GREATEST(COALESCE(v_next, 1), 1);
  RETURN NEW;
END;
$function$;