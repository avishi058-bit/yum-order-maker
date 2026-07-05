
ALTER TABLE public.event_bookings
  ADD COLUMN IF NOT EXISTS invoice_name TEXT,
  ADD COLUMN IF NOT EXISTS business_id TEXT,
  ADD COLUMN IF NOT EXISTS at_venue BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.auto_block_event_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'signed' AND NEW.event_date IS NOT NULL THEN
    INSERT INTO public.event_blocked_dates (blocked_date, reason)
    VALUES (NEW.event_date, 'אירוע: ' || COALESCE(NEW.customer_name, ''))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_block_event_date ON public.event_bookings;
CREATE TRIGGER trg_auto_block_event_date
AFTER INSERT ON public.event_bookings
FOR EACH ROW
EXECUTE FUNCTION public.auto_block_event_date();
