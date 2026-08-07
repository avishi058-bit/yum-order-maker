ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS queue_number integer;

CREATE INDEX IF NOT EXISTS orders_queue_number_idx ON public.orders (created_at, queue_number);

CREATE OR REPLACE FUNCTION public.mark_order_paid(p_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing integer;
  v_next integer;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kitchen')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT queue_number INTO v_existing FROM public.orders WHERE id = p_order_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT COALESCE(MAX(queue_number), 0) + 1 INTO v_next
  FROM public.orders
  WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem';

  UPDATE public.orders
  SET queue_number = v_next, paid_at = now()
  WHERE id = p_order_id;

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_order_paid(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(uuid) TO authenticated;