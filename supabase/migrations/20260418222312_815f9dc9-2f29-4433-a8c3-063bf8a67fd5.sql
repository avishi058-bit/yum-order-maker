-- Bump kiosk defaults to be physically large for a real kiosk station
-- (customer is standing in front of a screen, not holding a phone).
UPDATE public.site_settings
SET
  kiosk_modal_height_vh = 78,
  kiosk_image_height_px = 460,
  kiosk_image_scale = 1.1,
  kiosk_card_image_size_px = 240,
  kiosk_spacing_scale = 1.15,
  kiosk_ui_scale = 1.0,
  kiosk_font_scale = 1.4;

-- Update column defaults so any future row gets kiosk-sized values
ALTER TABLE public.site_settings ALTER COLUMN kiosk_modal_height_vh SET DEFAULT 78;
ALTER TABLE public.site_settings ALTER COLUMN kiosk_image_height_px SET DEFAULT 460;
ALTER TABLE public.site_settings ALTER COLUMN kiosk_image_scale SET DEFAULT 1.1;
ALTER TABLE public.site_settings ALTER COLUMN kiosk_card_image_size_px SET DEFAULT 240;
ALTER TABLE public.site_settings ALTER COLUMN kiosk_spacing_scale SET DEFAULT 1.15;
ALTER TABLE public.site_settings ALTER COLUMN kiosk_font_scale SET DEFAULT 1.4;