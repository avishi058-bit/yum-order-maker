CREATE TABLE public.sauce_stock_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sauce text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('purchase','count')),
  quantity numeric NOT NULL,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sauce_stock_events TO authenticated;
GRANT ALL ON public.sauce_stock_events TO service_role;
ALTER TABLE public.sauce_stock_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage sauce stock" ON public.sauce_stock_events FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));