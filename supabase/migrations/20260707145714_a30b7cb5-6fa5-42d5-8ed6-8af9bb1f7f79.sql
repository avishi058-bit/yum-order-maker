
-- Enum extension MUST be committed before use; do it first only
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'courier';

ALTER TABLE public.delivery_requests
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric,
  ADD COLUMN IF NOT EXISTS courier_id uuid,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout numeric;

CREATE TABLE IF NOT EXISTS public.couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.couriers TO authenticated;
GRANT ALL ON public.couriers TO service_role;
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role='admin')
$$;

CREATE POLICY "couriers self read" ON public.couriers
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role_admin(auth.uid()));
CREATE POLICY "couriers self insert" ON public.couriers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "couriers admin update" ON public.couriers
  FOR UPDATE TO authenticated USING (public.has_role_admin(auth.uid())) WITH CHECK (public.has_role_admin(auth.uid()));
CREATE POLICY "couriers admin delete" ON public.couriers
  FOR DELETE TO authenticated USING (public.has_role_admin(auth.uid()));

CREATE TRIGGER couriers_updated BEFORE UPDATE ON public.couriers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_approved_courier(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.couriers WHERE user_id = _uid AND status = 'approved')
$$;

CREATE OR REPLACE FUNCTION public.current_courier_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id FROM public.couriers WHERE user_id = auth.uid() AND status = 'approved' LIMIT 1
$$;

CREATE TABLE IF NOT EXISTS public.courier_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.courier_push_subscriptions TO authenticated;
GRANT ALL ON public.courier_push_subscriptions TO service_role;
ALTER TABLE public.courier_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courier push self" ON public.courier_push_subscriptions
  FOR ALL TO authenticated
  USING (courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid()) OR public.has_role_admin(auth.uid()))
  WITH CHECK (courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.courier_locations (
  courier_id uuid PRIMARY KEY REFERENCES public.couriers(id) ON DELETE CASCADE,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.courier_locations TO authenticated;
GRANT ALL ON public.courier_locations TO service_role;
ALTER TABLE public.courier_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courier loc self write" ON public.courier_locations
  FOR ALL TO authenticated
  USING (courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid()) OR public.has_role_admin(auth.uid()))
  WITH CHECK (courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid()));

-- delivery_requests visibility & claim for couriers
CREATE POLICY "couriers see open and own"
  ON public.delivery_requests
  FOR SELECT TO authenticated
  USING (
    public.is_approved_courier(auth.uid())
    AND (status = 'pending' OR courier_id = public.current_courier_id())
  );

CREATE POLICY "courier claim own"
  ON public.delivery_requests
  FOR UPDATE TO authenticated
  USING (public.is_approved_courier(auth.uid()) AND (status='pending' OR courier_id = public.current_courier_id()))
  WITH CHECK (public.is_approved_courier(auth.uid()));

-- Realtime (delivery_requests already in publication; add locations only)
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.courier_locations;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Trigger: notify couriers on new pending delivery request
CREATE OR REPLACE FUNCTION public.notify_couriers_new_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, extensions AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM net.http_post(
      url := 'https://kdkcygokopwvutwvrgnp.supabase.co/functions/v1/notify-couriers-new-delivery',
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('request_id', NEW.id::text)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_couriers_new_delivery ON public.delivery_requests;
CREATE TRIGGER notify_couriers_new_delivery
  AFTER INSERT ON public.delivery_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_couriers_new_delivery();
