-- Remove the discontinued "הגל" drink
DELETE FROM public.menu_availability WHERE item_id = 'drink-wave';

-- Add new standalone drinks: water and soda
INSERT INTO public.menu_availability (item_id, item_name, category, available, manually_disabled)
VALUES
  ('water', 'מים (בקבוק)', 'drink', true, false),
  ('soda', 'סודה (בקבוק)', 'drink', true, false)
ON CONFLICT (item_id) DO NOTHING;