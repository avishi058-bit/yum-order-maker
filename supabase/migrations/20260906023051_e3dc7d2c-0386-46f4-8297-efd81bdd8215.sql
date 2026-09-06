INSERT INTO public.menu_availability (item_id, item_name, category, available)
VALUES ('crispy-onion-bits', 'שבבי בצל קריספי', 'topping', true)
ON CONFLICT (item_id) DO UPDATE SET item_name = EXCLUDED.item_name;