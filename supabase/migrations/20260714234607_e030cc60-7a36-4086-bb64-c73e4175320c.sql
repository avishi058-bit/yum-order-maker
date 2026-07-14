
-- ============================================================
-- CRITICAL SECURITY FIX: close public read/write on PII tables
-- ============================================================

-- ---------- delivery_requests ----------
DROP POLICY IF EXISTS "Anyone can read delivery requests" ON public.delivery_requests;
DROP POLICY IF EXISTS "Anyone can update delivery requests" ON public.delivery_requests;

-- Staff (admin/kitchen) full read + update
CREATE POLICY "Staff can read delivery requests"
  ON public.delivery_requests FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role));

CREATE POLICY "Staff can update delivery requests"
  ON public.delivery_requests FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role));

-- Anon customers can only finalize a request they know the id of (cancel/complete)
CREATE POLICY "Anon can finalize own delivery request"
  ON public.delivery_requests FOR UPDATE
  TO anon, authenticated
  USING (status IN ('pending', 'claimed'))
  WITH CHECK (status IN ('rejected', 'completed'));

-- ---------- event_bookings ----------
DROP POLICY IF EXISTS "Anyone can update booking" ON public.event_bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.event_bookings;

CREATE POLICY "Staff can view bookings"
  ON public.event_bookings FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role));

CREATE POLICY "Staff can update bookings"
  ON public.event_bookings FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role));
