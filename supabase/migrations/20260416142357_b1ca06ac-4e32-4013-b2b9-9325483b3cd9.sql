
-- Fix orders: only admin/kitchen can update
DROP POLICY IF EXISTS "Anyone can update orders" ON public.orders;
CREATE POLICY "Staff can update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kitchen'));

-- Fix menu_availability: only admin can update
DROP POLICY IF EXISTS "Anyone can update availability" ON public.menu_availability;
CREATE POLICY "Admins can update availability"
  ON public.menu_availability FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix restaurant_status: only admin can update
DROP POLICY IF EXISTS "Anyone can update restaurant status" ON public.restaurant_status;
CREATE POLICY "Admins can update restaurant status"
  ON public.restaurant_status FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix site_settings: only admin can update
DROP POLICY IF EXISTS "Anyone can update site settings" ON public.site_settings;
CREATE POLICY "Admins can update site settings"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix site_settings: only admin can insert
DROP POLICY IF EXISTS "Anyone can insert site settings" ON public.site_settings;
CREATE POLICY "Admins can insert site settings"
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix customers: only admin can update
DROP POLICY IF EXISTS "Anyone can update customers" ON public.customers;
CREATE POLICY "Admins can update customers"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
