ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS bon_queue_number integer;

CREATE OR REPLACE FUNCTION public.assign_bon_queue_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_day_start timestamptz;
BEGIN
  v_day_start := date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem';
  SELECT COUNT(*) + 1 INTO NEW.bon_queue_number
  FROM public.orders
  WHERE created_at >= v_day_start;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_assign_bon_queue_number ON public.orders;
CREATE TRIGGER trg_assign_bon_queue_number
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.assign_bon_queue_number();

-- Backfill: today's orders get a bon number by creation order
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.orders
  WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem'
)
UPDATE public.orders o
SET bon_queue_number = r.rn
FROM ranked r
WHERE o.id = r.id AND o.bon_queue_number IS NULL;

-- Keep the paid queue number identical to the printed bon number
CREATE OR REPLACE FUNCTION public.mark_order_paid(p_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing integer;
  v_bon integer;
  v_created timestamptz;
  v_next integer;
  v_day_start timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kitchen')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT queue_number, bon_queue_number, created_at INTO v_existing, v_bon, v_created
  FROM public.orders WHERE id = p_order_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  IF v_bon IS NOT NULL THEN
    v_next := v_bon;
  ELSE
    v_day_start := date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem';
    SELECT COUNT(*) INTO v_next
    FROM public.orders
    WHERE created_at >= v_day_start
      AND created_at <= v_created;
    v_next := GREATEST(COALESCE(v_next, 1), 1);
  END IF;

  UPDATE public.orders
  SET queue_number = v_next, paid_at = now()
  WHERE id = p_order_id;

  RETURN v_next;
END;
$function$;