ALTER TABLE public.restaurant_status
  ADD COLUMN IF NOT EXISTS high_load boolean NOT NULL DEFAULT false;