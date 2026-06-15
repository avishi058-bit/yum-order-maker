-- Extend deal-burger handling to also consume/restore inventory for per-burger
-- paid toppings inside friends/family deals. Toppings are stored as Hebrew
-- names inside deal_burgers[].toppings; resolve_fridge_menu_ids handles by name.

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
  v_deal_top text;
BEGIN
  PERFORM public.pull_fridge_for_menu_id(NEW.order_id, NEW.item_id, NEW.quantity);
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
      -- NEW: per-burger paid toppings inside a deal
      IF v_deal ? 'toppings' AND jsonb_typeof(v_deal->'toppings') = 'array' THEN
        FOR v_deal_top IN SELECT jsonb_array_elements_text(v_deal->'toppings') LOOP
          PERFORM public.pull_fridge_for_menu_id(NEW.order_id, v_deal_top, v_deal_qty);
        END LOOP;
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
  v_deal_top text;
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
      IF v_deal ? 'toppings' AND jsonb_typeof(v_deal->'toppings') = 'array' THEN
        FOR v_deal_top IN SELECT jsonb_array_elements_text(v_deal->'toppings') LOOP
          PERFORM public.restore_fridge_for_menu_id(p_order_id, v_deal_top, v_deal_qty);
        END LOOP;
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

CREATE OR REPLACE FUNCTION public.apply_order_to_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_oi record;
  v_recipe record;
  v_already_applied boolean;
  v_already_restored boolean;
  v_already_restored_fridge boolean;
  v_topping text;
  v_deal jsonb;
  v_consume_id text;
  v_ids text[];
  v_deal_top text;
BEGIN
  IF NEW.status = 'ready' AND (OLD.status IS DISTINCT FROM 'ready') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.inventory_movements
      WHERE order_id = NEW.id AND reason = 'order_ready'
    ) INTO v_already_applied;

    IF NOT v_already_applied THEN
      FOR v_oi IN
        SELECT item_id, quantity, toppings, with_meal, meal_side, meal_drink, deal_burgers, deal_drinks
        FROM public.order_items
        WHERE order_id = NEW.id
      LOOP
        v_ids := ARRAY[v_oi.item_id];
        IF v_oi.toppings IS NOT NULL THEN
          FOREACH v_topping IN ARRAY v_oi.toppings LOOP
            v_ids := array_append(v_ids, v_topping);
          END LOOP;
        END IF;
        IF v_oi.with_meal AND v_oi.meal_side IS NOT NULL THEN
          v_ids := array_append(v_ids, v_oi.meal_side);
        END IF;
        IF v_oi.with_meal AND v_oi.meal_drink IS NOT NULL THEN
          v_ids := array_append(v_ids, v_oi.meal_drink);
        END IF;
        IF v_oi.deal_burgers IS NOT NULL THEN
          FOR v_deal IN SELECT * FROM jsonb_array_elements(v_oi.deal_burgers) LOOP
            IF v_deal ? 'id' THEN
              v_ids := array_append(v_ids, v_deal->>'id');
            END IF;
            -- NEW: per-burger paid toppings inside a deal (stored as names)
            IF v_deal ? 'toppings' AND jsonb_typeof(v_deal->'toppings') = 'array' THEN
              FOR v_deal_top IN SELECT jsonb_array_elements_text(v_deal->'toppings') LOOP
                v_ids := array_append(v_ids, v_deal_top);
              END LOOP;
            END IF;
          END LOOP;
        END IF;
        IF v_oi.deal_drinks IS NOT NULL THEN
          FOR v_deal IN SELECT * FROM jsonb_array_elements(v_oi.deal_drinks) LOOP
            IF v_deal ? 'id' THEN
              v_ids := array_append(v_ids, v_deal->>'id');
            END IF;
          END LOOP;
        END IF;

        FOREACH v_consume_id IN ARRAY v_ids LOOP
          FOR v_recipe IN
            SELECT inventory_item_id, amount_per_unit
            FROM public.inventory_recipes
            WHERE menu_item_id = v_consume_id
          LOOP
            UPDATE public.inventory_items
              SET quantity = quantity - (v_recipe.amount_per_unit * v_oi.quantity)
              WHERE id = v_recipe.inventory_item_id;

            INSERT INTO public.inventory_movements(inventory_item_id, delta, reason, order_id, note)
            VALUES (
              v_recipe.inventory_item_id,
              -(v_recipe.amount_per_unit * v_oi.quantity),
              'order_ready',
              NEW.id,
              v_consume_id
            );
          END LOOP;
        END LOOP;
      END LOOP;
    END IF;
  END IF;

  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.inventory_movements
      WHERE order_id = NEW.id AND reason = 'order_cancelled'
    ) INTO v_already_restored;

    IF NOT v_already_restored THEN
      FOR v_recipe IN
        SELECT inventory_item_id, SUM(delta) AS total_delta
        FROM public.inventory_movements
        WHERE order_id = NEW.id AND reason = 'order_ready'
        GROUP BY inventory_item_id
      LOOP
        UPDATE public.inventory_items
          SET quantity = quantity - v_recipe.total_delta
          WHERE id = v_recipe.inventory_item_id;

        INSERT INTO public.inventory_movements(inventory_item_id, delta, reason, order_id, note)
        VALUES (
          v_recipe.inventory_item_id,
          -v_recipe.total_delta,
          'order_cancelled',
          NEW.id,
          'restore from cancellation'
        );
      END LOOP;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.inventory_movements
      WHERE order_id = NEW.id AND reason = 'order_cancelled_fridge'
    ) INTO v_already_restored_fridge;

    IF NOT v_already_restored_fridge THEN
      FOR v_recipe IN
        SELECT inventory_item_id, SUM(delta) AS total_delta
        FROM public.inventory_movements
        WHERE order_id = NEW.id AND reason = 'order_fridge_pull'
        GROUP BY inventory_item_id
      LOOP
        UPDATE public.inventory_items
          SET fridge_qty = CASE
                WHEN fridge_target > 0
                  THEN LEAST(fridge_target, GREATEST(0, fridge_qty - v_recipe.total_delta)::int)
                ELSE fridge_qty
              END
          WHERE id = v_recipe.inventory_item_id;

        INSERT INTO public.inventory_movements(inventory_item_id, delta, reason, order_id, note)
        VALUES (
          v_recipe.inventory_item_id,
          -v_recipe.total_delta,
          'order_cancelled_fridge',
          NEW.id,
          'restore fridge from cancellation'
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;