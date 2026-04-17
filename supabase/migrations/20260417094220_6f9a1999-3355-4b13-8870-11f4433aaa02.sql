-- Saved carts: one row per customer (by phone) or guest (by guest_id)
CREATE TABLE public.saved_carts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text,
  guest_id text,
  customer_name text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  dine_in boolean,
  total numeric NOT NULL DEFAULT 0,
  resumed_count integer NOT NULL DEFAULT 0,
  last_action text NOT NULL DEFAULT 'updated',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_carts_owner_chk CHECK (phone IS NOT NULL OR guest_id IS NOT NULL)
);

-- One saved cart per phone, one per guest
CREATE UNIQUE INDEX saved_carts_phone_uniq ON public.saved_carts (phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX saved_carts_guest_uniq ON public.saved_carts (guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX saved_carts_updated_at_idx ON public.saved_carts (updated_at DESC);

-- Auto-update updated_at on every change
CREATE TRIGGER saved_carts_set_updated_at
BEFORE UPDATE ON public.saved_carts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Row level security
ALTER TABLE public.saved_carts ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can read/write/delete carts.
-- Identification of "the user's cart" happens at the application level via
-- phone or guest_id (UUID stored in the browser). This matches the existing
-- customer model in this project (no auth.uid linkage on customers table).
CREATE POLICY "Anyone can create their saved cart"
ON public.saved_carts
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Anyone can read saved carts"
ON public.saved_carts
FOR SELECT
TO public
USING (true);

CREATE POLICY "Anyone can update saved carts"
ON public.saved_carts
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can delete saved carts"
ON public.saved_carts
FOR DELETE
TO public
USING (true);

-- Cleanup helper for expired carts (>48h untouched)
CREATE OR REPLACE FUNCTION public.cleanup_expired_saved_carts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.saved_carts
  WHERE updated_at < now() - interval '48 hours';
END;
$$;