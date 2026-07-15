
-- 1) Reassign unique random 4-digit numbers per Israel-day for existing orders
DO $$
DECLARE
  r record;
  v_new int;
  v_tries int;
BEGIN
  FOR r IN
    SELECT id, (created_at AT TIME ZONE 'Asia/Jerusalem')::date AS day
    FROM public.orders
    ORDER BY created_at
  LOOP
    v_tries := 0;
    LOOP
      v_new := floor(random() * 9000 + 1000)::int;
      IF NOT EXISTS (
        SELECT 1 FROM public.orders o2
        WHERE o2.id <> r.id
          AND o2.order_number = v_new
          AND (o2.created_at AT TIME ZONE 'Asia/Jerusalem')::date = r.day
      ) THEN
        UPDATE public.orders SET order_number = v_new WHERE id = r.id;
        EXIT;
      END IF;
      v_tries := v_tries + 1;
      IF v_tries > 500 THEN
        RAISE EXCEPTION 'Could not find free order_number for order %', r.id;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 2) Function used as default: pick a random 4-digit not used today
CREATE OR REPLACE FUNCTION public.generate_daily_order_number()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate integer;
  v_today date := (now() AT TIME ZONE 'Asia/Jerusalem')::date;
  v_attempts integer := 0;
BEGIN
  LOOP
    v_candidate := floor(random() * 9000 + 1000)::int;
    IF NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE order_number = v_candidate
        AND (created_at AT TIME ZONE 'Asia/Jerusalem')::date = v_today
    ) THEN
      RETURN v_candidate;
    END IF;
    v_attempts := v_attempts + 1;
    IF v_attempts > 500 THEN
      RETURN 1000 + (extract(epoch from clock_timestamp())::bigint % 9000)::int;
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_daily_order_number() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.orders
  ALTER COLUMN order_number SET DEFAULT public.generate_daily_order_number();

-- 3) Enforce uniqueness per Israel-timezone day
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_per_day_uniq
  ON public.orders (order_number, ((created_at AT TIME ZONE 'Asia/Jerusalem')::date));
