INSERT INTO public.menu_availability (item_id, item_name, category, available)
VALUES
  ('arayes-special', 'ספיישל עראיס הבית', 'side', true),
  ('arayes-special-4', 'ספיישל עראיס הבית (4 רבעים)', 'side', true)
ON CONFLICT (item_id) DO NOTHING;