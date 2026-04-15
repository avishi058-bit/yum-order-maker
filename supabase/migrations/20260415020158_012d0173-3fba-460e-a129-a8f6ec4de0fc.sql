
-- Fix burger names
UPDATE public.menu_availability SET item_name = 'ספיישל הדגל' WHERE item_id = 'special-hadegel';

-- Fix meal names
UPDATE public.menu_availability SET item_name = 'ארוחת ספיישל הדגל' WHERE item_id = 'meal-special-hadegel';

-- Fix drink names
UPDATE public.menu_availability SET item_name = 'בירה' WHERE item_id = 'beer-regular';
UPDATE public.menu_availability SET item_name = 'בקבוק' WHERE item_id = 'bottle';
UPDATE public.menu_availability SET item_name = 'צ׳יפס' WHERE item_id = 'fries-regular';

-- Fix item_ids to match menu.ts
UPDATE public.menu_availability SET item_id = 'fries' WHERE item_id = 'fries-regular';
UPDATE public.menu_availability SET item_id = 'waffle-fries' WHERE item_id = 'fries-waffle';

-- Add missing items
INSERT INTO public.menu_availability (item_id, item_name, category, available) VALUES
  ('haf-mifsha', 'חף מפשע', 'burger', true),
  ('meal-haf-mifsha', 'ארוחת חף מפשע', 'meal', true),
  ('beer-weiss', 'ויינשטפאן (חצי)', 'drink', true)
ON CONFLICT DO NOTHING;

-- Remove items not in menu
DELETE FROM public.menu_availability WHERE item_id IN ('flavored-water', 'water');
