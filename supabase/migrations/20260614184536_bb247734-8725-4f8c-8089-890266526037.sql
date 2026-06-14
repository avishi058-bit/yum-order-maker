CREATE OR REPLACE FUNCTION public.apply_order_item_to_fridge()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_topping text;
  v_deal jsonb;
  v_deal_qty int;
BEGIN
  PERFORM public.pull_fridge_for_menu_id(NEW.order_id, NEW.item_id, NEW.quantity);
  -- Only fall back to item_name when item_id is missing, otherwise we double-pull
  -- because resolve_fridge_menu_ids maps both the id and the Hebrew name to the
  -- same inventory item.
  IF NEW.item_id IS NULL OR btrim(NEW.item_id) = '' THEN
    PERFORM public.pull_fridge_for_menu_id(NEW.order_id, NEW.item_name, NEW.quantity);
  END IF;

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
      v_deal_qty := COALESCE((v_deal->>'quantity')::int, 1) * NEW.quantity;
      IF v_deal ? 'id' THEN
        PERFORM public.pull_fridge_for_menu_id(NEW.order_id, v_deal->>'id', v_deal_qty);
      ELSIF v_deal ? 'name' THEN
        PERFORM public.pull_fridge_for_menu_id(NEW.order_id, v_deal->>'name', v_deal_qty);
      END IF;
    END LOOP;
  END IF;

  IF NEW.deal_drinks IS NOT NULL THEN
    FOR v_deal IN SELECT * FROM jsonb_array_elements(NEW.deal_drinks) LOOP
      v_deal_qty := COALESCE((v_deal->>'quantity')::int, 1) * NEW.quantity;
      IF v_deal ? 'id' THEN
        PERFORM public.pull_fridge_for_menu_id(NEW.order_id, v_deal->>'id', v_deal_qty);
      ELSIF v_deal ? 'name' THEN
        PERFORM public.pull_fridge_for_menu_id(NEW.order_id, v_deal->>'name', v_deal_qty);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_fridge_for_order_item(p_order_id uuid, p_row jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_qty int := COALESCE((p_row->>'quantity')::int, 1);
  v_topping text;
  v_deal jsonb;
  v_deal_qty int;
  v_item_id text := p_row->>'item_id';
BEGIN
  IF v_item_id IS NOT NULL AND btrim(v_item_id) <> '' THEN
    PERFORM public.restore_fridge_for_menu_id(p_order_id, v_item_id, v_qty);
  ELSE
    PERFORM public.restore_fridge_for_menu_id(p_order_id, p_row->>'item_name', v_qty);
  END IF;

  IF p_row ? 'toppings' AND jsonb_typeof(p_row->'toppings') = 'array' THEN
    FOR v_topping IN SELECT jsonb_array_elements_text(p_row->'toppings') LOOP
      PERFORM public.restore_fridge_for_menu_id(p_order_id, v_topping, v_qty);
    END LOOP;
  END IF;

  IF COALESCE((p_row->>'with_meal')::boolean, false) AND p_row->>'meal_side' IS NOT NULL THEN
    PERFORM public.restore_fridge_for_menu_id(p_order_id, p_row->>'meal_side', v_qty);
  END IF;
  IF COALESCE((p_row->>'with_meal')::boolean, false) AND p_row->>'meal_drink' IS NOT NULL THEN
    PERFORM public.restore_fridge_for_menu_id(p_order_id, p_row->>'meal_drink', v_qty);
  END IF;

  IF p_row ? 'deal_burgers' AND jsonb_typeof(p_row->'deal_burgers') = 'array' THEN
    FOR v_deal IN SELECT * FROM jsonb_array_elements(p_row->'deal_burgers') LOOP
      v_deal_qty := COALESCE((v_deal->>'quantity')::int, 1) * v_qty;
      IF v_deal ? 'id' THEN
        PERFORM public.restore_fridge_for_menu_id(p_order_id, v_deal->>'id', v_deal_qty);
      ELSIF v_deal ? 'name' THEN
        PERFORM public.restore_fridge_for_menu_id(p_order_id, v_deal->>'name', v_deal_qty);
      END IF;
    END LOOP;
  END IF;

  IF p_row ? 'deal_drinks' AND jsonb_typeof(p_row->'deal_drinks') = 'array' THEN
    FOR v_deal IN SELECT * FROM jsonb_array_elements(p_row->'deal_drinks') LOOP
      v_deal_qty := COALESCE((v_deal->>'quantity')::int, 1) * v_qty;
      IF v_deal ? 'id' THEN
        PERFORM public.restore_fridge_for_menu_id(p_order_id, v_deal->>'id', v_deal_qty);
      ELSIF v_deal ? 'name' THEN
        PERFORM public.restore_fridge_for_menu_id(p_order_id, v_deal->>'name', v_deal_qty);
      END IF;
    END LOOP;
  END IF;
END;
$function$;