-- 1. Test customers (admin-only)
CREATE TABLE public.test_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('name','phone')),
  value text NOT NULL CHECK (length(btrim(value)) BETWEEN 2 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_customers TO authenticated;
GRANT ALL ON public.test_customers TO service_role;
ALTER TABLE public.test_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage test customers" ON public.test_customers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Amount actually charged, kept when a paid order is edited
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_amount numeric;

-- 3. Atomic order edit
CREATE OR REPLACE FUNCTION public.edit_order_apply(p_order_id uuid, p_items jsonb, p_total numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order record;
  v_oi record;
  v_paid numeric;
BEGIN
  SELECT id, status, total, paid_at, paid_amount INTO v_order
  FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF v_order.status NOT IN ('new','preparing') THEN RAISE EXCEPTION 'order_not_editable'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'empty_items';
  END IF;

  FOR v_oi IN SELECT * FROM public.order_items WHERE order_id = p_order_id LOOP
    PERFORM public.restore_fridge_for_order_item(p_order_id, to_jsonb(v_oi));
  END LOOP;

  DELETE FROM public.order_items WHERE order_id = p_order_id;

  INSERT INTO public.order_items(order_id, item_id, item_name, price, quantity, toppings, removals,
                                 with_meal, meal_side, meal_drink, deal_burgers, deal_drinks)
  SELECT p_order_id,
         NULLIF(r->>'item_id',''),
         r->>'item_name',
         (r->>'price')::numeric,
         (r->>'quantity')::int,
         COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(r->'toppings','[]'::jsonb))), '{}'),
         COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(r->'removals','[]'::jsonb))), '{}'),
         COALESCE((r->>'with_meal')::boolean, false),
         r->>'meal_side',
         r->>'meal_drink',
         CASE WHEN jsonb_typeof(r->'deal_burgers') = 'array' THEN r->'deal_burgers' END,
         CASE WHEN jsonb_typeof(r->'deal_drinks') = 'array' THEN r->'deal_drinks' END
  FROM jsonb_array_elements(p_items) r;

  v_paid := CASE WHEN v_order.paid_at IS NOT NULL THEN COALESCE(v_order.paid_amount, v_order.total) END;

  UPDATE public.orders
     SET total = p_total,
         paid_amount = CASE WHEN v_order.paid_at IS NOT NULL THEN v_paid ELSE paid_amount END,
         updated_at = now()
   WHERE id = p_order_id;

  RETURN jsonb_build_object('paid_amount', v_paid, 'paid', v_order.paid_at IS NOT NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.edit_order_apply(uuid, jsonb, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.edit_order_apply(uuid, jsonb, numeric) TO service_role;

-- 4. Linter hardening
DROP POLICY IF EXISTS "Admins manage blocked dates" ON public.event_blocked_dates;
CREATE POLICY "Admins manage blocked dates" ON public.event_blocked_dates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins update event settings" ON public.event_settings;
CREATE POLICY "Admins update event settings" ON public.event_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_approved_courier(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.soldier_fund_balance()
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role'
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'kitchen')
    THEN (SELECT COALESCE(SUM(delta),0) FROM public.soldier_fund_ledger)
    ELSE NULL END
$$;