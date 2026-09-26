CREATE TABLE public.produce_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchased_at date NOT NULL DEFAULT CURRENT_DATE,
  supplier text,
  item_key text NOT NULL,
  raw_name text,
  quantity numeric,
  unit text,
  unit_price numeric,
  total numeric NOT NULL,
  prev_finished boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produce_purchases TO authenticated;
GRANT ALL ON public.produce_purchases TO service_role;
ALTER TABLE public.produce_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage produce" ON public.produce_purchases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.product_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_name text NOT NULL UNIQUE,
  item_key text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_aliases TO authenticated;
GRANT ALL ON public.product_aliases TO service_role;
ALTER TABLE public.product_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage aliases" ON public.product_aliases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.product_aliases (raw_name, item_key, label) VALUES ('קריספי פלוס','other','צ׳יפס קלאסי');

ALTER TABLE public.site_settings ADD COLUMN veg_cost_approved numeric;