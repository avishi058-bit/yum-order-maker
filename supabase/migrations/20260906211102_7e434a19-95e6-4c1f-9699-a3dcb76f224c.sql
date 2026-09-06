CREATE OR REPLACE FUNCTION public.notify_daily_sales_summary()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_business_day date := CASE WHEN EXTRACT(HOUR FROM (now() AT TIME ZONE 'Asia/Jerusalem')) < 6
                              THEN ((now() AT TIME ZONE 'Asia/Jerusalem') - interval '1 day')::date
                              ELSE (now() AT TIME ZONE 'Asia/Jerusalem')::date END;
  v_start timestamp with time zone;
  v_default_start timestamp with time zone;
BEGIN
  -- Fire when ordering (the website) transitions open -> closed.
  IF NEW.website_open THEN
    RETURN NEW;
  END IF;
  IF NOT OLD.website_open THEN
    RETURN NEW;
  END IF;

  -- Send on EVERY close (not just once a day) with the up-to-date totals.

  -- Business day starts at 06:00 Jerusalem time, so a 02:00 closing still
  -- summarizes the shift that began the previous evening.
  v_default_start := (v_business_day + time '06:00') AT TIME ZONE 'Asia/Jerusalem';

  v_start := COALESCE(NEW.last_opened_at, v_default_start);
  IF v_start < v_default_start - interval '24 hours' OR v_start > now() THEN
    v_start := v_default_start;
  END IF;

  PERFORM net.http_post(
    url := 'https://kdkcygokopwvutwvrgnp.supabase.co/functions/v1/daily-sales-summary',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-internal-secret', public.get_webhook_secret()
    ),
    body := jsonb_build_object('businessDayStart', v_start)
  );
  RETURN NEW;
END;
$function$;