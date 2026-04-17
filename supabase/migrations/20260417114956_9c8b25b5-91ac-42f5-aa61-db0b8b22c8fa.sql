
-- =========================================================
-- ORDERS: remove public SELECT, keep public INSERT for guest checkout
-- =========================================================
DROP POLICY IF EXISTS "Anyone can read orders" ON public.orders;

-- Staff can read all orders (admin/kitchen)
CREATE POLICY "Staff can read orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'kitchen'::app_role)
);

-- Public guest checkout: INSERT remains allowed (existing policy "Anyone can create orders")

-- =========================================================
-- ORDER_ITEMS: remove public SELECT, keep public INSERT for guest checkout
-- =========================================================
DROP POLICY IF EXISTS "Anyone can read order items" ON public.order_items;

CREATE POLICY "Staff can read order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'kitchen'::app_role)
);

-- =========================================================
-- SAVED_CARTS: lock down completely. All access goes through edge function (service role).
-- =========================================================
DROP POLICY IF EXISTS "Anyone can read saved carts" ON public.saved_carts;
DROP POLICY IF EXISTS "Anyone can update saved carts" ON public.saved_carts;
DROP POLICY IF EXISTS "Anyone can delete saved carts" ON public.saved_carts;
DROP POLICY IF EXISTS "Anyone can create their saved cart" ON public.saved_carts;

-- Staff can read for support/debugging
CREATE POLICY "Staff can read saved carts"
ON public.saved_carts
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'kitchen'::app_role)
);
-- All client read/write/delete now happen ONLY via edge function using service role.
