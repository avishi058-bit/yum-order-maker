-- Tighten verification_codes: only service_role should read/update
DROP POLICY IF EXISTS "Anyone can read verification codes" ON public.verification_codes;
DROP POLICY IF EXISTS "Anyone can update verification codes" ON public.verification_codes;
DROP POLICY IF EXISTS "Anyone can create verification codes" ON public.verification_codes;

CREATE POLICY "Service role manages verification codes" ON public.verification_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Tighten customers table: only staff can read
DROP POLICY IF EXISTS "Anyone can read customers" ON public.customers;
CREATE POLICY "Staff can read customers" ON public.customers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role));

-- Rate limiting helper for OTP
CREATE OR REPLACE FUNCTION public.check_otp_rate_limit(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.verification_codes
  WHERE phone = p_phone
    AND created_at > now() - interval '5 minutes';
  RETURN recent_count < 3;
END;
$$;

-- Auto-cleanup old verification codes
CREATE OR REPLACE FUNCTION public.cleanup_old_verification_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.verification_codes WHERE created_at < now() - interval '1 hour';
END;
$$;