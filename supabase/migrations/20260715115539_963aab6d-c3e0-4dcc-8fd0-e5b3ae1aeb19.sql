
-- =========================================================================
-- H2: harden inventory_access_tokens — add expiry, revocation, and scope
-- =========================================================================
ALTER TABLE public.inventory_access_tokens
  ADD COLUMN IF NOT EXISTS expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at  timestamptz,
  ADD COLUMN IF NOT EXISTS scope       text NOT NULL DEFAULT 'admin'
    CHECK (scope IN ('admin', 'inventory'));

COMMENT ON COLUMN public.inventory_access_tokens.expires_at IS
  'When the token stops being accepted. NULL means no expiry (legacy tokens).';
COMMENT ON COLUMN public.inventory_access_tokens.revoked_at IS
  'When the token was manually revoked. Non-null = rejected regardless of expiry.';
COMMENT ON COLUMN public.inventory_access_tokens.scope IS
  '"admin" = full access including financial stats. "inventory" = stock CRUD only, no financial reads.';

-- =========================================================================
-- M2: restrict couriers to updating only status / courier_id / claimed_at
--     on delivery_requests. Payout, price, address, and customer contact
--     stay pinned to what staff created.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.enforce_courier_delivery_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce column-lock for courier callers; staff (kitchen/admin) can
  -- edit any field. Anyone bypassing RLS (service_role/edge functions) also
  -- passes through unrestricted.
  IF public.is_approved_courier(auth.uid())
     AND NOT (public.has_role(auth.uid(), 'admin')
              OR public.has_role(auth.uid(), 'kitchen'))
  THEN
    IF NEW.customer_name  IS DISTINCT FROM OLD.customer_name
       OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone
       OR NEW.address        IS DISTINCT FROM OLD.address
       OR NEW.zone_id        IS DISTINCT FROM OLD.zone_id
       OR NEW.zone_name      IS DISTINCT FROM OLD.zone_name
       OR NEW.price          IS DISTINCT FROM OLD.price
       OR NEW.payout         IS DISTINCT FROM OLD.payout
       OR NEW.lat            IS DISTINCT FROM OLD.lat
       OR NEW.lng            IS DISTINCT FROM OLD.lng
       OR NEW.order_id       IS DISTINCT FROM OLD.order_id
       OR NEW.client_token   IS DISTINCT FROM OLD.client_token
       OR NEW.created_at     IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'courier updates are limited to status and courier_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_courier_delivery_update ON public.delivery_requests;
CREATE TRIGGER trg_enforce_courier_delivery_update
  BEFORE UPDATE ON public.delivery_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_courier_delivery_update();
