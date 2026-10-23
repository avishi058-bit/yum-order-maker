-- Schema-only snapshot of the live database (no row data, no secrets).
-- Generated 2026-10-23T10:56:26Z from pg_catalog. Project host replaced with __NEW_PROJECT_REF__.
-- internal_config is created empty; insert a new webhook_secret on the new project.

Output format is unaligned.
-- 1) Extensions
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2) Enum types
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'kitchen', 'courier'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Tables (column defaults are added after functions, section 4b)
CREATE TABLE IF NOT EXISTS public.blocked_ips (
  id uuid NOT NULL,
  ip_address text NOT NULL,
  reason text NOT NULL,
  blocked_at timestamp with time zone NOT NULL,
  blocked_by uuid,
  is_pattern boolean NOT NULL,
  expires_at timestamp with time zone
);
CREATE TABLE IF NOT EXISTS public.blocked_phones (
  id uuid NOT NULL,
  phone text NOT NULL,
  reason text NOT NULL,
  blocked_at timestamp with time zone NOT NULL,
  blocked_by uuid
);
CREATE TABLE IF NOT EXISTS public.business_private_settings (
  id integer NOT NULL,
  business_signature text,
  updated_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.consent_events (
  id uuid NOT NULL,
  customer_id uuid,
  phone text,
  consent_type text NOT NULL,
  action text NOT NULL,
  consent_text_version text,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL,
  method text,
  order_id uuid,
  consent_text text,
  item_ref text,
  customer_name text,
  source text
);
CREATE TABLE IF NOT EXISTS public.courier_locations (
  courier_id uuid NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  updated_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.courier_push_subscriptions (
  id uuid NOT NULL,
  courier_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.couriers (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  status text NOT NULL,
  approved_at timestamp with time zone,
  approved_by uuid,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.custom_toppings (
  id uuid NOT NULL,
  item_id text NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL,
  created_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid NOT NULL,
  phone text NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  terms_accepted_at timestamp with time zone,
  marketing_consent boolean NOT NULL,
  marketing_consent_at timestamp with time zone,
  last_login_at timestamp with time zone,
  login_count integer NOT NULL,
  device_token text,
  favorite_items jsonb
);
CREATE TABLE IF NOT EXISTS public.delivery_requests (
  id uuid NOT NULL,
  customer_name text,
  customer_phone text,
  address text NOT NULL,
  zone_id uuid,
  zone_name text,
  price numeric NOT NULL,
  status text NOT NULL,
  order_id uuid,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  lat numeric,
  lng numeric,
  courier_id uuid,
  claimed_at timestamp with time zone,
  payout numeric,
  client_token uuid NOT NULL
);
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL,
  keywords text[] NOT NULL,
  active boolean NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.event_blocked_dates (
  id uuid NOT NULL,
  blocked_date date NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.event_bookings (
  id uuid NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text NOT NULL,
  event_date date NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  event_type text NOT NULL,
  event_address text NOT NULL,
  guests_count integer NOT NULL,
  package_id text NOT NULL,
  package_name text NOT NULL,
  package_price_per_person numeric NOT NULL,
  addons jsonb NOT NULL,
  subtotal numeric NOT NULL,
  total_price numeric NOT NULL,
  min_applied boolean NOT NULL,
  contract_text text,
  customer_signature text,
  business_signature text,
  signed_at timestamp with time zone,
  client_ip text,
  pdf_url text,
  status text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  invoice_name text,
  business_id text,
  at_venue boolean NOT NULL,
  veg_count integer NOT NULL,
  vegan_count integer NOT NULL,
  gf_count integer NOT NULL,
  no_bun_count integer NOT NULL,
  kids_count integer NOT NULL,
  eggs_count integer,
  onion_jam_count integer,
  fried_onion_count integer,
  chili_count integer,
  dessert_count integer,
  kitchen_notes text,
  drink_selections jsonb NOT NULL,
  seating_preference text
);
CREATE TABLE IF NOT EXISTS public.event_leads (
  id uuid NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  group_type text,
  guests_count integer,
  preferred_date date,
  notes text,
  status text NOT NULL,
  created_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.event_settings (
  id integer NOT NULL,
  contract_template text NOT NULL,
  minimum_amount numeric NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  kitchen_prep jsonb NOT NULL,
  business_signature text
);
CREATE TABLE IF NOT EXISTS public.internal_config (
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.inventory_access_tokens (
  id uuid NOT NULL,
  token text NOT NULL,
  label text,
  created_at timestamp with time zone NOT NULL,
  last_used_at timestamp with time zone,
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  scope text NOT NULL
);
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  unit text NOT NULL,
  quantity numeric NOT NULL,
  low_threshold numeric NOT NULL,
  presets jsonb NOT NULL,
  menu_item_id text,
  sort_order integer NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  unit_cost numeric NOT NULL,
  fridge_target integer NOT NULL,
  fridge_qty integer NOT NULL
);
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid NOT NULL,
  inventory_item_id uuid NOT NULL,
  delta numeric NOT NULL,
  reason text NOT NULL,
  order_id uuid,
  note text,
  created_at timestamp with time zone NOT NULL,
  unit_cost numeric
);
CREATE TABLE IF NOT EXISTS public.inventory_recipes (
  id uuid NOT NULL,
  menu_item_id text NOT NULL,
  inventory_item_id uuid NOT NULL,
  amount_per_unit numeric NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.menu_availability (
  id uuid NOT NULL,
  item_id text NOT NULL,
  item_name text NOT NULL,
  category text NOT NULL,
  available boolean NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  manually_disabled boolean NOT NULL,
  archived boolean NOT NULL
);
CREATE TABLE IF NOT EXISTS public.notification_prompts (
  id uuid NOT NULL,
  phone text,
  device_fingerprint text,
  order_id uuid,
  action text NOT NULL,
  created_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid NOT NULL,
  order_id uuid NOT NULL,
  item_name text NOT NULL,
  price numeric NOT NULL,
  quantity integer NOT NULL,
  toppings text[],
  removals text[],
  with_meal boolean,
  meal_side text,
  meal_drink text,
  deal_burgers jsonb,
  deal_drinks jsonb,
  created_at timestamp with time zone NOT NULL,
  item_id text
);
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid NOT NULL,
  order_number integer NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text,
  notes text,
  status text NOT NULL,
  total numeric NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  estimated_ready_at timestamp with time zone,
  payment_method text,
  order_source text NOT NULL,
  terms_accepted_at timestamp with time zone,
  almost_ready_notified_at timestamp with time zone,
  ten_min_notified_at timestamp with time zone,
  scheduled_for timestamp with time zone,
  delivery_request_id uuid,
  delivery_address text,
  delivery_fee numeric,
  dine_in boolean,
  paid_at timestamp with time zone,
  queue_number integer,
  customer_on_way_at timestamp with time zone,
  bon_queue_number integer,
  payment_session_id text,
  payment_reference text,
  payment_transaction_id text,
  invoice_number text,
  invoice_issued_at timestamp with time zone,
  soldier_donation numeric NOT NULL,
  donation_only boolean NOT NULL,
  paid_amount numeric
);
CREATE TABLE IF NOT EXISTS public.produce_purchases (
  id uuid NOT NULL,
  purchased_at date NOT NULL,
  supplier text,
  item_key text NOT NULL,
  raw_name text,
  quantity numeric,
  unit text,
  unit_price numeric,
  total numeric NOT NULL,
  prev_finished boolean NOT NULL,
  created_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.product_aliases (
  id uuid NOT NULL,
  raw_name text NOT NULL,
  item_key text NOT NULL,
  label text,
  created_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  display_name text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid NOT NULL,
  order_id uuid,
  customer_phone text,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  is_kitchen boolean NOT NULL,
  for_reopen boolean NOT NULL,
  receives_daily_summary boolean NOT NULL
);
CREATE TABLE IF NOT EXISTS public.rate_limit_attempts (
  id uuid NOT NULL,
  action text NOT NULL,
  key text NOT NULL,
  ip_address text,
  created_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.reopen_notifications (
  id uuid NOT NULL,
  phone text NOT NULL,
  name text,
  notified boolean NOT NULL,
  created_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.restaurant_status (
  id uuid NOT NULL,
  website_open boolean NOT NULL,
  station_open boolean NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  cash_enabled boolean NOT NULL,
  credit_enabled boolean NOT NULL,
  high_load boolean NOT NULL,
  preorder_enabled boolean NOT NULL,
  preorder_start_time time without time zone NOT NULL,
  preorder_end_time time without time zone NOT NULL,
  delivery_enabled boolean NOT NULL,
  last_opened_at timestamp with time zone,
  kiosk_cash_enabled boolean NOT NULL,
  kiosk_credit_enabled boolean NOT NULL,
  kiosk_paybox_enabled boolean NOT NULL,
  soldier_fund_enabled boolean NOT NULL
);
CREATE TABLE IF NOT EXISTS public.sauce_stock_events (
  id uuid NOT NULL,
  sauce text NOT NULL,
  kind text NOT NULL,
  quantity numeric NOT NULL,
  event_date date NOT NULL,
  created_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.saved_carts (
  id uuid NOT NULL,
  phone text,
  guest_id text,
  customer_name text,
  items jsonb NOT NULL,
  dine_in boolean,
  total numeric NOT NULL,
  resumed_count integer NOT NULL,
  last_action text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.site_settings (
  id uuid NOT NULL,
  kiosk_font_scale numeric NOT NULL,
  website_font_scale numeric NOT NULL,
  primary_color text NOT NULL,
  background_color text NOT NULL,
  menu_item_overrides jsonb NOT NULL,
  menu_order jsonb NOT NULL,
  banner_text text,
  banner_enabled boolean NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  business_hours jsonb NOT NULL,
  kiosk_modal_height_vh numeric NOT NULL,
  website_modal_height_vh numeric NOT NULL,
  kiosk_image_height_px integer NOT NULL,
  kiosk_image_scale numeric NOT NULL,
  kiosk_card_image_size_px integer NOT NULL,
  kiosk_spacing_scale numeric NOT NULL,
  kiosk_ui_scale numeric NOT NULL,
  kiosk_lock_layout boolean NOT NULL,
  kiosk_disable_zoom boolean NOT NULL,
  google_review_url text,
  monthly_fixed_costs numeric NOT NULL,
  monthly_wages jsonb NOT NULL,
  fixed_expenses jsonb NOT NULL,
  veg_cost_approved numeric
);
CREATE TABLE IF NOT EXISTS public.soldier_fund_ledger (
  id uuid NOT NULL,
  delta numeric NOT NULL,
  reason text NOT NULL,
  order_id uuid,
  note text,
  created_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.stock_counts (
  id uuid NOT NULL,
  item_key text NOT NULL,
  kind text NOT NULL,
  quantity numeric NOT NULL,
  unit text,
  counted_at timestamp with time zone NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.supply_purchases (
  id uuid NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL,
  includes_vat boolean NOT NULL,
  purchased_at date NOT NULL,
  finished_at date,
  notes text,
  created_at timestamp with time zone NOT NULL,
  kind text NOT NULL,
  supplier text
);
CREATE TABLE IF NOT EXISTS public.test_customers (
  id uuid NOT NULL,
  kind text NOT NULL,
  value text NOT NULL,
  created_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.verification_codes (
  id uuid NOT NULL,
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  verified boolean NOT NULL,
  created_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.work_shifts (
  id uuid NOT NULL,
  employee_name text NOT NULL,
  clock_in timestamp with time zone NOT NULL,
  clock_out timestamp with time zone,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

-- 4) Functions
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
$function$
;
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
$function$
;
CREATE OR REPLACE FUNCTION public.assign_bon_queue_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_day date := ((now() - interval '6 hours') AT TIME ZONE 'Asia/Jerusalem')::date;
  v_next integer;
BEGIN
  IF NEW.status = 'pending_payment' OR COALESCE(NEW.donation_only, false) THEN
    NEW.bon_queue_number := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.bon_queue_number IS NOT NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('orders_bon_queue', 7));
  SELECT COALESCE(MAX(bon_queue_number), 0) + 1 INTO v_next
  FROM public.orders
  WHERE ((created_at - interval '6 hours') AT TIME ZONE 'Asia/Jerusalem')::date = v_day;
  NEW.bon_queue_number := GREATEST(COALESCE(v_next, 1), 1);
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.auto_block_event_date()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'signed' AND NEW.event_date IS NOT NULL THEN
    INSERT INTO public.event_blocked_dates (blocked_date, reason)
    VALUES (NEW.event_date, 'אירוע: ' || COALESCE(NEW.customer_name, ''))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.check_and_activate_attack_mode()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_recent_count int;
BEGIN
  SELECT count(*) INTO v_recent_count FROM public.blocked_ips
  WHERE is_pattern = false AND blocked_at > now() - interval '1 hour';
  IF v_recent_count < 3 THEN RETURN false; END IF;
  -- No subnet blocking: only tighten checks (CAPTCHA) for 24h.
  INSERT INTO public.internal_config (key, value)
  VALUES ('attack_mode_until', (now() + interval '24 hours')::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  RETURN true;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.check_otp_rate_limit(p_phone text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.check_rate_limit('otp_send', p_phone, 3, interval '5 minutes');
END;
$function$
;
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_action text, p_key text, p_max_attempts integer, p_window interval)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.rate_limit_attempts
  WHERE action = p_action
    AND key = p_key
    AND created_at > now() - p_window;

  RETURN v_count < p_max_attempts;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.cleanup_expired_saved_carts()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.saved_carts
  WHERE updated_at < now() - interval '48 hours';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limit_attempts()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.rate_limit_attempts WHERE created_at < now() - interval '24 hours';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.cleanup_old_verification_codes()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.verification_codes WHERE created_at < now() - interval '1 hour';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.close_paid_donation_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.donation_only AND NEW.status = 'new' THEN
    NEW.status := 'completed';
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.current_courier_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM public.couriers WHERE user_id = auth.uid() AND status = 'approved' LIMIT 1
$function$
;
CREATE OR REPLACE FUNCTION public.edit_order_apply(p_order_id uuid, p_items jsonb, p_total numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_courier_delivery_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only enforce column-lock for courier callers; staff (kitchen/admin) can
  -- edit any field. Anyone bypassing RLS (service_role/edge functions) also
  -- passes through unrestricted.
  IF public.is_approved_courier(auth.uid())
     AND NOT (public.has_role(auth.uid(), 'admin')
              OR public.has_role(auth.uid(), 'kitchen'))
  THEN
    IF NEW.customer_name  IS DISTINCT FROM OLD.customer_name
       OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone
       OR NEW.address        IS DISTINCT FROM OLD.address
       OR NEW.zone_id        IS DISTINCT FROM OLD.zone_id
       OR NEW.zone_name      IS DISTINCT FROM OLD.zone_name
       OR NEW.price          IS DISTINCT FROM OLD.price
       OR NEW.payout         IS DISTINCT FROM OLD.payout
       OR NEW.lat            IS DISTINCT FROM OLD.lat
       OR NEW.lng            IS DISTINCT FROM OLD.lng
       OR NEW.order_id       IS DISTINCT FROM OLD.order_id
       OR NEW.client_token   IS DISTINCT FROM OLD.client_token
       OR NEW.created_at     IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'courier updates are limited to status and courier_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.generate_daily_order_number()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_candidate integer;
  v_today date := (now() AT TIME ZONE 'Asia/Jerusalem')::date;
  v_attempts integer := 0;
BEGIN
  LOOP
    v_candidate := floor(random() * 9000 + 1000)::int;
    IF NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE order_number = v_candidate
        AND (created_at AT TIME ZONE 'Asia/Jerusalem')::date = v_today
    ) THEN
      RETURN v_candidate;
    END IF;
    v_attempts := v_attempts + 1;
    IF v_attempts > 500 THEN
      RETURN 1000 + (extract(epoch from clock_timestamp())::bigint % 9000)::int;
    END IF;
  END LOOP;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_public_event_settings()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT json_build_object('contract_template', contract_template, 'minimum_amount', minimum_amount) FROM public.event_settings WHERE id = 1 $function$
;
CREATE OR REPLACE FUNCTION public.get_webhook_secret()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT value FROM public.internal_config WHERE key = 'webhook_secret'
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$
;
CREATE OR REPLACE FUNCTION public.has_role_admin(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role='admin')
$function$
;
CREATE OR REPLACE FUNCTION public.inventory_adjust(p_item uuid, p_delta numeric)
 RETURNS numeric
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.inventory_items SET quantity = quantity + p_delta WHERE id = p_item RETURNING quantity
$function$
;
CREATE OR REPLACE FUNCTION public.inventory_set_quantity(p_item uuid, p_qty numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_old numeric;
BEGIN
  SELECT quantity INTO v_old FROM public.inventory_items WHERE id = p_item FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.inventory_items SET quantity = p_qty WHERE id = p_item;
  RETURN p_qty - v_old;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.is_approved_courier(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.couriers WHERE user_id = _uid AND status = 'approved')
$function$
;
CREATE OR REPLACE FUNCTION public.is_attack_mode_active()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT value::timestamptz > now()
     FROM public.internal_config
     WHERE key = 'attack_mode_until'),
    false
  )
$function$
;
CREATE OR REPLACE FUNCTION public.is_ip_blocked(p_ip text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_ips
    WHERE is_pattern = false
      AND ip_address = p_ip
      AND (expires_at > now() OR (expires_at IS NULL AND blocked_by IS NOT NULL))
  )
$function$
;
CREATE OR REPLACE FUNCTION public.mark_order_paid(p_order_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing integer;
  v_bon integer;
  v_created timestamptz;
  v_next integer;
  v_day_start timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kitchen')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT queue_number, bon_queue_number, created_at INTO v_existing, v_bon, v_created
  FROM public.orders WHERE id = p_order_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  IF v_bon IS NOT NULL THEN
    v_next := v_bon;
  ELSE
    v_day_start := date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem';
    SELECT COUNT(*) INTO v_next
    FROM public.orders
    WHERE created_at >= v_day_start
      AND created_at <= v_created;
    v_next := GREATEST(COALESCE(v_next, 1), 1);
  END IF;

  UPDATE public.orders
  SET queue_number = v_next, paid_at = now()
  WHERE id = p_order_id;

  RETURN v_next;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.next_daily_queue_number()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_day date := ((now() - interval '6 hours') AT TIME ZONE 'Asia/Jerusalem')::date;
  v_next integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('orders_daily_queue', 42));
  SELECT COALESCE(MAX(queue_number), 0) + 1 INTO v_next
  FROM public.orders
  WHERE ((created_at - interval '6 hours') AT TIME ZONE 'Asia/Jerusalem')::date = v_day;
  RETURN v_next;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_couriers_new_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM net.http_post(
      url := 'https://__NEW_PROJECT_REF__.supabase.co/functions/v1/notify-couriers-new-delivery',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-internal-secret', public.get_webhook_secret()
      ),
      body := jsonb_build_object('request_id', NEW.id::text)
    );
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_daily_sales_summary()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_business_day date := CASE WHEN EXTRACT(HOUR FROM (now() AT TIME ZONE 'Asia/Jerusalem')) < 6
                              THEN ((now() AT TIME ZONE 'Asia/Jerusalem') - interval '1 day')::date
                              ELSE (now() AT TIME ZONE 'Asia/Jerusalem')::date END;
  v_start timestamp with time zone;
  v_default_start timestamp with time zone;
BEGIN
  -- Fire when ordering (the website) transitions open -> closed.
  IF NEW.website_open THEN
    RETURN NEW;
  END IF;
  IF NOT OLD.website_open THEN
    RETURN NEW;
  END IF;

  -- Send on EVERY close (not just once a day) with the up-to-date totals.

  -- Business day starts at 06:00 Jerusalem time, so a 02:00 closing still
  -- summarizes the shift that began the previous evening.
  v_default_start := (v_business_day + time '06:00') AT TIME ZONE 'Asia/Jerusalem';

  v_start := COALESCE(NEW.last_opened_at, v_default_start);
  IF v_start < v_default_start - interval '24 hours' OR v_start > now() THEN
    v_start := v_default_start;
  END IF;

  PERFORM net.http_post(
    url := 'https://__NEW_PROJECT_REF__.supabase.co/functions/v1/daily-sales-summary',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-internal-secret', public.get_webhook_secret()
    ),
    body := jsonb_build_object('businessDayStart', v_start)
  );
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_kitchen_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  -- Skip if not (yet) in 'new' status
  IF NEW.status IS DISTINCT FROM 'new' THEN
    RETURN NEW;
  END IF;

  -- On UPDATE: only fire on the transition INTO 'new' (avoid double-notify
  -- on later edits of a 'new' order).
  IF TG_OP = 'UPDATE' AND OLD.status = 'new' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://__NEW_PROJECT_REF__.supabase.co/functions/v1/notify-kitchen-new-order',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-internal-secret', public.get_webhook_secret()
    ),
    body := jsonb_build_object('order_id', NEW.id::text)
  );
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_order_ready()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_type text := NULL;
BEGIN
  IF NEW.status = 'ready' AND (OLD.status IS DISTINCT FROM 'ready') THEN
    v_type := 'ready';
  ELSIF NEW.status = 'preparing' AND (OLD.status IS DISTINCT FROM 'preparing') THEN
    v_type := 'preparing';
  END IF;

  IF v_type IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://__NEW_PROJECT_REF__.supabase.co/functions/v1/send-order-ready-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', public.get_webhook_secret()
      ),
      body := jsonb_build_object('order_id', NEW.id::text, 'type', v_type)
    );
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_orders_almost_ready()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  rec RECORD;
  v_secret text := public.get_webhook_secret();
BEGIN
  -- 10-minute window
  FOR rec IN
    SELECT id
    FROM public.orders
    WHERE status = 'preparing'
      AND ten_min_notified_at IS NULL
      AND estimated_ready_at IS NOT NULL
      AND estimated_ready_at > now() + interval '5 minutes'
      AND estimated_ready_at <= now() + interval '10 minutes'
  LOOP
    PERFORM net.http_post(
      url := 'https://__NEW_PROJECT_REF__.supabase.co/functions/v1/send-order-ready-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret),
      body := jsonb_build_object('order_id', rec.id::text, 'type', 'ten_minutes')
    );
    UPDATE public.orders SET ten_min_notified_at = now() WHERE id = rec.id;
  END LOOP;

  FOR rec IN
    SELECT id
    FROM public.orders
    WHERE status = 'preparing'
      AND almost_ready_notified_at IS NULL
      AND estimated_ready_at IS NOT NULL
      AND estimated_ready_at > now()
      AND estimated_ready_at <= now() + interval '5 minutes'
  LOOP
    PERFORM net.http_post(
      url := 'https://__NEW_PROJECT_REF__.supabase.co/functions/v1/send-order-ready-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret),
      body := jsonb_build_object('order_id', rec.id::text, 'type', 'almost_ready')
    );
    UPDATE public.orders SET almost_ready_notified_at = now() WHERE id = rec.id;
  END LOOP;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.pay_order_from_soldier_fund(p_order_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_total numeric; v_paid timestamptz; v_num int; v_bal numeric; v_q int;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'kitchen')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('soldier_fund', 3));
  SELECT total - COALESCE(soldier_donation,0), paid_at, order_number INTO v_total, v_paid, v_num
    FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_total IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF v_paid IS NOT NULL THEN RAISE EXCEPTION 'already paid'; END IF;
  v_bal := public.soldier_fund_balance();
  IF v_bal < v_total THEN RAISE EXCEPTION 'insufficient fund'; END IF;
  INSERT INTO public.soldier_fund_ledger(delta, reason, order_id, note)
  VALUES (-v_total, 'spend', p_order_id, 'הזמנה #' || v_num);
  UPDATE public.orders SET payment_method = 'soldier_fund', soldier_donation = 0 WHERE id = p_order_id;
  v_q := public.mark_order_paid(p_order_id);
  RETURN v_q;
END $function$
;
CREATE OR REPLACE FUNCTION public.pull_fridge_for_menu_id(p_order_id uuid, p_menu_id text, p_qty integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.record_rate_limit_attempt(p_action text, p_key text, p_ip_address text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.rate_limit_attempts (action, key, ip_address)
  VALUES (p_action, p_key, p_ip_address);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.reping_kitchen_for_pending_orders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  rec RECORD;
  v_secret text := public.get_webhook_secret();
BEGIN
  FOR rec IN
    SELECT id FROM public.orders
    WHERE status = 'new' AND created_at > now() - interval '30 minutes'
  LOOP
    PERFORM net.http_post(
      url := 'https://__NEW_PROJECT_REF__.supabase.co/functions/v1/notify-kitchen-new-order',
      headers := jsonb_build_object('Content-Type','application/json','x-internal-secret', v_secret),
      body := jsonb_build_object('order_id', rec.id::text, 'repeat', true)
    );
  END LOOP;
END;
$function$
;
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
$function$
;
CREATE OR REPLACE FUNCTION public.restore_fridge_for_menu_id(p_order_id uuid, p_menu_id text, p_qty integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
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
$function$
;
CREATE OR REPLACE FUNCTION public.soldier_fund_balance()
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.role() = 'service_role'
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'kitchen')
    THEN (SELECT COALESCE(SUM(delta),0) FROM public.soldier_fund_ledger)
    ELSE NULL END
$function$
;
CREATE OR REPLACE FUNCTION public.soldier_fund_on_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_net numeric;
BEGIN
  IF COALESCE(NEW.soldier_donation,0) <= 0 THEN RETURN NEW; END IF;
  SELECT COALESCE(SUM(delta),0) INTO v_net FROM public.soldier_fund_ledger
   WHERE order_id = NEW.id AND reason IN ('donation','donation_reversal');
  IF NEW.paid_at IS NOT NULL AND OLD.paid_at IS NULL AND v_net = 0 THEN
    INSERT INTO public.soldier_fund_ledger(delta, reason, order_id, note)
    VALUES (NEW.soldier_donation, 'donation', NEW.id, 'הזמנה #' || NEW.order_number);
  ELSIF NEW.paid_at IS NULL AND OLD.paid_at IS NOT NULL AND v_net > 0 THEN
    INSERT INTO public.soldier_fund_ledger(delta, reason, order_id, note)
    VALUES (-v_net, 'donation_reversal', NEW.id, 'ביטול סימון תשלום');
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.soldier_fund_public_stats()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'collected', COALESCE((SELECT SUM(delta) FROM public.soldier_fund_ledger WHERE reason IN ('donation','donation_reversal')),0),
    'meals', (SELECT COUNT(*) FROM public.soldier_fund_ledger WHERE reason = 'spend')
  )
$function$
;
CREATE OR REPLACE FUNCTION public.unmark_order_paid(p_order_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_paid_at timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kitchen')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT paid_at INTO v_paid_at
  FROM public.orders
  WHERE id = p_order_id;

  IF v_paid_at IS NULL THEN
    RETURN false;
  END IF;

  -- Allow undo only within 30 seconds of marking paid.
  IF now() - v_paid_at > interval '30 seconds' THEN
    RAISE EXCEPTION 'undo window expired';
  END IF;

  UPDATE public.orders
  SET queue_number = NULL, paid_at = NULL
  WHERE id = p_order_id;

  RETURN true;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_restaurant_status_last_opened()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (OLD.website_open OR OLD.station_open)
     AND (NEW.website_open OR NEW.station_open) THEN
    NEW.last_opened_at := now();
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

-- 4b) Column defaults
ALTER TABLE public.blocked_ips ALTER COLUMN blocked_at SET DEFAULT now();
ALTER TABLE public.blocked_ips ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.blocked_ips ALTER COLUMN is_pattern SET DEFAULT false;
ALTER TABLE public.blocked_phones ALTER COLUMN blocked_at SET DEFAULT now();
ALTER TABLE public.blocked_phones ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.business_private_settings ALTER COLUMN id SET DEFAULT 1;
ALTER TABLE public.business_private_settings ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.consent_events ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.consent_events ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.courier_locations ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.courier_push_subscriptions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.courier_push_subscriptions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.couriers ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.couriers ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.couriers ALTER COLUMN status SET DEFAULT 'pending'::text;
ALTER TABLE public.couriers ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.custom_toppings ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.custom_toppings ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.custom_toppings ALTER COLUMN price SET DEFAULT 0;
ALTER TABLE public.customers ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.customers ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.customers ALTER COLUMN login_count SET DEFAULT 0;
ALTER TABLE public.customers ALTER COLUMN marketing_consent SET DEFAULT false;
ALTER TABLE public.customers ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.delivery_requests ALTER COLUMN client_token SET DEFAULT gen_random_uuid();
ALTER TABLE public.delivery_requests ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.delivery_requests ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.delivery_requests ALTER COLUMN price SET DEFAULT 0;
ALTER TABLE public.delivery_requests ALTER COLUMN status SET DEFAULT 'pending'::text;
ALTER TABLE public.delivery_requests ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.delivery_zones ALTER COLUMN active SET DEFAULT true;
ALTER TABLE public.delivery_zones ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.delivery_zones ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.delivery_zones ALTER COLUMN keywords SET DEFAULT ARRAY[]::text[];
ALTER TABLE public.delivery_zones ALTER COLUMN price SET DEFAULT 0;
ALTER TABLE public.delivery_zones ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.event_blocked_dates ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.event_blocked_dates ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.event_bookings ALTER COLUMN addons SET DEFAULT '[]'::jsonb;
ALTER TABLE public.event_bookings ALTER COLUMN at_venue SET DEFAULT false;
ALTER TABLE public.event_bookings ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.event_bookings ALTER COLUMN drink_selections SET DEFAULT '{}'::jsonb;
ALTER TABLE public.event_bookings ALTER COLUMN gf_count SET DEFAULT 0;
ALTER TABLE public.event_bookings ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.event_bookings ALTER COLUMN kids_count SET DEFAULT 0;
ALTER TABLE public.event_bookings ALTER COLUMN min_applied SET DEFAULT false;
ALTER TABLE public.event_bookings ALTER COLUMN no_bun_count SET DEFAULT 0;
ALTER TABLE public.event_bookings ALTER COLUMN status SET DEFAULT 'pending'::text;
ALTER TABLE public.event_bookings ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.event_bookings ALTER COLUMN veg_count SET DEFAULT 0;
ALTER TABLE public.event_bookings ALTER COLUMN vegan_count SET DEFAULT 0;
ALTER TABLE public.event_leads ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.event_leads ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.event_leads ALTER COLUMN status SET DEFAULT 'new'::text;
ALTER TABLE public.event_settings ALTER COLUMN contract_template SET DEFAULT ''::text;
ALTER TABLE public.event_settings ALTER COLUMN id SET DEFAULT 1;
ALTER TABLE public.event_settings ALTER COLUMN kitchen_prep SET DEFAULT '{"chips_g": 250, "onion_g": 13, "tomato_g": 43, "waffle_g": 185, "lettuce_g": 20, "pickles_g": 20, "potatoes_g": 250, "onion_rings_g": 185, "default_eggs_per_guest": 1, "default_dessert_per_guest": 1}'::jsonb;
ALTER TABLE public.event_settings ALTER COLUMN minimum_amount SET DEFAULT 2000;
ALTER TABLE public.event_settings ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.internal_config ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.inventory_access_tokens ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.inventory_access_tokens ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.inventory_access_tokens ALTER COLUMN scope SET DEFAULT 'admin'::text;
ALTER TABLE public.inventory_items ALTER COLUMN category SET DEFAULT 'other'::text;
ALTER TABLE public.inventory_items ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.inventory_items ALTER COLUMN fridge_qty SET DEFAULT 0;
ALTER TABLE public.inventory_items ALTER COLUMN fridge_target SET DEFAULT 0;
ALTER TABLE public.inventory_items ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.inventory_items ALTER COLUMN low_threshold SET DEFAULT 0;
ALTER TABLE public.inventory_items ALTER COLUMN presets SET DEFAULT '[]'::jsonb;
ALTER TABLE public.inventory_items ALTER COLUMN quantity SET DEFAULT 0;
ALTER TABLE public.inventory_items ALTER COLUMN sort_order SET DEFAULT 0;
ALTER TABLE public.inventory_items ALTER COLUMN unit SET DEFAULT 'unit'::text;
ALTER TABLE public.inventory_items ALTER COLUMN unit_cost SET DEFAULT 0;
ALTER TABLE public.inventory_items ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.inventory_movements ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.inventory_movements ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.inventory_recipes ALTER COLUMN amount_per_unit SET DEFAULT 1;
ALTER TABLE public.inventory_recipes ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.inventory_recipes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.inventory_recipes ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.menu_availability ALTER COLUMN archived SET DEFAULT false;
ALTER TABLE public.menu_availability ALTER COLUMN available SET DEFAULT true;
ALTER TABLE public.menu_availability ALTER COLUMN category SET DEFAULT 'menu'::text;
ALTER TABLE public.menu_availability ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.menu_availability ALTER COLUMN manually_disabled SET DEFAULT false;
ALTER TABLE public.menu_availability ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.notification_prompts ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.notification_prompts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.order_items ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.order_items ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.order_items ALTER COLUMN quantity SET DEFAULT 1;
ALTER TABLE public.order_items ALTER COLUMN removals SET DEFAULT '{}'::text[];
ALTER TABLE public.order_items ALTER COLUMN toppings SET DEFAULT '{}'::text[];
ALTER TABLE public.order_items ALTER COLUMN with_meal SET DEFAULT false;
ALTER TABLE public.orders ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.orders ALTER COLUMN donation_only SET DEFAULT false;
ALTER TABLE public.orders ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.orders ALTER COLUMN order_number SET DEFAULT generate_daily_order_number();
ALTER TABLE public.orders ALTER COLUMN order_source SET DEFAULT 'website'::text;
ALTER TABLE public.orders ALTER COLUMN payment_method SET DEFAULT 'cash'::text;
ALTER TABLE public.orders ALTER COLUMN soldier_donation SET DEFAULT 0;
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'new'::text;
ALTER TABLE public.orders ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.produce_purchases ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.produce_purchases ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.produce_purchases ALTER COLUMN prev_finished SET DEFAULT true;
ALTER TABLE public.produce_purchases ALTER COLUMN purchased_at SET DEFAULT CURRENT_DATE;
ALTER TABLE public.product_aliases ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.product_aliases ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.profiles ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.profiles ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.push_subscriptions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.push_subscriptions ALTER COLUMN for_reopen SET DEFAULT false;
ALTER TABLE public.push_subscriptions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.push_subscriptions ALTER COLUMN is_kitchen SET DEFAULT false;
ALTER TABLE public.push_subscriptions ALTER COLUMN receives_daily_summary SET DEFAULT false;
ALTER TABLE public.rate_limit_attempts ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.rate_limit_attempts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.reopen_notifications ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.reopen_notifications ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.reopen_notifications ALTER COLUMN notified SET DEFAULT false;
ALTER TABLE public.restaurant_status ALTER COLUMN cash_enabled SET DEFAULT true;
ALTER TABLE public.restaurant_status ALTER COLUMN credit_enabled SET DEFAULT true;
ALTER TABLE public.restaurant_status ALTER COLUMN delivery_enabled SET DEFAULT false;
ALTER TABLE public.restaurant_status ALTER COLUMN high_load SET DEFAULT false;
ALTER TABLE public.restaurant_status ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.restaurant_status ALTER COLUMN kiosk_cash_enabled SET DEFAULT true;
ALTER TABLE public.restaurant_status ALTER COLUMN kiosk_credit_enabled SET DEFAULT true;
ALTER TABLE public.restaurant_status ALTER COLUMN kiosk_paybox_enabled SET DEFAULT false;
ALTER TABLE public.restaurant_status ALTER COLUMN preorder_enabled SET DEFAULT false;
ALTER TABLE public.restaurant_status ALTER COLUMN preorder_end_time SET DEFAULT '22:00:00'::time without time zone;
ALTER TABLE public.restaurant_status ALTER COLUMN preorder_start_time SET DEFAULT '10:00:00'::time without time zone;
ALTER TABLE public.restaurant_status ALTER COLUMN soldier_fund_enabled SET DEFAULT true;
ALTER TABLE public.restaurant_status ALTER COLUMN station_open SET DEFAULT true;
ALTER TABLE public.restaurant_status ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.restaurant_status ALTER COLUMN website_open SET DEFAULT true;
ALTER TABLE public.sauce_stock_events ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.sauce_stock_events ALTER COLUMN event_date SET DEFAULT CURRENT_DATE;
ALTER TABLE public.sauce_stock_events ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.saved_carts ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.saved_carts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.saved_carts ALTER COLUMN items SET DEFAULT '[]'::jsonb;
ALTER TABLE public.saved_carts ALTER COLUMN last_action SET DEFAULT 'updated'::text;
ALTER TABLE public.saved_carts ALTER COLUMN resumed_count SET DEFAULT 0;
ALTER TABLE public.saved_carts ALTER COLUMN total SET DEFAULT 0;
ALTER TABLE public.saved_carts ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.site_settings ALTER COLUMN background_color SET DEFAULT '0 0% 100%'::text;
ALTER TABLE public.site_settings ALTER COLUMN banner_enabled SET DEFAULT false;
ALTER TABLE public.site_settings ALTER COLUMN banner_text SET DEFAULT ''::text;
ALTER TABLE public.site_settings ALTER COLUMN business_hours SET DEFAULT '{"0": {"to": "23:00", "from": "11:00", "open": true}, "1": {"to": "23:00", "from": "11:00", "open": true}, "2": {"to": "23:00", "from": "11:00", "open": true}, "3": {"to": "23:00", "from": "11:00", "open": true}, "4": {"to": "23:00", "from": "11:00", "open": true}, "5": {"to": "15:00", "from": "11:00", "open": false}, "6": {"to": "23:59", "from": "20:00", "open": true}}'::jsonb;
ALTER TABLE public.site_settings ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.site_settings ALTER COLUMN fixed_expenses SET DEFAULT '[]'::jsonb;
ALTER TABLE public.site_settings ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.site_settings ALTER COLUMN kiosk_card_image_size_px SET DEFAULT 240;
ALTER TABLE public.site_settings ALTER COLUMN kiosk_disable_zoom SET DEFAULT true;
ALTER TABLE public.site_settings ALTER COLUMN kiosk_font_scale SET DEFAULT 1.4;
ALTER TABLE public.site_settings ALTER COLUMN kiosk_image_height_px SET DEFAULT 460;
ALTER TABLE public.site_settings ALTER COLUMN kiosk_image_scale SET DEFAULT 1.1;
ALTER TABLE public.site_settings ALTER COLUMN kiosk_lock_layout SET DEFAULT true;
ALTER TABLE public.site_settings ALTER COLUMN kiosk_modal_height_vh SET DEFAULT 78;
ALTER TABLE public.site_settings ALTER COLUMN kiosk_spacing_scale SET DEFAULT 1.15;
ALTER TABLE public.site_settings ALTER COLUMN kiosk_ui_scale SET DEFAULT 1.0;
ALTER TABLE public.site_settings ALTER COLUMN menu_item_overrides SET DEFAULT '{}'::jsonb;
ALTER TABLE public.site_settings ALTER COLUMN menu_order SET DEFAULT '[]'::jsonb;
ALTER TABLE public.site_settings ALTER COLUMN monthly_fixed_costs SET DEFAULT 0;
ALTER TABLE public.site_settings ALTER COLUMN monthly_wages SET DEFAULT '{}'::jsonb;
ALTER TABLE public.site_settings ALTER COLUMN primary_color SET DEFAULT '25 95% 53%'::text;
ALTER TABLE public.site_settings ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.site_settings ALTER COLUMN website_font_scale SET DEFAULT 1.0;
ALTER TABLE public.site_settings ALTER COLUMN website_modal_height_vh SET DEFAULT 95;
ALTER TABLE public.soldier_fund_ledger ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.soldier_fund_ledger ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.stock_counts ALTER COLUMN counted_at SET DEFAULT now();
ALTER TABLE public.stock_counts ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.stock_counts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.stock_counts ALTER COLUMN kind SET DEFAULT 'count'::text;
ALTER TABLE public.stock_counts ALTER COLUMN quantity SET DEFAULT 0;
ALTER TABLE public.supply_purchases ALTER COLUMN amount SET DEFAULT 0;
ALTER TABLE public.supply_purchases ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.supply_purchases ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.supply_purchases ALTER COLUMN includes_vat SET DEFAULT true;
ALTER TABLE public.supply_purchases ALTER COLUMN kind SET DEFAULT 'supply'::text;
ALTER TABLE public.supply_purchases ALTER COLUMN purchased_at SET DEFAULT CURRENT_DATE;
ALTER TABLE public.test_customers ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.test_customers ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.user_roles ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.user_roles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.verification_codes ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.verification_codes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.verification_codes ALTER COLUMN verified SET DEFAULT false;
ALTER TABLE public.work_shifts ALTER COLUMN clock_in SET DEFAULT now();
ALTER TABLE public.work_shifts ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.work_shifts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.work_shifts ALTER COLUMN updated_at SET DEFAULT now();

-- 5) Constraints: primary keys, unique, check
DO $$ BEGIN ALTER TABLE public.blocked_ips ADD CONSTRAINT blocked_ips_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.blocked_phones ADD CONSTRAINT blocked_phones_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.business_private_settings ADD CONSTRAINT business_private_settings_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.consent_events ADD CONSTRAINT consent_events_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.courier_locations ADD CONSTRAINT courier_locations_pkey PRIMARY KEY (courier_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.courier_push_subscriptions ADD CONSTRAINT courier_push_subscriptions_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.couriers ADD CONSTRAINT couriers_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.custom_toppings ADD CONSTRAINT custom_toppings_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.customers ADD CONSTRAINT customers_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.delivery_requests ADD CONSTRAINT delivery_requests_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.delivery_zones ADD CONSTRAINT delivery_zones_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.event_blocked_dates ADD CONSTRAINT event_blocked_dates_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.event_bookings ADD CONSTRAINT event_bookings_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.event_leads ADD CONSTRAINT event_leads_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.event_settings ADD CONSTRAINT event_settings_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.internal_config ADD CONSTRAINT internal_config_pkey PRIMARY KEY (key); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_access_tokens ADD CONSTRAINT inventory_access_tokens_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_recipes ADD CONSTRAINT inventory_recipes_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.menu_availability ADD CONSTRAINT menu_availability_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.notification_prompts ADD CONSTRAINT notification_prompts_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.order_items ADD CONSTRAINT order_items_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.produce_purchases ADD CONSTRAINT produce_purchases_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.product_aliases ADD CONSTRAINT product_aliases_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.rate_limit_attempts ADD CONSTRAINT rate_limit_attempts_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reopen_notifications ADD CONSTRAINT reopen_notifications_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.restaurant_status ADD CONSTRAINT restaurant_status_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.sauce_stock_events ADD CONSTRAINT sauce_stock_events_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.saved_carts ADD CONSTRAINT saved_carts_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.site_settings ADD CONSTRAINT site_settings_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.soldier_fund_ledger ADD CONSTRAINT soldier_fund_ledger_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.stock_counts ADD CONSTRAINT stock_counts_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.supply_purchases ADD CONSTRAINT supply_purchases_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.test_customers ADD CONSTRAINT test_customers_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.verification_codes ADD CONSTRAINT verification_codes_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.work_shifts ADD CONSTRAINT work_shifts_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.blocked_ips ADD CONSTRAINT blocked_ips_ip_address_key UNIQUE (ip_address); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.blocked_phones ADD CONSTRAINT blocked_phones_phone_key UNIQUE (phone); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.courier_push_subscriptions ADD CONSTRAINT courier_push_subscriptions_endpoint_key UNIQUE (endpoint); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.couriers ADD CONSTRAINT couriers_user_id_key UNIQUE (user_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.custom_toppings ADD CONSTRAINT custom_toppings_item_id_key UNIQUE (item_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.customers ADD CONSTRAINT customers_device_token_unique UNIQUE (device_token); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.customers ADD CONSTRAINT customers_phone_key UNIQUE (phone); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.customers ADD CONSTRAINT customers_phone_unique UNIQUE (phone); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.event_blocked_dates ADD CONSTRAINT event_blocked_dates_blocked_date_key UNIQUE (blocked_date); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_access_tokens ADD CONSTRAINT inventory_access_tokens_token_key UNIQUE (token); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_recipes ADD CONSTRAINT inventory_recipes_menu_item_id_inventory_item_id_key UNIQUE (menu_item_id, inventory_item_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.menu_availability ADD CONSTRAINT menu_availability_item_id_key UNIQUE (item_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.product_aliases ADD CONSTRAINT product_aliases_raw_name_key UNIQUE (raw_name); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_order_id_endpoint_key UNIQUE (order_id, endpoint); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.test_customers ADD CONSTRAINT test_customers_kind_value_key UNIQUE (kind, value); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.business_private_settings ADD CONSTRAINT business_private_settings_id_check CHECK ((id = 1)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.consent_events ADD CONSTRAINT consent_events_action_check CHECK ((action = ANY (ARRAY['granted'::text, 'revoked'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.event_settings ADD CONSTRAINT single_row CHECK ((id = 1)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_access_tokens ADD CONSTRAINT inventory_access_tokens_scope_check CHECK ((scope = ANY (ARRAY['admin'::text, 'inventory'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_access_tokens ADD CONSTRAINT inventory_access_tokens_token_min_length CHECK ((char_length(token) >= 32)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.notification_prompts ADD CONSTRAINT notification_prompts_action_check CHECK ((action = ANY (ARRAY['shown'::text, 'accepted'::text, 'dismissed'::text, 'denied'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['new'::text, 'preparing'::text, 'ready'::text, 'completed'::text, 'cancelled'::text, 'pending_payment'::text, 'payment_failed'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.sauce_stock_events ADD CONSTRAINT sauce_stock_events_kind_check CHECK ((kind = ANY (ARRAY['purchase'::text, 'count'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.saved_carts ADD CONSTRAINT saved_carts_owner_chk CHECK (((phone IS NOT NULL) OR (guest_id IS NOT NULL))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.soldier_fund_ledger ADD CONSTRAINT soldier_fund_ledger_reason_check CHECK ((reason = ANY (ARRAY['donation'::text, 'donation_reversal'::text, 'spend'::text, 'adjust'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.test_customers ADD CONSTRAINT test_customers_kind_check CHECK ((kind = ANY (ARRAY['name'::text, 'phone'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.test_customers ADD CONSTRAINT test_customers_value_check CHECK (((length(btrim(value)) >= 2) AND (length(btrim(value)) <= 80))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
-- 5b) Foreign keys
DO $$ BEGIN ALTER TABLE public.blocked_ips ADD CONSTRAINT blocked_ips_blocked_by_fkey FOREIGN KEY (blocked_by) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.blocked_phones ADD CONSTRAINT blocked_phones_blocked_by_fkey FOREIGN KEY (blocked_by) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.consent_events ADD CONSTRAINT consent_events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.consent_events ADD CONSTRAINT consent_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.courier_locations ADD CONSTRAINT courier_locations_courier_id_fkey FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.courier_push_subscriptions ADD CONSTRAINT courier_push_subscriptions_courier_id_fkey FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.couriers ADD CONSTRAINT couriers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.delivery_requests ADD CONSTRAINT delivery_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.delivery_requests ADD CONSTRAINT delivery_requests_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES delivery_zones(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_recipes ADD CONSTRAINT inventory_recipes_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.notification_prompts ADD CONSTRAINT notification_prompts_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.orders ADD CONSTRAINT orders_delivery_request_id_fkey FOREIGN KEY (delivery_request_id) REFERENCES delivery_requests(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.soldier_fund_ledger ADD CONSTRAINT soldier_fund_ledger_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- 5c) Indexes
CREATE INDEX IF NOT EXISTS consent_events_created_at_idx ON public.consent_events USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS consent_events_order_idx ON public.consent_events USING btree (order_id);
CREATE INDEX IF NOT EXISTS consent_events_phone_idx ON public.consent_events USING btree (phone);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON public.blocked_ips USING btree (ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_phones_phone ON public.blocked_phones USING btree (phone);
CREATE INDEX IF NOT EXISTS idx_consent_events_customer ON public.consent_events USING btree (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_events_phone ON public.consent_events USING btree (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_device_token ON public.customers USING btree (device_token) WHERE (device_token IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers USING btree (phone);
CREATE INDEX IF NOT EXISTS idx_notification_prompts_action ON public.notification_prompts USING btree (action);
CREATE INDEX IF NOT EXISTS idx_notification_prompts_created_at ON public.notification_prompts USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_item_id ON public.order_items USING btree (item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone_created_at ON public.orders USING btree (customer_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders USING btree (status);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_for_reopen ON public.push_subscriptions USING btree (for_reopen) WHERE (for_reopen = true);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_order ON public.push_subscriptions USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_phone ON public.push_subscriptions USING btree (customer_phone);
CREATE INDEX IF NOT EXISTS idx_rate_limit_attempts_action_key_created ON public.rate_limit_attempts USING btree (action, key, created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_attempts_created_at ON public.rate_limit_attempts USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_reopen_notifications_pending ON public.reopen_notifications USING btree (notified, created_at) WHERE (notified = false);
CREATE INDEX IF NOT EXISTS inventory_movements_item_idx ON public.inventory_movements USING btree (inventory_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_movements_order_idx ON public.inventory_movements USING btree (order_id);
CREATE INDEX IF NOT EXISTS inventory_recipes_menu_item_idx ON public.inventory_recipes USING btree (menu_item_id);
CREATE INDEX IF NOT EXISTS orders_queue_number_idx ON public.orders USING btree (created_at, queue_number);
CREATE INDEX IF NOT EXISTS saved_carts_updated_at_idx ON public.saved_carts USING btree (updated_at DESC);
CREATE INDEX IF NOT EXISTS stock_counts_key_idx ON public.stock_counts USING btree (item_key, counted_at);
CREATE UNIQUE INDEX orders_order_number_per_day_uniq ON public.orders USING btree (order_number, (((created_at AT TIME ZONE 'Asia/Jerusalem'::text))::date));
CREATE UNIQUE INDEX push_subscriptions_kitchen_endpoint_key ON public.push_subscriptions USING btree (endpoint) WHERE (is_kitchen = true);
CREATE UNIQUE INDEX push_subscriptions_phone_endpoint_key ON public.push_subscriptions USING btree (customer_phone, endpoint) WHERE (customer_phone IS NOT NULL);
CREATE UNIQUE INDEX saved_carts_guest_uniq ON public.saved_carts USING btree (guest_id) WHERE (guest_id IS NOT NULL);
CREATE UNIQUE INDEX saved_carts_phone_uniq ON public.saved_carts USING btree (phone) WHERE (phone IS NOT NULL);

-- 6) Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
DROP TRIGGER IF EXISTS couriers_updated ON public.couriers;
CREATE TRIGGER couriers_updated BEFORE UPDATE ON public.couriers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS notify_couriers_new_delivery ON public.delivery_requests;
CREATE TRIGGER notify_couriers_new_delivery AFTER INSERT ON public.delivery_requests FOR EACH ROW EXECUTE FUNCTION notify_couriers_new_delivery();
DROP TRIGGER IF EXISTS trg_delivery_requests_updated ON public.delivery_requests;
CREATE TRIGGER trg_delivery_requests_updated BEFORE UPDATE ON public.delivery_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_enforce_courier_delivery_update ON public.delivery_requests;
CREATE TRIGGER trg_enforce_courier_delivery_update BEFORE UPDATE ON public.delivery_requests FOR EACH ROW EXECUTE FUNCTION enforce_courier_delivery_update();
DROP TRIGGER IF EXISTS trg_delivery_zones_updated ON public.delivery_zones;
CREATE TRIGGER trg_delivery_zones_updated BEFORE UPDATE ON public.delivery_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_auto_block_event_date ON public.event_bookings;
CREATE TRIGGER trg_auto_block_event_date AFTER INSERT ON public.event_bookings FOR EACH ROW EXECUTE FUNCTION auto_block_event_date();
DROP TRIGGER IF EXISTS update_event_bookings_updated_at ON public.event_bookings;
CREATE TRIGGER update_event_bookings_updated_at BEFORE UPDATE ON public.event_bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_inventory_items_updated_at ON public.inventory_items;
CREATE TRIGGER trg_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_inventory_recipes_updated_at ON public.inventory_recipes;
CREATE TRIGGER trg_inventory_recipes_updated_at BEFORE UPDATE ON public.inventory_recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_apply_order_item_to_fridge ON public.order_items;
CREATE TRIGGER trg_apply_order_item_to_fridge AFTER INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION apply_order_item_to_fridge();
DROP TRIGGER IF EXISTS trg_apply_order_to_inventory ON public.orders;
CREATE TRIGGER trg_apply_order_to_inventory AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION apply_order_to_inventory();
DROP TRIGGER IF EXISTS trg_assign_bon_queue_number ON public.orders;
CREATE TRIGGER trg_assign_bon_queue_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION assign_bon_queue_number();
DROP TRIGGER IF EXISTS trg_assign_bon_queue_number_update ON public.orders;
CREATE TRIGGER trg_assign_bon_queue_number_update BEFORE UPDATE OF status ON public.orders FOR EACH ROW WHEN (((old.status = 'pending_payment'::text) AND (new.status <> 'pending_payment'::text))) EXECUTE FUNCTION assign_bon_queue_number();
DROP TRIGGER IF EXISTS trg_close_paid_donation_only ON public.orders;
CREATE TRIGGER trg_close_paid_donation_only BEFORE INSERT OR UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION close_paid_donation_only();
DROP TRIGGER IF EXISTS trg_notify_kitchen_new_order ON public.orders;
CREATE TRIGGER trg_notify_kitchen_new_order AFTER INSERT OR UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION notify_kitchen_new_order();
DROP TRIGGER IF EXISTS trg_notify_order_ready ON public.orders;
CREATE TRIGGER trg_notify_order_ready AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION notify_order_ready();
DROP TRIGGER IF EXISTS trg_soldier_fund_on_paid ON public.orders;
CREATE TRIGGER trg_soldier_fund_on_paid AFTER UPDATE OF paid_at ON public.orders FOR EACH ROW EXECUTE FUNCTION soldier_fund_on_paid();
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_notify_daily_sales_summary ON public.restaurant_status;
CREATE TRIGGER trg_notify_daily_sales_summary AFTER UPDATE ON public.restaurant_status FOR EACH ROW EXECUTE FUNCTION notify_daily_sales_summary();
DROP TRIGGER IF EXISTS trg_update_restaurant_status_last_opened ON public.restaurant_status;
CREATE TRIGGER trg_update_restaurant_status_last_opened BEFORE UPDATE ON public.restaurant_status FOR EACH ROW EXECUTE FUNCTION update_restaurant_status_last_opened();
DROP TRIGGER IF EXISTS saved_carts_set_updated_at ON public.saved_carts;
CREATE TRIGGER saved_carts_set_updated_at BEFORE UPDATE ON public.saved_carts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_work_shifts_updated_at ON public.work_shifts;
CREATE TRIGGER update_work_shifts_updated_at BEFORE UPDATE ON public.work_shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7) Row level security and policies
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_private_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_toppings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produce_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reopen_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sauce_stock_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soldier_fund_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can delete blocked ips" ON public.blocked_ips;
CREATE POLICY "Admins can delete blocked ips" ON public.blocked_ips AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can view blocked ips" ON public.blocked_ips;
CREATE POLICY "Admins can view blocked ips" ON public.blocked_ips AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can delete blocked phones" ON public.blocked_phones;
CREATE POLICY "Admins can delete blocked phones" ON public.blocked_phones AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can view blocked phones" ON public.blocked_phones;
CREATE POLICY "Admins can view blocked phones" ON public.blocked_phones AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins manage private settings" ON public.business_private_settings;
CREATE POLICY "Admins manage private settings" ON public.business_private_settings AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "admins read consent events" ON public.consent_events;
CREATE POLICY "admins read consent events" ON public.consent_events AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "courier loc self write" ON public.courier_locations;
CREATE POLICY "courier loc self write" ON public.courier_locations AS PERMISSIVE FOR ALL TO authenticated USING (((courier_id IN ( SELECT couriers.id
   FROM couriers
  WHERE (couriers.user_id = auth.uid()))) OR has_role_admin(auth.uid()))) WITH CHECK ((courier_id IN ( SELECT couriers.id
   FROM couriers
  WHERE (couriers.user_id = auth.uid()))));
DROP POLICY IF EXISTS "courier push self" ON public.courier_push_subscriptions;
CREATE POLICY "courier push self" ON public.courier_push_subscriptions AS PERMISSIVE FOR ALL TO authenticated USING (((courier_id IN ( SELECT couriers.id
   FROM couriers
  WHERE (couriers.user_id = auth.uid()))) OR has_role_admin(auth.uid()))) WITH CHECK ((courier_id IN ( SELECT couriers.id
   FROM couriers
  WHERE (couriers.user_id = auth.uid()))));
DROP POLICY IF EXISTS "couriers admin delete" ON public.couriers;
CREATE POLICY "couriers admin delete" ON public.couriers AS PERMISSIVE FOR DELETE TO authenticated USING (has_role_admin(auth.uid()));
DROP POLICY IF EXISTS "couriers admin update" ON public.couriers;
CREATE POLICY "couriers admin update" ON public.couriers AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role_admin(auth.uid())) WITH CHECK (has_role_admin(auth.uid()));
DROP POLICY IF EXISTS "couriers self insert" ON public.couriers;
CREATE POLICY "couriers self insert" ON public.couriers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (status = 'pending'::text)));
DROP POLICY IF EXISTS "couriers self read" ON public.couriers;
CREATE POLICY "couriers self read" ON public.couriers AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR has_role_admin(auth.uid())));
DROP POLICY IF EXISTS "Admins can delete custom toppings" ON public.custom_toppings;
CREATE POLICY "Admins can delete custom toppings" ON public.custom_toppings AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can insert custom toppings" ON public.custom_toppings;
CREATE POLICY "Admins can insert custom toppings" ON public.custom_toppings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update custom toppings" ON public.custom_toppings;
CREATE POLICY "Admins can update custom toppings" ON public.custom_toppings AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can read custom toppings" ON public.custom_toppings;
CREATE POLICY "Anyone can read custom toppings" ON public.custom_toppings AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
CREATE POLICY "Admins can update customers" ON public.customers AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Staff can read customers" ON public.customers;
CREATE POLICY "Staff can read customers" ON public.customers AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Staff can read delivery requests" ON public.delivery_requests;
CREATE POLICY "Staff can read delivery requests" ON public.delivery_requests AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Staff can update delivery requests" ON public.delivery_requests;
CREATE POLICY "Staff can update delivery requests" ON public.delivery_requests AS PERMISSIVE FOR UPDATE TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role))) WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "courier claim own" ON public.delivery_requests;
CREATE POLICY "courier claim own" ON public.delivery_requests AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_approved_courier(auth.uid()) AND ((status = 'pending'::text) OR (courier_id = current_courier_id())))) WITH CHECK (is_approved_courier(auth.uid()));
DROP POLICY IF EXISTS "couriers see open and own" ON public.delivery_requests;
CREATE POLICY "couriers see open and own" ON public.delivery_requests AS PERMISSIVE FOR SELECT TO authenticated USING ((is_approved_courier(auth.uid()) AND ((status = 'pending'::text) OR (courier_id = current_courier_id()))));
DROP POLICY IF EXISTS "Admins/kitchen can manage delivery zones" ON public.delivery_zones;
CREATE POLICY "Admins/kitchen can manage delivery zones" ON public.delivery_zones AS PERMISSIVE FOR ALL TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role))) WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Anyone can read active delivery zones" ON public.delivery_zones;
CREATE POLICY "Anyone can read active delivery zones" ON public.delivery_zones AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Admins manage blocked dates" ON public.event_blocked_dates;
CREATE POLICY "Admins manage blocked dates" ON public.event_blocked_dates AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can view blocked dates" ON public.event_blocked_dates;
CREATE POLICY "Anyone can view blocked dates" ON public.event_blocked_dates AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Anyone can create pending booking" ON public.event_bookings;
CREATE POLICY "Anyone can create pending booking" ON public.event_bookings AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (((status = ANY (ARRAY['pending'::text, 'new'::text])) AND (business_signature IS NULL) AND (customer_name IS NOT NULL) AND ((length(customer_name) >= 1) AND (length(customer_name) <= 120)) AND ((customer_phone IS NULL) OR ((length(customer_phone) >= 6) AND (length(customer_phone) <= 20))) AND ((customer_email IS NULL) OR ((length(customer_email) >= 3) AND (length(customer_email) <= 254))) AND ((event_address IS NULL) OR (length(event_address) <= 300)) AND ((invoice_name IS NULL) OR (length(invoice_name) <= 200)) AND ((business_id IS NULL) OR (length(business_id) <= 30)) AND ((event_type IS NULL) OR (length(event_type) <= 100)) AND ((package_name IS NULL) OR (length(package_name) <= 200)) AND ((contract_text IS NULL) OR (length(contract_text) <= 20000)) AND ((customer_signature IS NULL) OR (length(customer_signature) <= 200000))));
DROP POLICY IF EXISTS "Staff can update bookings" ON public.event_bookings;
CREATE POLICY "Staff can update bookings" ON public.event_bookings AS PERMISSIVE FOR UPDATE TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role))) WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Staff can view bookings" ON public.event_bookings;
CREATE POLICY "Staff can view bookings" ON public.event_bookings AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Admins can delete leads" ON public.event_leads;
CREATE POLICY "Admins can delete leads" ON public.event_leads AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update leads" ON public.event_leads;
CREATE POLICY "Admins can update leads" ON public.event_leads AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can view leads" ON public.event_leads;
CREATE POLICY "Admins can view leads" ON public.event_leads AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.event_leads;
CREATE POLICY "Anyone can submit a lead" ON public.event_leads AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK ((((length(full_name) >= 1) AND (length(full_name) <= 100)) AND ((length(phone) >= 6) AND (length(phone) <= 25)) AND ((notes IS NULL) OR (length(notes) <= 1000)) AND ((guests_count IS NULL) OR ((guests_count > 0) AND (guests_count <= 2000)))));
DROP POLICY IF EXISTS "Admins update event settings" ON public.event_settings;
CREATE POLICY "Admins update event settings" ON public.event_settings AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Staff can view event settings" ON public.event_settings;
CREATE POLICY "Staff can view event settings" ON public.event_settings AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Kitchen and admin can read inventory items" ON public.inventory_items;
CREATE POLICY "Kitchen and admin can read inventory items" ON public.inventory_items AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Admins can delete availability" ON public.menu_availability;
CREATE POLICY "Admins can delete availability" ON public.menu_availability AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can insert availability" ON public.menu_availability;
CREATE POLICY "Admins can insert availability" ON public.menu_availability AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update availability" ON public.menu_availability;
CREATE POLICY "Admins can update availability" ON public.menu_availability AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can read availability" ON public.menu_availability;
CREATE POLICY "Anyone can read availability" ON public.menu_availability AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Admins can view all prompts" ON public.notification_prompts;
CREATE POLICY "Admins can view all prompts" ON public.notification_prompts AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can log a prompt event" ON public.notification_prompts;
CREATE POLICY "Anyone can log a prompt event" ON public.notification_prompts AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (((action IS NOT NULL) AND (length(action) <= 64) AND ((phone IS NULL) OR (length(phone) <= 20)) AND ((device_fingerprint IS NULL) OR (length(device_fingerprint) <= 256))));
DROP POLICY IF EXISTS "Staff can read order items" ON public.order_items;
CREATE POLICY "Staff can read order items" ON public.order_items AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Staff can read orders" ON public.orders;
CREATE POLICY "Staff can read orders" ON public.orders AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
CREATE POLICY "Staff can update orders" ON public.orders AS PERMISSIVE FOR UPDATE TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "admins manage produce" ON public.produce_purchases;
CREATE POLICY "admins manage produce" ON public.produce_purchases AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "admins manage aliases" ON public.product_aliases;
CREATE POLICY "admins manage aliases" ON public.product_aliases AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Auto-create profile on signup" ON public.profiles;
CREATE POLICY "Auto-create profile on signup" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Anyone can insert reopen push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Anyone can insert reopen push subscriptions" ON public.push_subscriptions AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (((for_reopen = true) AND (endpoint IS NOT NULL) AND ((length(endpoint) >= 20) AND (length(endpoint) <= 2000)) AND ((p256dh IS NULL) OR (length(p256dh) <= 300)) AND ((auth IS NULL) OR (length(auth) <= 300)) AND ((customer_phone IS NULL) OR (length(customer_phone) <= 20)) AND (order_id IS NULL)));
DROP POLICY IF EXISTS "Anyone can subscribe to push" ON public.push_subscriptions;
CREATE POLICY "Anyone can subscribe to push" ON public.push_subscriptions AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (((endpoint IS NOT NULL) AND (length(endpoint) < 2000) AND (for_reopen IS NOT TRUE) AND (((order_id IS NULL) AND (customer_phone IS NULL)) OR ((order_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = push_subscriptions.order_id) AND (o.created_at > (now() - '48:00:00'::interval)) AND ((push_subscriptions.customer_phone IS NULL) OR (o.customer_phone = push_subscriptions.customer_phone)))))))));
DROP POLICY IF EXISTS "Staff can delete push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Staff can delete push subscriptions" ON public.push_subscriptions AS PERMISSIVE FOR DELETE TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Staff can read push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Staff can read push subscriptions" ON public.push_subscriptions AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Staff can update push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Staff can update push subscriptions" ON public.push_subscriptions AS PERMISSIVE FOR UPDATE TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role))) WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Authenticated users can record their own attempts" ON public.rate_limit_attempts;
CREATE POLICY "Authenticated users can record their own attempts" ON public.rate_limit_attempts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((auth.uid())::text = key));
DROP POLICY IF EXISTS "Service role manages rate limits" ON public.rate_limit_attempts;
CREATE POLICY "Service role manages rate limits" ON public.rate_limit_attempts AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can update reopen notifications" ON public.reopen_notifications;
CREATE POLICY "Admins can update reopen notifications" ON public.reopen_notifications AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can subscribe for reopen notification" ON public.reopen_notifications;
CREATE POLICY "Anyone can subscribe for reopen notification" ON public.reopen_notifications AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (((phone IS NOT NULL) AND ((length(phone) >= 6) AND (length(phone) <= 20))));
DROP POLICY IF EXISTS "Staff can read reopen notifications" ON public.reopen_notifications;
CREATE POLICY "Staff can read reopen notifications" ON public.reopen_notifications AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Admins can update restaurant status" ON public.restaurant_status;
CREATE POLICY "Admins can update restaurant status" ON public.restaurant_status AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can read restaurant status" ON public.restaurant_status;
CREATE POLICY "Anyone can read restaurant status" ON public.restaurant_status AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "admins manage sauce stock" ON public.sauce_stock_events;
CREATE POLICY "admins manage sauce stock" ON public.sauce_stock_events AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Staff can read saved carts" ON public.saved_carts;
CREATE POLICY "Staff can read saved carts" ON public.saved_carts AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Admins can insert site settings" ON public.site_settings;
CREATE POLICY "Admins can insert site settings" ON public.site_settings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update site settings" ON public.site_settings;
CREATE POLICY "Admins can update site settings" ON public.site_settings AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
CREATE POLICY "Anyone can read site settings" ON public.site_settings AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "admin adjust soldier fund" ON public.soldier_fund_ledger;
CREATE POLICY "admin adjust soldier fund" ON public.soldier_fund_ledger AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) AND (reason = 'adjust'::text)));
DROP POLICY IF EXISTS "staff read soldier fund" ON public.soldier_fund_ledger;
CREATE POLICY "staff read soldier fund" ON public.soldier_fund_ledger AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Admins read stock counts" ON public.stock_counts;
CREATE POLICY "Admins read stock counts" ON public.stock_counts AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins manage supplies" ON public.supply_purchases;
CREATE POLICY "Admins manage supplies" ON public.supply_purchases AS PERMISSIVE FOR ALL TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role))) WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Admins manage test customers" ON public.test_customers;
CREATE POLICY "Admins manage test customers" ON public.test_customers AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Kitchen reads test customers" ON public.test_customers;
CREATE POLICY "Kitchen reads test customers" ON public.test_customers AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'kitchen'::app_role));
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Service role manages verification codes" ON public.verification_codes;
CREATE POLICY "Service role manages verification codes" ON public.verification_codes AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Staff insert shifts" ON public.work_shifts;
CREATE POLICY "Staff insert shifts" ON public.work_shifts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Staff read shifts" ON public.work_shifts;
CREATE POLICY "Staff read shifts" ON public.work_shifts AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));
DROP POLICY IF EXISTS "Staff update shifts" ON public.work_shifts;
CREATE POLICY "Staff update shifts" ON public.work_shifts AS PERMISSIVE FOR UPDATE TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role))) WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)));

-- 8) Grants to anon / authenticated / service_role
REVOKE ALL ON public.blocked_ips FROM anon, authenticated;
REVOKE ALL ON public.blocked_phones FROM anon, authenticated;
REVOKE ALL ON public.business_private_settings FROM anon, authenticated;
REVOKE ALL ON public.consent_events FROM anon, authenticated;
REVOKE ALL ON public.courier_locations FROM anon, authenticated;
REVOKE ALL ON public.courier_push_subscriptions FROM anon, authenticated;
REVOKE ALL ON public.couriers FROM anon, authenticated;
REVOKE ALL ON public.custom_toppings FROM anon, authenticated;
REVOKE ALL ON public.customers FROM anon, authenticated;
REVOKE ALL ON public.delivery_requests FROM anon, authenticated;
REVOKE ALL ON public.delivery_zones FROM anon, authenticated;
REVOKE ALL ON public.event_blocked_dates FROM anon, authenticated;
REVOKE ALL ON public.event_bookings FROM anon, authenticated;
REVOKE ALL ON public.event_leads FROM anon, authenticated;
REVOKE ALL ON public.event_settings FROM anon, authenticated;
REVOKE ALL ON public.internal_config FROM anon, authenticated;
REVOKE ALL ON public.inventory_access_tokens FROM anon, authenticated;
REVOKE ALL ON public.inventory_items FROM anon, authenticated;
REVOKE ALL ON public.inventory_movements FROM anon, authenticated;
REVOKE ALL ON public.inventory_recipes FROM anon, authenticated;
REVOKE ALL ON public.menu_availability FROM anon, authenticated;
REVOKE ALL ON public.notification_prompts FROM anon, authenticated;
REVOKE ALL ON public.order_items FROM anon, authenticated;
REVOKE ALL ON public.orders FROM anon, authenticated;
REVOKE ALL ON public.produce_purchases FROM anon, authenticated;
REVOKE ALL ON public.product_aliases FROM anon, authenticated;
REVOKE ALL ON public.profiles FROM anon, authenticated;
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
REVOKE ALL ON public.rate_limit_attempts FROM anon, authenticated;
REVOKE ALL ON public.reopen_notifications FROM anon, authenticated;
REVOKE ALL ON public.restaurant_status FROM anon, authenticated;
REVOKE ALL ON public.sauce_stock_events FROM anon, authenticated;
REVOKE ALL ON public.saved_carts FROM anon, authenticated;
REVOKE ALL ON public.site_settings FROM anon, authenticated;
REVOKE ALL ON public.soldier_fund_ledger FROM anon, authenticated;
REVOKE ALL ON public.stock_counts FROM anon, authenticated;
REVOKE ALL ON public.supply_purchases FROM anon, authenticated;
REVOKE ALL ON public.test_customers FROM anon, authenticated;
REVOKE ALL ON public.user_roles FROM anon, authenticated;
REVOKE ALL ON public.verification_codes FROM anon, authenticated;
REVOKE ALL ON public.work_shifts FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_order_item_to_fridge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_order_item_to_fridge() TO service_role;
REVOKE EXECUTE ON FUNCTION public.apply_order_to_inventory() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_order_to_inventory() TO service_role;
REVOKE EXECUTE ON FUNCTION public.assign_bon_queue_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_bon_queue_number() TO service_role;
REVOKE EXECUTE ON FUNCTION public.auto_block_event_date() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_block_event_date() TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_and_activate_attack_mode() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_activate_attack_mode() TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_otp_rate_limit(p_phone text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_otp_rate_limit(p_phone text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(p_action text, p_key text, p_max_attempts integer, p_window interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(p_action text, p_key text, p_max_attempts integer, p_window interval) TO service_role;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_saved_carts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_saved_carts() TO service_role;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limit_attempts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rate_limit_attempts() TO service_role;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_verification_codes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_verification_codes() TO service_role;
REVOKE EXECUTE ON FUNCTION public.close_paid_donation_only() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_paid_donation_only() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_paid_donation_only() TO anon;
GRANT EXECUTE ON FUNCTION public.close_paid_donation_only() TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_paid_donation_only() TO service_role;
REVOKE EXECUTE ON FUNCTION public.current_courier_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_courier_id() TO service_role;
REVOKE EXECUTE ON FUNCTION public.edit_order_apply(p_order_id uuid, p_items jsonb, p_total numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.edit_order_apply(p_order_id uuid, p_items jsonb, p_total numeric) TO service_role;
REVOKE EXECUTE ON FUNCTION public.enforce_courier_delivery_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_courier_delivery_update() TO service_role;
REVOKE EXECUTE ON FUNCTION public.generate_daily_order_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_daily_order_number() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_public_event_settings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_event_settings() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_event_settings() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_event_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_event_settings() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_webhook_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_webhook_secret() TO service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
REVOKE EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role_admin(_uid uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role_admin(_uid uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role_admin(_uid uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.inventory_adjust(p_item uuid, p_delta numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_adjust(p_item uuid, p_delta numeric) TO service_role;
REVOKE EXECUTE ON FUNCTION public.inventory_set_quantity(p_item uuid, p_qty numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_set_quantity(p_item uuid, p_qty numeric) TO service_role;
REVOKE EXECUTE ON FUNCTION public.is_approved_courier(_uid uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_courier(_uid uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_approved_courier(_uid uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_attack_mode_active() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_attack_mode_active() TO service_role;
REVOKE EXECUTE ON FUNCTION public.is_ip_blocked(p_ip text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_ip_blocked(p_ip text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.mark_order_paid(p_order_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(p_order_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(p_order_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.next_daily_queue_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_daily_queue_number() TO service_role;
REVOKE EXECUTE ON FUNCTION public.notify_couriers_new_delivery() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_couriers_new_delivery() TO service_role;
REVOKE EXECUTE ON FUNCTION public.notify_daily_sales_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_daily_sales_summary() TO service_role;
REVOKE EXECUTE ON FUNCTION public.notify_kitchen_new_order() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_kitchen_new_order() TO service_role;
REVOKE EXECUTE ON FUNCTION public.notify_order_ready() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_order_ready() TO service_role;
REVOKE EXECUTE ON FUNCTION public.notify_orders_almost_ready() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_orders_almost_ready() TO service_role;
REVOKE EXECUTE ON FUNCTION public.pay_order_from_soldier_fund(p_order_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_order_from_soldier_fund(p_order_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_order_from_soldier_fund(p_order_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.pull_fridge_for_menu_id(p_order_id uuid, p_menu_id text, p_qty integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pull_fridge_for_menu_id(p_order_id uuid, p_menu_id text, p_qty integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_rate_limit_attempt(p_action text, p_key text, p_ip_address text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_rate_limit_attempt(p_action text, p_key text, p_ip_address text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reping_kitchen_for_pending_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reping_kitchen_for_pending_orders() TO service_role;
REVOKE EXECUTE ON FUNCTION public.resolve_fridge_menu_ids(p_value text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_fridge_menu_ids(p_value text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.restore_fridge_for_menu_id(p_order_id uuid, p_menu_id text, p_qty integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_fridge_for_menu_id(p_order_id uuid, p_menu_id text, p_qty integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.restore_fridge_for_order_item(p_order_id uuid, p_row jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_fridge_for_order_item(p_order_id uuid, p_row jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.soldier_fund_balance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soldier_fund_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.soldier_fund_balance() TO service_role;
REVOKE EXECUTE ON FUNCTION public.soldier_fund_on_paid() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soldier_fund_on_paid() TO service_role;
REVOKE EXECUTE ON FUNCTION public.soldier_fund_public_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soldier_fund_public_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.soldier_fund_public_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.soldier_fund_public_stats() TO service_role;
REVOKE EXECUTE ON FUNCTION public.unmark_order_paid(p_order_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unmark_order_paid(p_order_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unmark_order_paid(p_order_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.update_restaurant_status_last_opened() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_restaurant_status_last_opened() TO service_role;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

-- 9) Realtime publication
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.courier_locations; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_toppings; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_requests; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_movements; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_availability; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_status; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 10) Cron jobs
SELECT cron.schedule('notify_orders_almost_ready_every_minute', '* * * * *', ' SELECT public.notify_orders_almost_ready(); ');
SELECT cron.schedule('reping-kitchen-pending-orders', '30 seconds', ' SELECT public.reping_kitchen_for_pending_orders(); ');
