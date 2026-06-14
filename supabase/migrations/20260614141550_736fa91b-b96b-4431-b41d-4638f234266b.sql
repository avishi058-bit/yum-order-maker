
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS unit_cost numeric NOT NULL DEFAULT 0;

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS unit_cost numeric;
