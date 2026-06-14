
CREATE OR REPLACE FUNCTION public.apply_order_to_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oi record;
  v_recipe record;
  v_already_applied boolean;
  v_already_restored boolean;
  v_topping text;
  v_deal jsonb;
  v_consume_id text;
  v_consume_qty int;
  v_ids text[];
BEGIN
  -- ORDER READY: subtract inventory
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
        -- Build list of (consume_id, qty_per_order_unit) pairs.
        -- Main item
        v_ids := ARRAY[v_oi.item_id];
        -- Toppings
        IF v_oi.toppings IS NOT NULL THEN
          FOREACH v_topping IN ARRAY v_oi.toppings LOOP
            v_ids := array_append(v_ids, v_topping);
          END LOOP;
        END IF;
        -- Meal side & drink
        IF v_oi.with_meal AND v_oi.meal_side IS NOT NULL THEN
          v_ids := array_append(v_ids, v_oi.meal_side);
        END IF;
        IF v_oi.with_meal AND v_oi.meal_drink IS NOT NULL THEN
          v_ids := array_append(v_ids, v_oi.meal_drink);
        END IF;
        -- Deal burgers
        IF v_oi.deal_burgers IS NOT NULL THEN
          FOR v_deal IN SELECT * FROM jsonb_array_elements(v_oi.deal_burgers) LOOP
            IF v_deal ? 'id' THEN
              v_ids := array_append(v_ids, v_deal->>'id');
            END IF;
          END LOOP;
        END IF;
        -- Deal drinks
        IF v_oi.deal_drinks IS NOT NULL THEN
          FOR v_deal IN SELECT * FROM jsonb_array_elements(v_oi.deal_drinks) LOOP
            IF v_deal ? 'id' THEN
              v_ids := array_append(v_ids, v_deal->>'id');
            END IF;
          END LOOP;
        END IF;

        -- For each id, look up all recipes and apply
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

  -- ORDER CANCELLED: restore inventory
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
  END IF;

  RETURN NEW;
END;
$$;
