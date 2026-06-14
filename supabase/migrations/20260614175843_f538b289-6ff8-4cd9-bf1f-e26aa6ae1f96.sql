-- Helper to restore fridge_qty for an order item (inverse of pull_fridge_for_menu_id).
-- Caps at fridge_target so we never over-restore.
CREATE OR REPLACE FUNCTION public.restore_fridge_for_menu_id(p_order_id uuid, p_menu_id text, p_qty integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
  v_amount numeric;
BEGIN
  IF p_menu_id IS NULL OR p_qty IS NULL OR p_qty = 0 THEN
    RETURN;
  END IF;

  FOR v_rec IN
    SELECT DISTINCT ii.id, r.amount_per_unit, ii.fridge_target, r.menu_item_id
    FROM public.inventory_recipes r
    JOIN public.inventory_items ii ON ii.id = r.inventory_item_id
    WHERE r.menu_item_id = ANY(public.resolve_fridge_menu_ids(p_menu_id))
      AND ii.fridge_target > 0
  LOOP
    v_amount := v_rec.amount_per_unit * p_qty;
    UPDATE public.inventory_items
       SET fridge_qty = LEAST(fridge_target, GREATEST(0, fridge_qty + v_amount::int))
     WHERE id = v_rec.id;

    INSERT INTO public.inventory_movements(inventory_item_id, delta, reason, order_id, note)
    VALUES (v_rec.id, v_amount, 'order_edit_restore', p_order_id, coalesce(p_menu_id, v_rec.menu_item_id));
  END LOOP;
END;
$$;

-- Restore fridge for an entire order_items row (mirror of apply_order_item_to_fridge).
CREATE OR REPLACE FUNCTION public.restore_fridge_for_order_item(p_order_id uuid, p_row jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty int := COALESCE((p_row->>'quantity')::int, 1);
  v_topping text;
  v_deal jsonb;
  v_deal_qty int;
BEGIN
  PERFORM public.restore_fridge_for_menu_id(p_order_id, p_row->>'item_id', v_qty);
  PERFORM public.restore_fridge_for_menu_id(p_order_id, p_row->>'item_name', v_qty);

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
      END IF;
      IF v_deal ? 'name' THEN
        PERFORM public.restore_fridge_for_menu_id(p_order_id, v_deal->>'name', v_deal_qty);
      END IF;
    END LOOP;
  END IF;

  IF p_row ? 'deal_drinks' AND jsonb_typeof(p_row->'deal_drinks') = 'array' THEN
    FOR v_deal IN SELECT * FROM jsonb_array_elements(p_row->'deal_drinks') LOOP
      v_deal_qty := COALESCE((v_deal->>'quantity')::int, 1) * v_qty;
      IF v_deal ? 'id' THEN
        PERFORM public.restore_fridge_for_menu_id(p_order_id, v_deal->>'id', v_deal_qty);
      END IF;
      IF v_deal ? 'name' THEN
        PERFORM public.restore_fridge_for_menu_id(p_order_id, v_deal->>'name', v_deal_qty);
      END IF;
    END LOOP;
  END IF;
END;
$$;