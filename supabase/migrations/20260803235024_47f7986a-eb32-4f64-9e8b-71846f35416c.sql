INSERT INTO public.menu_availability (item_id, item_name, category, available)
VALUES ('crispy-chicken', 'קריספי צ׳יקן', 'burger', true),
       ('meal-crispy-chicken', 'ארוחת קריספי צ׳יקן', 'meal', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.inventory_items (name, category, unit, quantity, low_threshold, presets, menu_item_id, sort_order, unit_cost, fridge_target, fridge_qty)
VALUES ('חזה עוף קריספי', 'בשר', 'unit', 0, 5, '[]'::jsonb, 'crispy-chicken', 11, 0, 0, 0)
ON CONFLICT DO NOTHING;

INSERT INTO public.inventory_recipes (menu_item_id, inventory_item_id, amount_per_unit)
SELECT m.mid, i.id, 1
FROM (VALUES ('crispy-chicken'), ('meal-crispy-chicken')) AS m(mid)
JOIN public.inventory_items i ON i.name IN ('חזה עוף קריספי', 'לחמניה רגילה')
ON CONFLICT DO NOTHING;