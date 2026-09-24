CREATE TABLE public.supply_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  includes_vat boolean NOT NULL DEFAULT true,
  purchased_at date NOT NULL DEFAULT CURRENT_DATE,
  finished_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supply_purchases TO authenticated;
GRANT ALL ON public.supply_purchases TO service_role;
ALTER TABLE public.supply_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage supplies" ON public.supply_purchases FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kitchen'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kitchen'));