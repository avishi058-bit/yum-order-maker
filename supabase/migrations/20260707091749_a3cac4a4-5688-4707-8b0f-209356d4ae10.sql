ALTER TABLE public.restaurant_status
  ADD COLUMN IF NOT EXISTS preorder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preorder_start_time time NOT NULL DEFAULT '10:00',
  ADD COLUMN IF NOT EXISTS preorder_end_time time NOT NULL DEFAULT '22:00';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;