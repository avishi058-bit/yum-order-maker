
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create pending orders" ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (status IN ('new','pending'));

DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
CREATE POLICY "Anyone can create items for recent orders" ON public.order_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.created_at > now() - interval '10 minutes'
    )
  );

DROP POLICY IF EXISTS "Anyone can create delivery requests" ON public.delivery_requests;
CREATE POLICY "Anyone can create pending delivery requests" ON public.delivery_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending' AND courier_id IS NULL);

DROP POLICY IF EXISTS "Anyone can create booking" ON public.event_bookings;
CREATE POLICY "Anyone can create pending booking" ON public.event_bookings
  FOR INSERT TO anon, authenticated
  WITH CHECK (status IN ('pending','new'));

DROP POLICY IF EXISTS "Anyone can subscribe to push" ON public.push_subscriptions;
CREATE POLICY "Anyone can subscribe to push" ON public.push_subscriptions
  FOR INSERT TO anon, authenticated
  WITH CHECK (endpoint IS NOT NULL AND length(endpoint) < 2000);

DROP POLICY IF EXISTS "Anyone can subscribe for reopen notification" ON public.reopen_notifications;
CREATE POLICY "Anyone can subscribe for reopen notification" ON public.reopen_notifications
  FOR INSERT TO anon, authenticated
  WITH CHECK (phone IS NOT NULL AND length(phone) BETWEEN 6 AND 20);

DROP POLICY IF EXISTS "Anyone can create customers" ON public.customers;
CREATE POLICY "Anyone can create customers" ON public.customers
  FOR INSERT TO anon, authenticated
  WITH CHECK (phone IS NOT NULL AND length(phone) BETWEEN 6 AND 20);
