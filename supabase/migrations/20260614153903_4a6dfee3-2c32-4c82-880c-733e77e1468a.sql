GRANT SELECT ON public.inventory_items TO authenticated;

CREATE POLICY "Kitchen and admin can read inventory items"
ON public.inventory_items
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kitchen'));