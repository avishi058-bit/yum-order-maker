-- Table for custom toppings added by staff
CREATE TABLE public.custom_toppings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id text NOT NULL UNIQUE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_toppings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read custom toppings"
  ON public.custom_toppings FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert custom toppings"
  ON public.custom_toppings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update custom toppings"
  ON public.custom_toppings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete custom toppings"
  ON public.custom_toppings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to insert and delete availability rows for the new toppings
CREATE POLICY "Admins can insert availability"
  ON public.menu_availability FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete availability"
  ON public.menu_availability FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_toppings;