INSERT INTO public.menu_availability (item_id, item_name, category, available)
VALUES ('fuze-tea', 'פיוז טי', 'drink', true)
ON CONFLICT DO NOTHING;