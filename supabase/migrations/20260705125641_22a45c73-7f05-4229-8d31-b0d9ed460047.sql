
-- Bookings table
CREATE TABLE public.event_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text NOT NULL,
  event_date date NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  event_type text NOT NULL,
  event_address text NOT NULL,
  guests_count int NOT NULL,
  package_id text NOT NULL,
  package_name text NOT NULL,
  package_price_per_person numeric NOT NULL,
  addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL,
  total_price numeric NOT NULL,
  min_applied boolean NOT NULL DEFAULT false,
  contract_text text,
  customer_signature text,
  business_signature text,
  signed_at timestamptz,
  client_ip text,
  pdf_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.event_bookings TO anon, authenticated;
GRANT ALL ON public.event_bookings TO service_role;
ALTER TABLE public.event_bookings ENABLE ROW LEVEL SECURITY;

-- Anyone can create a booking
CREATE POLICY "Anyone can create booking" ON public.event_bookings
  FOR INSERT WITH CHECK (true);

-- Anyone can update their booking (to add signatures) - by id (public)
CREATE POLICY "Anyone can update booking" ON public.event_bookings
  FOR UPDATE USING (true) WITH CHECK (true);

-- Only admins can view all bookings
CREATE POLICY "Admins can view all bookings" ON public.event_bookings
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Blocked dates
CREATE TABLE public.event_blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_date date NOT NULL UNIQUE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_blocked_dates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_blocked_dates TO authenticated;
GRANT ALL ON public.event_blocked_dates TO service_role;
ALTER TABLE public.event_blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view blocked dates" ON public.event_blocked_dates
  FOR SELECT USING (true);
CREATE POLICY "Admins manage blocked dates" ON public.event_blocked_dates
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Settings (contract template)
CREATE TABLE public.event_settings (
  id int PRIMARY KEY DEFAULT 1,
  contract_template text NOT NULL DEFAULT '',
  minimum_amount numeric NOT NULL DEFAULT 2000,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

GRANT SELECT ON public.event_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.event_settings TO authenticated;
GRANT ALL ON public.event_settings TO service_role;
ALTER TABLE public.event_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view event settings" ON public.event_settings
  FOR SELECT USING (true);
CREATE POLICY "Admins update event settings" ON public.event_settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed default contract
INSERT INTO public.event_settings (id, contract_template) VALUES (
  1,
  'חוזה הזמנת אירוע – שולחן שוק / המבורגר הבקתה

בין: הבקתה (להלן: "בעל העסק")
לבין: {{customer_name}}, ת.ז/טלפון: {{customer_phone}}, אימייל: {{customer_email}} (להלן: "הלקוח")

1. פרטי האירוע:
   - סוג: {{event_type}}
   - תאריך: {{event_date}}
   - שעות: {{start_time}} - {{end_time}}
   - כתובת: {{event_address}}
   - מספר אורחים: {{guests_count}}

2. מסלול נבחר: {{package_name}} – {{package_price}} ₪ לאדם.
   תוספות: {{addons_list}}

3. סכום כולל: {{total_price}} ₪ (כולל מע"מ). מינימום הזמנה 2,000 ₪.

4. מקדמה של 30% תשולם בעת החתימה. היתרה עד 7 ימים לפני האירוע.

5. ביטול עד 30 יום לפני האירוע – החזר מלא של המקדמה. בין 14-30 יום – החזר 50%. פחות מ-14 יום – ללא החזר.

6. הצדדים מאשרים בחתימתם את תנאי החוזה.'
);

-- Trigger for updated_at
CREATE TRIGGER update_event_bookings_updated_at
  BEFORE UPDATE ON public.event_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
