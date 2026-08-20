CREATE OR REPLACE FUNCTION public.notify_daily_sales_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now_local timestamp := (now() AT TIME ZONE 'Asia/Jerusalem');
  v_today text := to_char((now() AT TIME ZONE 'Asia/Jerusalem'), 'YYYY-MM-DD');
  v_last text;
BEGIN
  -- Only when BOTH website and kiosk just became closed
  IF NEW.website_open OR NEW.station_open THEN
    RETURN NEW;
  END IF;
  IF NOT (OLD.website_open OR OLD.station_open) THEN
    RETURN NEW; -- already closed, nothing changed
  END IF;

  -- Only after 22:00 local time
  IF EXTRACT(HOUR FROM v_now_local) < 22 AND EXTRACT(HOUR FROM v_now_local) > 4 THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_last FROM public.internal_config WHERE key = 'daily_summary_sent_on';
  IF v_last = v_today THEN
    RETURN NEW; -- already sent today
  END IF;

  INSERT INTO public.internal_config(key, value, updated_at)
  VALUES ('daily_summary_sent_on', v_today, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  PERFORM net.http_post(
    url := 'https://kdkcygokopwvutwvrgnp.supabase.co/functions/v1/daily-sales-summary',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-internal-secret', public.get_webhook_secret()
    ),
    body := '{}'::jsonb
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_daily_sales_summary ON public.restaurant_status;
CREATE TRIGGER trg_notify_daily_sales_summary
AFTER UPDATE ON public.restaurant_status
FOR EACH ROW EXECUTE FUNCTION public.notify_daily_sales_summary();