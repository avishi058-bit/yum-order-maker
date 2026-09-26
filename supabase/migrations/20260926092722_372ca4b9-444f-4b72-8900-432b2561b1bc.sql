ALTER TABLE public.supply_purchases ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'supply';
ALTER TABLE public.supply_purchases ADD COLUMN IF NOT EXISTS supplier text;