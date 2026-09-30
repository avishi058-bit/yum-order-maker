CREATE TABLE public.stock_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL,
  kind text NOT NULL DEFAULT 'count',
  quantity numeric NOT NULL DEFAULT 0,
  unit text,
  counted_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.stock_counts TO service_role;
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read stock counts" ON public.stock_counts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.stock_counts TO authenticated;
CREATE INDEX stock_counts_key_idx ON public.stock_counts(item_key, counted_at);