ALTER TABLE public.site_settings 
  ADD COLUMN IF NOT EXISTS kiosk_image_height_px integer NOT NULL DEFAULT 380,
  ADD COLUMN IF NOT EXISTS kiosk_image_scale numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS kiosk_card_image_size_px integer NOT NULL DEFAULT 176,
  ADD COLUMN IF NOT EXISTS kiosk_spacing_scale numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS kiosk_ui_scale numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS kiosk_lock_layout boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS kiosk_disable_zoom boolean NOT NULL DEFAULT true;