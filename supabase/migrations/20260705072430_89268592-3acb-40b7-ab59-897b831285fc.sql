ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS google_review_url text;