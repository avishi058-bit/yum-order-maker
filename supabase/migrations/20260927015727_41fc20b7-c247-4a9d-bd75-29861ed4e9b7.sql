ALTER TABLE public.restaurant_status ADD COLUMN IF NOT EXISTS soldier_fund_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS donation_only boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.assign_bon_queue_number()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_day date := ((now() - interval '6 hours') AT TIME ZONE 'Asia/Jerusalem')::date;
  v_next integer;
BEGIN
  IF NEW.status = 'pending_payment' OR COALESCE(NEW.donation_only, false) THEN
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

-- Donation-only orders never reach the kitchen: once paid they close immediately.
CREATE OR REPLACE FUNCTION public.close_paid_donation_only()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.donation_only AND NEW.status = 'new' THEN
    NEW.status := 'completed';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_close_paid_donation_only ON public.orders;
CREATE TRIGGER trg_close_paid_donation_only BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.close_paid_donation_only();