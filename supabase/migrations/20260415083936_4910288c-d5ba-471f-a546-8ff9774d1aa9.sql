
CREATE TABLE public.restaurant_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  website_open boolean NOT NULL DEFAULT true,
  station_open boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read restaurant status" ON public.restaurant_status FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can update restaurant status" ON public.restaurant_status FOR UPDATE TO public USING (true);

INSERT INTO public.restaurant_status (website_open, station_open) VALUES (true, true);
