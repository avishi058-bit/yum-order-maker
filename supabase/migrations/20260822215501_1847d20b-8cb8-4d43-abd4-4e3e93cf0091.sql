ALTER TABLE public.restaurant_status
  ADD COLUMN IF NOT EXISTS last_opened_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.update_restaurant_status_last_opened()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (OLD.website_open OR OLD.station_open)
     AND (NEW.website_open OR NEW.station_open) THEN
    NEW.last_opened_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_restaurant_status_last_opened ON public.restaurant_status;
CREATE TRIGGER trg_update_restaurant_status_last_opened
BEFORE UPDATE ON public.restaurant_status
FOR EACH ROW EXECUTE FUNCTION public.update_restaurant_status_last_opened();

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
  v_start timestamp with time zone;
BEGIN
  IF NEW.website_open OR NEW.station_open THEN
    RETURN NEW;
  END IF;
  IF NOT (OLD.website_open OR OLD.station_open) THEN
    RETURN NEW;
  END IF;

  IF EXTRACT(HOUR FROM v_now_local) < 22 AND EXTRACT(HOUR FROM v_now_local) > 4 THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_last FROM public.internal_config WHERE key = 'daily_summary_sent_on';
  IF v_last = v_today THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.internal_config(key, value, updated_at)
  VALUES ('daily_summary_sent_on', v_today, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  v_start := COALESCE(
    NEW.last_opened_at,
    (date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'UTC'
  );

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
$$;

DROP TRIGGER IF EXISTS trg_notify_daily_sales_summary ON public.restaurant_status;
CREATE TRIGGER trg_notify_daily_sales_summary
AFTER UPDATE ON public.restaurant_status
FOR EACH ROW EXECUTE FUNCTION public.notify_daily_sales_summary();

REVOKE EXECUTE ON FUNCTION public.notify_daily_sales_summary() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_restaurant_status_last_opened() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_daily_sales_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_restaurant_status_last_opened() TO service_role;
