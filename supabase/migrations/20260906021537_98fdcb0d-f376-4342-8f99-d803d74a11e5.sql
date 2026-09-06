CREATE OR REPLACE FUNCTION public.next_daily_queue_number()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date := ((now() - interval '6 hours') AT TIME ZONE 'Asia/Jerusalem')::date;
  v_next integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('orders_daily_queue', 42));
  SELECT COALESCE(MAX(queue_number), 0) + 1 INTO v_next
  FROM public.orders
  WHERE ((created_at - interval '6 hours') AT TIME ZONE 'Asia/Jerusalem')::date = v_day;
  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.next_daily_queue_number() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.orders ALTER COLUMN queue_number SET DEFAULT public.next_daily_queue_number();