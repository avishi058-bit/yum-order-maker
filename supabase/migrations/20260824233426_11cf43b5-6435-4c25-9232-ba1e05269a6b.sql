CREATE TABLE public.event_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  group_type TEXT,
  guests_count INTEGER,
  preferred_date DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.event_leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_leads TO authenticated;
GRANT ALL ON public.event_leads TO service_role;

ALTER TABLE public.event_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a lead"
ON public.event_leads FOR INSERT TO anon, authenticated
WITH CHECK (
  length(full_name) BETWEEN 1 AND 100
  AND length(phone) BETWEEN 6 AND 25
  AND (notes IS NULL OR length(notes) <= 1000)
  AND (guests_count IS NULL OR (guests_count > 0 AND guests_count <= 2000))
);

CREATE POLICY "Admins can view leads"
ON public.event_leads FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update leads"
ON public.event_leads FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete leads"
ON public.event_leads FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));