CREATE OR REPLACE FUNCTION public.notify_daily_sales_summary()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now_local timestamp := (now() AT TIME ZONE 'Asia/Jerusalem');
  v_business_day date := CASE WHEN EXTRACT(HOUR FROM (now() AT TIME ZONE 'Asia/Jerusalem')) < 6
                              THEN ((now() AT TIME ZONE 'Asia/Jerusalem') - interval '1 day')::date
                              ELSE (now() AT TIME ZONE 'Asia/Jerusalem')::date END;
  v_today text := to_char(v_business_day, 'YYYY-MM-DD');
  v_last text;
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

  -- Once per business day.
  SELECT value INTO v_last FROM public.internal_config WHERE key = 'daily_summary_sent_on';
  IF v_last = v_today THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.internal_config(key, value, updated_at)
  VALUES ('daily_summary_sent_on', v_today, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

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