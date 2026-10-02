
-- 1. Temporary IP blocks instead of permanent / subnet blocks
ALTER TABLE public.blocked_ips ADD COLUMN IF NOT EXISTS expires_at timestamptz;
UPDATE public.blocked_ips SET expires_at = blocked_at + interval '24 hours' WHERE blocked_by IS NULL;
DELETE FROM public.blocked_ips WHERE is_pattern = true AND blocked_by IS NULL;

CREATE OR REPLACE FUNCTION public.is_ip_blocked(p_ip text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_ips
    WHERE is_pattern = false
      AND ip_address = p_ip
      AND (expires_at > now() OR (expires_at IS NULL AND blocked_by IS NOT NULL))
  )
$$;

CREATE OR REPLACE FUNCTION public.check_and_activate_attack_mode()
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_recent_count int;
BEGIN
  SELECT count(*) INTO v_recent_count FROM public.blocked_ips
  WHERE is_pattern = false AND blocked_at > now() - interval '1 hour';
  IF v_recent_count < 3 THEN RETURN false; END IF;
  -- No subnet blocking: only tighten checks (CAPTCHA) for 24h.
  INSERT INTO public.internal_config (key, value)
  VALUES ('attack_mode_until', (now() + interval '24 hours')::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  RETURN true;
END;
$$;

-- 2. Anonymous event bookings: never 'signed', never a business signature
DROP POLICY IF EXISTS "Anyone can create pending booking" ON public.event_bookings;
CREATE POLICY "Anyone can create pending booking" ON public.event_bookings
FOR INSERT TO anon, authenticated
WITH CHECK (
  status = ANY (ARRAY['pending','new'])
  AND business_signature IS NULL
  AND customer_name IS NOT NULL AND length(customer_name) BETWEEN 1 AND 120
  AND (customer_phone IS NULL OR length(customer_phone) BETWEEN 6 AND 20)
  AND (customer_email IS NULL OR length(customer_email) BETWEEN 3 AND 254)
  AND (event_address IS NULL OR length(event_address) <= 300)
  AND (invoice_name IS NULL OR length(invoice_name) <= 200)
  AND (business_id IS NULL OR length(business_id) <= 30)
  AND (event_type IS NULL OR length(event_type) <= 100)
  AND (package_name IS NULL OR length(package_name) <= 200)
  AND (contract_text IS NULL OR length(contract_text) <= 20000)
  AND (customer_signature IS NULL OR length(customer_signature) <= 200000)
);

-- 3. Business signature stored server-side, admin only
CREATE TABLE IF NOT EXISTS public.business_private_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  business_signature text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.business_private_settings TO authenticated;
GRANT ALL ON public.business_private_settings TO service_role;
ALTER TABLE public.business_private_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage private settings" ON public.business_private_settings
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.business_private_settings (id, business_signature)
SELECT 1, business_signature FROM public.event_settings WHERE id = 1
ON CONFLICT (id) DO UPDATE SET business_signature = EXCLUDED.business_signature;
UPDATE public.event_settings SET business_signature = NULL;
REVOKE SELECT (business_signature), UPDATE (business_signature) ON public.event_settings FROM anon, authenticated;

-- 4. Atomic inventory quantity changes (service role only)
CREATE OR REPLACE FUNCTION public.inventory_adjust(p_item uuid, p_delta numeric)
 RETURNS numeric LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  UPDATE public.inventory_items SET quantity = quantity + p_delta WHERE id = p_item RETURNING quantity
$$;
CREATE OR REPLACE FUNCTION public.inventory_set_quantity(p_item uuid, p_qty numeric)
 RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_old numeric;
BEGIN
  SELECT quantity INTO v_old FROM public.inventory_items WHERE id = p_item FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.inventory_items SET quantity = p_qty WHERE id = p_item;
  RETURN p_qty - v_old;
END;
$$;
REVOKE ALL ON FUNCTION public.inventory_adjust(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inventory_set_quantity(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_adjust(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.inventory_set_quantity(uuid, numeric) TO service_role;

-- 5. Store inventory tokens as SHA-256 hashes (existing links keep working)
UPDATE public.inventory_access_tokens
SET token = encode(extensions.digest(token, 'sha256'), 'hex')
WHERE token !~ '^[0-9a-f]{64}$';
