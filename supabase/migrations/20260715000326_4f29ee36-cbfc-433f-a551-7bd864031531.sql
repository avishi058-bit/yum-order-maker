-- Rate-limiting infrastructure
-- Tracks attempts per action/key so we can block brute-force/bot abuse.

CREATE TABLE IF NOT EXISTS public.rate_limit_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  key text NOT NULL,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.rate_limit_attempts TO authenticated;
GRANT ALL ON public.rate_limit_attempts TO service_role;

ALTER TABLE public.rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- Only service role can read the full rate-limit table; authenticated users
-- can insert their own attempts (for actions that need client-side logging).
CREATE POLICY "Service role manages rate limits" ON public.rate_limit_attempts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can record their own attempts" ON public.rate_limit_attempts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = key);

CREATE INDEX IF NOT EXISTS idx_rate_limit_attempts_action_key_created
  ON public.rate_limit_attempts (action, key, created_at);

CREATE INDEX IF NOT EXISTS idx_rate_limit_attempts_created_at
  ON public.rate_limit_attempts (created_at);

-- General rate-limit checker. Returns true if the caller is still within the
-- allowed number of attempts for the given action and key in the time window.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action text,
  p_key text,
  p_max_attempts integer,
  p_window interval
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.rate_limit_attempts
  WHERE action = p_action
    AND key = p_key
    AND created_at > now() - p_window;

  RETURN v_count < p_max_attempts;
END;
$$;

-- Record a new attempt. Call this before checking, so the current attempt counts.
CREATE OR REPLACE FUNCTION public.record_rate_limit_attempt(
  p_action text,
  p_key text,
  p_ip_address text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rate_limit_attempts (action, key, ip_address)
  VALUES (p_action, p_key, p_ip_address);
END;
$$;

-- Convenience function for the OTP flow: keeps the old 5-minute/3-attempt window.
CREATE OR REPLACE FUNCTION public.check_otp_rate_limit(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.check_rate_limit('otp_send', p_phone, 3, interval '5 minutes');
END;
$$;

-- Cleanup old records so the table stays small.
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limit_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_attempts WHERE created_at < now() - interval '24 hours';
END;
$$;

-- Grant execute on rate-limit helpers to authenticated and service roles.
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, interval) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_rate_limit_attempt(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_otp_rate_limit(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rate_limit_attempts() TO service_role;