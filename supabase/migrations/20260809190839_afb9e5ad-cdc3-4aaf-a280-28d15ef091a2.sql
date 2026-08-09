CREATE OR REPLACE FUNCTION public.mark_order_paid(p_order_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing integer;
  v_created timestamptz;
  v_next integer;
  v_day_start timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kitchen')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT queue_number, created_at INTO v_existing, v_created
  FROM public.orders WHERE id = p_order_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  v_day_start := date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem';

  SELECT COUNT(*) INTO v_next
  FROM public.orders
  WHERE created_at >= v_day_start
    AND created_at <= v_created;

  v_next := GREATEST(COALESCE(v_next, 1), 1);

  UPDATE public.orders
  SET queue_number = v_next, paid_at = now()
  WHERE id = p_order_id;

  RETURN v_next;
END;
$function$;

UPDATE public.orders SET queue_number = 1 WHERE queue_number = 0;