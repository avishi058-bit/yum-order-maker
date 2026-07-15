-- Support subnet-prefix blocks (e.g. '1.2.3.' blocks all 1.2.3.*)
ALTER TABLE public.blocked_ips ADD COLUMN IF NOT EXISTS is_pattern boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_ip_blocked(p_ip text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_ips
    WHERE
      (is_pattern = false AND ip_address = p_ip)
      OR (is_pattern = true AND p_ip LIKE ip_address || '%')
  )
$$;

-- Attack detection: if 3+ IPs blocked in the last hour, mark it as an active attack:
--   1. block the /24 subnet of every recently-blocked IP (pattern rows like '1.2.3.')
--   2. set attack_mode_until = now() + 24h in internal_config
CREATE OR REPLACE FUNCTION public.check_and_activate_attack_mode()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count int;
  v_ip text;
  v_subnet text;
BEGIN
  SELECT count(*) INTO v_recent_count
  FROM public.blocked_ips
  WHERE is_pattern = false
    AND blocked_at > now() - interval '1 hour';

  IF v_recent_count < 3 THEN
    RETURN false;
  END IF;

  -- Block /24 subnet of every recent attacker (IPv4 only; IPv6 stored as-is)
  FOR v_ip IN
    SELECT ip_address FROM public.blocked_ips
    WHERE is_pattern = false AND blocked_at > now() - interval '1 hour'
  LOOP
    IF v_ip ~ '^\d+\.\d+\.\d+\.\d+$' THEN
      v_subnet := (regexp_match(v_ip, '^(\d+\.\d+\.\d+\.)'))[1];
      IF v_subnet IS NOT NULL THEN
        INSERT INTO public.blocked_ips (ip_address, reason, is_pattern)
        VALUES (v_subnet, 'attack_pattern: /24 subnet auto-blocked (3+ IPs in 1h)', true)
        ON CONFLICT (ip_address) DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  -- Activate 24h high-alert mode
  INSERT INTO public.internal_config (key, value)
  VALUES ('attack_mode_until', (now() + interval '24 hours')::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_attack_mode_active()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value::timestamptz > now()
     FROM public.internal_config
     WHERE key = 'attack_mode_until'),
    false
  )
$$;