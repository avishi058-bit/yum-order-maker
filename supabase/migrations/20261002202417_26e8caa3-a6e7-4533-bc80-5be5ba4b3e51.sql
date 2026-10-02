CREATE POLICY "Kitchen reads test customers" ON public.test_customers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'kitchen'));