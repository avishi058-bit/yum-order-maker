
-- Add payment_method to orders
ALTER TABLE public.orders ADD COLUMN payment_method text DEFAULT 'cash';

-- Add cash/credit toggle to restaurant_status
ALTER TABLE public.restaurant_status ADD COLUMN cash_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.restaurant_status ADD COLUMN credit_enabled boolean NOT NULL DEFAULT true;
