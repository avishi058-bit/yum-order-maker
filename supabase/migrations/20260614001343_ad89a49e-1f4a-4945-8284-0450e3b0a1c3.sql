
-- ============================================
-- 1. inventory_items
-- ============================================
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  unit text NOT NULL DEFAULT 'unit', -- 'unit' | 'g' | 'ml'
  quantity numeric NOT NULL DEFAULT 0,
  low_threshold numeric NOT NULL DEFAULT 0,
  -- presets: array of {label:string, amount:number}
  presets jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- link to menu_availability item_id (optional)
  menu_item_id text,
  sort_order int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: access only via edge function (service_role).

-- ============================================
-- 2. inventory_recipes
-- ============================================
-- For each menu item_id, lists which inventory items it consumes and how much per unit ordered.
CREATE TABLE public.inventory_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id text NOT NULL,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  amount_per_unit numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, inventory_item_id)
);

GRANT ALL ON public.inventory_recipes TO service_role;
ALTER TABLE public.inventory_recipes ENABLE ROW LEVEL SECURITY;

CREATE INDEX inventory_recipes_menu_item_idx ON public.inventory_recipes(menu_item_id);

-- ============================================
-- 3. inventory_movements (log)
-- ============================================
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  delta numeric NOT NULL, -- positive = add, negative = subtract
  reason text NOT NULL, -- 'manual_add' | 'manual_remove' | 'order_ready' | 'order_cancelled' | 'init'
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE INDEX inventory_movements_item_idx ON public.inventory_movements(inventory_item_id, created_at DESC);
CREATE INDEX inventory_movements_order_idx ON public.inventory_movements(order_id);

-- ============================================
-- 4. inventory_access_tokens
-- ============================================
CREATE TABLE public.inventory_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

GRANT ALL ON public.inventory_access_tokens TO service_role;
ALTER TABLE public.inventory_access_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Updated-at triggers
-- ============================================
CREATE TRIGGER trg_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_inventory_recipes_updated_at
  BEFORE UPDATE ON public.inventory_recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Order status -> inventory trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.apply_order_to_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_recipe record;
  v_count int;
  v_already_applied boolean;
  v_already_restored boolean;
BEGIN
  -- ORDER READY: subtract inventory
  IF NEW.status = 'ready' AND (OLD.status IS DISTINCT FROM 'ready') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.inventory_movements
      WHERE order_id = NEW.id AND reason = 'order_ready'
    ) INTO v_already_applied;

    IF NOT v_already_applied THEN
      FOR v_item IN
        SELECT item_id, quantity
        FROM public.order_items
        WHERE order_id = NEW.id
      LOOP
        FOR v_recipe IN
          SELECT inventory_item_id, amount_per_unit
          FROM public.inventory_recipes
          WHERE menu_item_id = v_item.item_id
        LOOP
          UPDATE public.inventory_items
            SET quantity = quantity - (v_recipe.amount_per_unit * v_item.quantity)
            WHERE id = v_recipe.inventory_item_id;

          INSERT INTO public.inventory_movements(inventory_item_id, delta, reason, order_id, note)
          VALUES (
            v_recipe.inventory_item_id,
            -(v_recipe.amount_per_unit * v_item.quantity),
            'order_ready',
            NEW.id,
            v_item.item_id
          );
        END LOOP;
      END LOOP;
    END IF;
  END IF;

  -- ORDER CANCELLED: restore inventory that was previously subtracted
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
          SET quantity = quantity - v_recipe.total_delta -- delta is negative, so this adds back
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

CREATE TRIGGER trg_orders_inventory
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.apply_order_to_inventory();

-- ============================================
-- Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_movements;

-- ============================================
-- Seed the initial access token
-- ============================================
INSERT INTO public.inventory_access_tokens(token, label)
VALUES (encode(gen_random_bytes(24), 'hex'), 'owner');
