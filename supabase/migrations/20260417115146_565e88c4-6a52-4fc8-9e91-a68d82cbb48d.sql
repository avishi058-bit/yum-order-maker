
-- Allow public to read orders for 60s after creation (just-inserted round-trip)
CREATE POLICY "Public can read very recent orders"
ON public.orders
FOR SELECT
TO anon, authenticated
USING (created_at > now() - interval '60 seconds');

CREATE POLICY "Public can read very recent order items"
ON public.order_items
FOR SELECT
TO anon, authenticated
USING (created_at > now() - interval '60 seconds');
