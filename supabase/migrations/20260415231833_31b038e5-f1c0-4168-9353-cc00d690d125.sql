
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kiosk_font_scale numeric NOT NULL DEFAULT 1.0,
  website_font_scale numeric NOT NULL DEFAULT 1.0,
  primary_color text NOT NULL DEFAULT '25 95% 53%',
  background_color text NOT NULL DEFAULT '0 0% 100%',
  menu_item_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  menu_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  banner_text text DEFAULT '',
  banner_enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site settings" ON public.site_settings FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can update site settings" ON public.site_settings FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can insert site settings" ON public.site_settings FOR INSERT TO public WITH CHECK (true);

INSERT INTO public.site_settings (id) VALUES (gen_random_uuid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;
