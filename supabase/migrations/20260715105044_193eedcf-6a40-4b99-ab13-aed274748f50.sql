
-- ============================================================
-- Security hardening: lock down SECURITY DEFINER functions
-- ============================================================
-- Postgres grants EXECUTE to PUBLIC by default. We revoke it
-- from every internal function so anon/authenticated cannot
-- call them via PostgREST RPC. They still work when called
-- from triggers, other SECURITY DEFINER functions, and the
-- service_role (edge functions), because SECURITY DEFINER
-- runs as the function owner (postgres).
-- ============================================================

-- Webhook secret (CRITICAL - was leaking the internal secret)
REVOKE ALL ON FUNCTION public.get_webhook_secret() FROM PUBLIC, anon, authenticated;

-- Inventory / fridge mutations (CRITICAL)
REVOKE ALL ON FUNCTION public.pull_fridge_for_menu_id(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_fridge_for_menu_id(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_fridge_for_order_item(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_fridge_menu_ids(text) FROM PUBLIC, anon, authenticated;

-- Cleanup / destructive maintenance (CRITICAL)
REVOKE ALL ON FUNCTION public.cleanup_old_verification_codes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_old_rate_limit_attempts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_saved_carts() FROM PUBLIC, anon, authenticated;

-- Rate limit attempt injection (HIGH - lockout of victims)
REVOKE ALL ON FUNCTION public.record_rate_limit_attempt(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, integer, interval) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_otp_rate_limit(text) FROM PUBLIC, anon, authenticated;

-- Notification spam (HIGH)
REVOKE ALL ON FUNCTION public.reping_kitchen_for_pending_orders() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_orders_almost_ready() FROM PUBLIC, anon, authenticated;

-- Trigger-only helpers (hygiene - not callable meaningfully but revoke anyway)
REVOKE ALL ON FUNCTION public.notify_kitchen_new_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_couriers_new_delivery() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_order_ready() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_order_item_to_fridge() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_order_to_inventory() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_block_event_date() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Role / identity helpers - used inside RLS policies (RLS calls
-- them as the policy owner regardless of EXECUTE grants, so
-- revoking here is safe and prevents info-disclosure via RPC).
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_approved_courier(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_courier_id() FROM PUBLIC, anon, authenticated;

-- Order number generator (used only as column DEFAULT, runs as owner)
REVOKE ALL ON FUNCTION public.generate_daily_order_number() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Tighten reopen push_subscriptions insert: was accepting
-- unbounded endpoint / p256dh / auth strings.
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert reopen push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Anyone can insert reopen push subscriptions"
ON public.push_subscriptions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  for_reopen = true
  AND endpoint IS NOT NULL
  AND length(endpoint) BETWEEN 20 AND 2000
  AND (p256dh IS NULL OR length(p256dh) <= 300)
  AND (auth IS NULL OR length(auth) <= 300)
  AND (customer_phone IS NULL OR length(customer_phone) <= 20)
  AND order_id IS NULL
);
