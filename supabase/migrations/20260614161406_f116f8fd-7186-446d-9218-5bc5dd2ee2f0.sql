CREATE OR REPLACE FUNCTION public.resolve_fridge_menu_ids(p_value text)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    WHEN v LIKE '%גינס%' THEN ids := ids || ARRAY['drink-guinness', 'deal-guinness', 'fam-guinness'];
    ELSE NULL;
  END CASE;

  RETURN ARRAY(SELECT DISTINCT x FROM unnest(ids) AS x WHERE x IS NOT NULL AND btrim(x) <> '');
END;
$$;

CREATE OR REPLACE FUNCTION public.pull_fridge_for_menu_id(p_order_id uuid, p_menu_id text, p_qty integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rec record;
  v_amount numeric;
BEGIN
  IF p_menu_id IS NULL OR p_qty IS NULL OR p_qty = 0 THEN
    RETURN;
  END IF;

  FOR v_rec IN
    SELECT DISTINCT ii.id, r.amount_per_unit, r.menu_item_id
    FROM public.inventory_recipes r
    JOIN public.inventory_items ii ON ii.id = r.inventory_item_id
    WHERE r.menu_item_id = ANY(public.resolve_fridge_menu_ids(p_menu_id))
      AND ii.fridge_target > 0
  LOOP
    v_amount := v_rec.amount_per_unit * p_qty;
    UPDATE public.inventory_items
       SET fridge_qty = GREATEST(0, fridge_qty - v_amount::int)
     WHERE id = v_rec.id;

    INSERT INTO public.inventory_movements(inventory_item_id, delta, reason, order_id, note)
    VALUES (v_rec.id, -v_amount, 'order_fridge_pull', p_order_id, coalesce(p_menu_id, v_rec.menu_item_id));
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_order_item_to_fridge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_topping text;
  v_deal jsonb;
  v_deal_qty int;
BEGIN
  PERFORM public.pull_fridge_for_menu_id(NEW.order_id, NEW.item_id, NEW.quantity);
  PERFORM public.pull_fridge_for_menu_id(NEW.order_id, NEW.item_name, NEW.quantity);

  IF NEW.toppings IS NOT NULL THEN
    FOREACH v_topping IN ARRAY NEW.toppings LOOP
      PERFORM public.pull_fridge_for_menu_id(NEW.order_id, v_topping, NEW.quantity);
    END LOOP;
  END IF;

  IF NEW.with_meal AND NEW.meal_side IS NOT NULL THEN
    PERFORM public.pull_fridge_for_menu_id(NEW.order_id, NEW.meal_side, NEW.quantity);
  END IF;
  IF NEW.with_meal AND NEW.meal_drink IS NOT NULL THEN
    PERFORM public.pull_fridge_for_menu_id(NEW.order_id, NEW.meal_drink, NEW.quantity);
  END IF;

  IF NEW.deal_burgers IS NOT NULL THEN
    FOR v_deal IN SELECT * FROM jsonb_array_elements(NEW.deal_burgers) LOOP
      IF v_deal ? 'id' THEN
        v_deal_qty := COALESCE((v_deal->>'quantity')::int, 1) * NEW.quantity;
        PERFORM public.pull_fridge_for_menu_id(NEW.order_id, v_deal->>'id', v_deal_qty);
      END IF;
      IF v_deal ? 'name' THEN
        v_deal_qty := COALESCE((v_deal->>'quantity')::int, 1) * NEW.quantity;
        PERFORM public.pull_fridge_for_menu_id(NEW.order_id, v_deal->>'name', v_deal_qty);
      END IF;
    END LOOP;
  END IF;

  IF NEW.deal_drinks IS NOT NULL THEN
    FOR v_deal IN SELECT * FROM jsonb_array_elements(NEW.deal_drinks) LOOP
      IF v_deal ? 'id' THEN
        v_deal_qty := COALESCE((v_deal->>'quantity')::int, 1) * NEW.quantity;
        PERFORM public.pull_fridge_for_menu_id(NEW.order_id, v_deal->>'id', v_deal_qty);
      END IF;
      IF v_deal ? 'name' THEN
        v_deal_qty := COALESCE((v_deal->>'quantity')::int, 1) * NEW.quantity;
        PERFORM public.pull_fridge_for_menu_id(NEW.order_id, v_deal->>'name', v_deal_qty);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;