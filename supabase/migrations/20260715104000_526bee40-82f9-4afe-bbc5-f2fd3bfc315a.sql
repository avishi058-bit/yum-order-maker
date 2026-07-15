
-- 1) Drop unused anon INSERT policy on customers. All customer writes go
-- through the customer-auth edge function using service_role.
DROP POLICY IF EXISTS "Anyone can create customers" ON public.customers;

-- 2) Tighten event_bookings INSERT: hard length limits + allow status 'signed'
-- (the signed contract flow the client actually uses).
DROP POLICY IF EXISTS "Anyone can create pending booking" ON public.event_bookings;

CREATE POLICY "Anyone can create pending booking"
ON public.event_bookings
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = ANY (ARRAY['pending','new','signed'])
  AND customer_name IS NOT NULL
  AND length(customer_name) BETWEEN 1 AND 120
  AND (customer_phone IS NULL OR length(customer_phone) BETWEEN 6 AND 20)
  AND (customer_email IS NULL OR length(customer_email) BETWEEN 3 AND 254)
  AND (event_address IS NULL OR length(event_address) <= 300)
  AND (invoice_name IS NULL OR length(invoice_name) <= 200)
  AND (business_id IS NULL OR length(business_id) <= 30)
  AND (event_type IS NULL OR length(event_type) <= 100)
  AND (package_name IS NULL OR length(package_name) <= 200)
  AND (contract_text IS NULL OR length(contract_text) <= 20000)
  AND (customer_signature IS NULL OR length(customer_signature) <= 200000)
  AND (business_signature IS NULL OR length(business_signature) <= 200000)
);
