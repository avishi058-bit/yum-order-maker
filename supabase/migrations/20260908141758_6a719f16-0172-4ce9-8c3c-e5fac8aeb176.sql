ALTER TABLE public.restaurant_status
  ADD COLUMN IF NOT EXISTS kiosk_cash_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS kiosk_credit_enabled boolean NOT NULL DEFAULT true;
UPDATE public.restaurant_status SET kiosk_cash_enabled = cash_enabled, kiosk_credit_enabled = credit_enabled;