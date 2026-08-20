CREATE OR REPLACE FUNCTION public.unmark_order_paid(p_order_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_paid_at timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kitchen')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT paid_at INTO v_paid_at
  FROM public.orders
  WHERE id = p_order_id;

  IF v_paid_at IS NULL THEN
    RETURN false;
  END IF;

  -- Allow undo only within 30 seconds of marking paid.
  IF now() - v_paid_at > interval '30 seconds' THEN
    RAISE EXCEPTION 'undo window expired';
  END IF;

  UPDATE public.orders
  SET queue_number = NULL, paid_at = NULL
  WHERE id = p_order_id;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.unmark_order_paid(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.unmark_order_paid(uuid) TO authenticated;