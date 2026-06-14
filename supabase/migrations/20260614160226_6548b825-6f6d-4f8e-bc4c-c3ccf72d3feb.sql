
-- 1) Helper: pull fridge_qty for one menu id (and log to inventory_movements)
CREATE OR REPLACE FUNCTION public.pull_fridge_for_menu_id(
  p_order_id uuid,
  p_menu_id  text,
  p_qty      integer
) RETURNS void
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
    SELECT ii.id, r.amount_per_unit
    FROM public.inventory_recipes r
    JOIN public.inventory_items   ii ON ii.id = r.inventory_item_id
    WHERE r.menu_item_id = p_menu_id
      AND ii.fridge_target > 0
  LOOP
    v_amount := v_rec.amount_per_unit * p_qty;
    UPDATE public.inventory_items
       SET fridge_qty = GREATEST(0, fridge_qty - v_amount::int)
     WHERE id = v_rec.id;

    INSERT INTO public.inventory_movements(inventory_item_id, delta, reason, order_id, note)
    VALUES (v_rec.id, -v_amount, 'order_fridge_pull', p_order_id, p_menu_id);
  END LOOP;
END;
$$;

-- 2) Trigger function: on new order_item, pull fridge for the item + toppings + meal_drink + deals
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
    END LOOP;
  END IF;

  IF NEW.deal_drinks IS NOT NULL THEN
    FOR v_deal IN SELECT * FROM jsonb_array_elements(NEW.deal_drinks) LOOP
      IF v_deal ? 'id' THEN
        v_deal_qty := COALESCE((v_deal->>'quantity')::int, 1) * NEW.quantity;
        PERFORM public.pull_fridge_for_menu_id(NEW.order_id, v_deal->>'id', v_deal_qty);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_order_item_to_fridge ON public.order_items;
CREATE TRIGGER trg_apply_order_item_to_fridge
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.apply_order_item_to_fridge();

-- 3) Update apply_order_to_inventory:
--    * On 'ready' → only adjust warehouse quantity (fridge already pulled on order creation).
--    * On 'cancelled' → restore warehouse quantity (if was applied) AND restore fridge_qty
--      using the 'order_fridge_pull' movements logged at order time.
CREATE OR REPLACE FUNCTION public.apply_order_to_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
            -- Warehouse only — fridge_qty is owned by the order-creation trigger.
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
    -- Restore warehouse quantity if it was already applied at 'ready'.
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

    -- Restore fridge_qty that was pulled at order creation (capped at fridge_target).
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
$$;

-- 4) Make sure the orders trigger exists (it powers status transitions).
DROP TRIGGER IF EXISTS trg_apply_order_to_inventory ON public.orders;
CREATE TRIGGER trg_apply_order_to_inventory
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.apply_order_to_inventory();
