-- Security hardening: unauthenticated visitors should not be able to read
-- business financial configuration stored in site_settings, even though they
-- need the operational settings (business hours, banner, menu order, kiosk
-- layout) for the public site.

REVOKE ALL ON public.site_settings FROM anon;

GRANT SELECT (
  id,
  kiosk_font_scale,
  website_font_scale,
  primary_color,
  background_color,
  menu_item_overrides,
  menu_order,
  banner_text,
  banner_enabled,
  business_hours,
  kiosk_modal_height_vh,
  website_modal_height_vh,
  kiosk_image_height_px,
  kiosk_image_scale,
  kiosk_card_image_size_px,
  kiosk_spacing_scale,
  kiosk_ui_scale,
  kiosk_lock_layout,
  kiosk_disable_zoom,
  google_review_url,
  created_at,
  updated_at
) ON public.site_settings TO anon;

-- Defense in depth: anon never had any RLS policy on these internal tables,
-- so these grants were inert; remove them so future policy mistakes can't
-- expose payroll/supply/soldier-fund data to unauthenticated callers.
REVOKE SELECT ON public.work_shifts FROM anon;
REVOKE SELECT ON public.supply_purchases FROM anon;
REVOKE SELECT ON public.produce_purchases FROM anon;
REVOKE SELECT ON public.soldier_fund_ledger FROM anon;