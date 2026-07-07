
-- 1) restaurant_status: delivery toggle
ALTER TABLE public.restaurant_status
  ADD COLUMN IF NOT EXISTS delivery_enabled boolean NOT NULL DEFAULT false;

-- 2) delivery_zones
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  keywords text[] NOT NULL DEFAULT ARRAY[]::text[],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_zones TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.delivery_zones TO authenticated;
GRANT ALL ON public.delivery_zones TO service_role;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active delivery zones"
  ON public.delivery_zones FOR SELECT
  USING (true);
CREATE POLICY "Admins/kitchen can manage delivery zones"
  ON public.delivery_zones FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kitchen'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kitchen'));
CREATE TRIGGER trg_delivery_zones_updated
  BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) delivery_requests
CREATE TABLE IF NOT EXISTS public.delivery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text,
  customer_phone text,
  address text NOT NULL,
  zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  zone_name text,
  price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected | completed
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.delivery_requests TO anon, authenticated;
GRANT ALL ON public.delivery_requests TO service_role;
ALTER TABLE public.delivery_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create delivery requests"
  ON public.delivery_requests FOR INSERT
  WITH CHECK (true);
CREATE POLICY "Anyone can read delivery requests"
  ON public.delivery_requests FOR SELECT
  USING (true);
CREATE POLICY "Anyone can update delivery requests"
  ON public.delivery_requests FOR UPDATE
  USING (true)
  WITH CHECK (true);
CREATE TRIGGER trg_delivery_requests_updated
  BEFORE UPDATE ON public.delivery_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_requests;
ALTER TABLE public.delivery_requests REPLICA IDENTITY FULL;

-- 4) orders: delivery link
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_request_id uuid REFERENCES public.delivery_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric;
