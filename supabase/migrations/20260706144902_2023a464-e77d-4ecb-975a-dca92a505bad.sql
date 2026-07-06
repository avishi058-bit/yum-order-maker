-- Add the new beers to kitchen availability and inventory end-to-end.

INSERT INTO public.menu_availability (item_id, item_name, category, available, manually_disabled)
VALUES
  ('drink-shapira', 'שפירא', 'drink', true, false),
  ('drink-maccabi', 'מכבי 7.9%', 'drink', true, false)
ON CONFLICT (item_id) DO UPDATE
SET item_name = EXCLUDED.item_name,
    category = EXCLUDED.category,
    updated_at = now();

WITH new_items AS (
  INSERT INTO public.inventory_items (
    name,
    category,
    unit,
    quantity,
    low_threshold,
    presets,
    menu_item_id,
    sort_order,
    notes,
    unit_cost,
    fridge_target,
    fridge_qty
  )
  VALUES
    (
      'בירה שפירא',
      'בירות',
      'unit',
      0,
      0,
      '[{"label":"ארגז 24","amount":24},{"label":"+ יחידה","amount":1},{"label":"- יחידה","amount":-1}]'::jsonb,
      'drink-shapira',
      69,
      NULL,
      0,
      7,
      0
    ),
    (
      'בירה מכבי 7.9%',
      'בירות',
      'unit',
      0,
      0,
      '[{"label":"ארגז 24","amount":24},{"label":"+ יחידה","amount":1},{"label":"- יחידה","amount":-1}]'::jsonb,
      'drink-maccabi',
      70,
      NULL,
      0,
      7,
      0
    )
  ON CONFLICT DO NOTHING
  RETURNING id, menu_item_id
), existing_items AS (
  SELECT id, menu_item_id
  FROM public.inventory_items
  WHERE menu_item_id IN ('drink-shapira', 'drink-maccabi')
), beer_map AS (
  SELECT id, menu_item_id FROM new_items
  UNION
  SELECT id, menu_item_id FROM existing_items
), recipe_rows AS (
  SELECT
    CASE beer_map.menu_item_id
      WHEN 'drink-shapira' THEN recipe_id
      WHEN 'drink-maccabi' THEN replace(recipe_id, 'shapira', 'maccabi')
    END AS menu_item_id,
    beer_map.id AS inventory_item_id,
    1::numeric AS amount_per_unit
  FROM beer_map
  CROSS JOIN unnest(ARRAY[
    'beer-shapira',
    'drink-shapira',
    'deal-shapira',
    'fam-shapira'
  ]) AS recipe_id
)
INSERT INTO public.inventory_recipes (menu_item_id, inventory_item_id, amount_per_unit)
SELECT menu_item_id, inventory_item_id, amount_per_unit
FROM recipe_rows
ON CONFLICT (menu_item_id, inventory_item_id) DO UPDATE
SET amount_per_unit = EXCLUDED.amount_per_unit,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.resolve_fridge_menu_ids(p_value text)
RETURNS text[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v text := lower(coalesce(p_value, ''));
  ids text[] := ARRAY[]::text[];
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN ids;
  END IF;

  ids := array_append(ids, p_value);

  CASE
    WHEN v LIKE '%זירו%' AND v NOT LIKE '%ספרייט%' THEN ids := ids || ARRAY['drink-zero', 'can-zero', 'deal-zero', 'fam-zero'];
    WHEN v LIKE '%קולה%' THEN ids := ids || ARRAY['drink-cola', 'can-cola', 'deal-cola', 'fam-cola'];
    WHEN v LIKE '%ספרייט%' AND v LIKE '%זירו%' THEN ids := ids || ARRAY['drink-sprite-zero', 'deal-sprite-zero'];
    WHEN v LIKE '%ספרייט%' THEN ids := ids || ARRAY['drink-sprite', 'can-sprite', 'deal-sprite', 'fam-sprite'];
    WHEN v LIKE '%פאנטה%' AND v LIKE '%ענבים%' THEN ids := ids || ARRAY['drink-fanta-grape', 'deal-fanta-grape'];
    WHEN v LIKE '%פאנטה%' AND v LIKE '%אקזוטי%' THEN ids := ids || ARRAY['drink-fanta-exotic', 'deal-fanta-exotic'];
    WHEN v LIKE '%פאנטה%' THEN ids := ids || ARRAY['drink-fanta', 'can-fanta', 'deal-fanta', 'fam-fanta'];
    WHEN v LIKE '%ענבים%' AND (v LIKE '%בקבוק%' OR v LIKE '%bottle%') THEN ids := ids || ARRAY['drink-grapes', 'bottle-grapes', 'deal-grapes', 'fam-grapes'];
    WHEN v LIKE '%תפוזים%' OR v LIKE '%תפוז%' THEN ids := ids || ARRAY['drink-apples', 'bottle-apples', 'deal-oranges', 'fam-apples'];
    WHEN v LIKE '%מים%' AND v LIKE '%תפוח%' THEN ids := ids || ARRAY['drink-flavored-water-apple', 'flavored-water-apple', 'fam-flavored-water-apple'];
    WHEN v LIKE '%מים%' AND v LIKE '%ענבים%' THEN ids := ids || ARRAY['drink-flavored-water-grape', 'flavored-water-grape', 'fam-flavored-water-grape'];
    WHEN v LIKE '%מים%' THEN ids := ids || ARRAY['water', 'drink-water', 'deal-water', 'fam-water'];
    WHEN v LIKE '%סודה%' THEN ids := ids || ARRAY['soda', 'drink-soda', 'deal-soda', 'fam-soda'];
    WHEN v LIKE '%גולדסטאר%' AND v LIKE '%אנפילטר%' THEN ids := ids || ARRAY['drink-unfiltered', 'beer-unfiltered', 'deal-unfiltered', 'fam-unfiltered'];
    WHEN v LIKE '%גולדסטאר%' THEN ids := ids || ARRAY['drink-goldstar', 'beer-goldstar', 'deal-goldstar', 'fam-goldstar'];
    WHEN v LIKE '%הייניקן%' THEN ids := ids || ARRAY['drink-heineken', 'beer-heineken', 'deal-heineken', 'fam-heineken'];
    WHEN v LIKE '%קורונה%' THEN ids := ids || ARRAY['drink-corona', 'beer-corona', 'deal-corona', 'fam-corona'];
    WHEN v LIKE '%קאלסברג%' OR v LIKE '%קלסטברג%' THEN ids := ids || ARRAY['drink-carlsberg', 'beer-carlsberg', 'deal-carlsberg', 'fam-carlsberg'];
    WHEN v LIKE '%לאף%' OR v LIKE '%לאפ%' THEN ids := ids || ARRAY['drink-laffe', 'beer-laffe', 'deal-laffe', 'fam-laffe'];
    WHEN v LIKE '%פאולנר%' THEN ids := ids || ARRAY['drink-paulaner', 'beer-paulaner'];
    WHEN v LIKE '%סטלה%' THEN ids := ids || ARRAY['drink-stella', 'beer-stella'];
    WHEN v LIKE '%הוגרדן%' THEN ids := ids || ARRAY['drink-hoegaarden', 'beer-hoegaarden'];
    WHEN v LIKE '%שפירא%' THEN ids := ids || ARRAY['drink-shapira', 'beer-shapira', 'deal-shapira', 'fam-shapira'];
    WHEN v LIKE '%מכבי%' THEN ids := ids || ARRAY['drink-maccabi', 'beer-maccabi', 'deal-maccabi', 'fam-maccabi'];
    WHEN v LIKE '%גינס%' THEN ids := ids || ARRAY['drink-guinness', 'deal-guinness', 'fam-guinness'];
    ELSE NULL;
  END CASE;

  RETURN ARRAY(SELECT DISTINCT x FROM unnest(ids) AS x WHERE x IS NOT NULL AND btrim(x) <> '');
END;
$function$;