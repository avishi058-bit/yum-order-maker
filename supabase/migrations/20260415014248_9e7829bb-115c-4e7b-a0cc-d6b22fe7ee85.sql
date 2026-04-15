CREATE TABLE public.menu_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id text NOT NULL UNIQUE,
  item_name text NOT NULL,
  category text NOT NULL DEFAULT 'menu',
  available boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read availability"
ON public.menu_availability
FOR SELECT
TO public
USING (true);

CREATE POLICY "Anyone can update availability"
ON public.menu_availability
FOR UPDATE
TO public
USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_availability;