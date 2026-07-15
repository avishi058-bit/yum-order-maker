
-- Change default to random 4-digit number
ALTER TABLE public.orders
  ALTER COLUMN order_number SET DEFAULT floor(random() * 9000 + 1000)::int;

-- Drop the old sequence (no longer used)
DROP SEQUENCE IF EXISTS public.orders_order_number_seq CASCADE;

-- Backfill existing rows with random 4-digit numbers
UPDATE public.orders
SET order_number = floor(random() * 9000 + 1000)::int;
