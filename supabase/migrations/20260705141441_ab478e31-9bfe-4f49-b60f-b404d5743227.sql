
ALTER TABLE public.event_bookings
  ADD COLUMN IF NOT EXISTS drink_selections jsonb NOT NULL DEFAULT '{}'::jsonb;
