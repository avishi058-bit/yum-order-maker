
DO $$
DECLARE
  fn text;
  internal_fns text[] := ARRAY[
    'public.apply_order_item_to_fridge()',
    'public.apply_order_to_inventory()',
    'public.auto_block_event_date()',
    'public.cleanup_expired_saved_carts()',
    'public.cleanup_old_rate_limit_attempts()',
    'public.cleanup_old_verification_codes()',
    'public.get_webhook_secret()',
    'public.handle_new_user()',
    'public.notify_couriers_new_delivery()',
    'public.notify_kitchen_new_order()',
    'public.notify_order_ready()',
    'public.notify_orders_almost_ready()',
    'public.pull_fridge_for_menu_id(uuid, text, integer)',
    'public.record_rate_limit_attempt(text, text, text)',
    'public.reping_kitchen_for_pending_orders()',
    'public.restore_fridge_for_menu_id(uuid, text, integer)',
    'public.restore_fridge_for_order_item(uuid, jsonb)'
  ];
BEGIN
  FOREACH fn IN ARRAY internal_fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Anyone can subscribe to push" ON public.push_subscriptions;

CREATE POLICY "Anyone can subscribe to push"
ON public.push_subscriptions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  endpoint IS NOT NULL
  AND length(endpoint) < 2000
  AND for_reopen IS NOT TRUE
  AND (
    (order_id IS NULL AND customer_phone IS NULL)
    OR (
      order_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = push_subscriptions.order_id
          AND o.created_at > now() - interval '48 hours'
          AND (
            push_subscriptions.customer_phone IS NULL
            OR o.customer_phone = push_subscriptions.customer_phone
          )
      )
    )
  )
);

DROP POLICY IF EXISTS "Anyone can log a prompt event" ON public.notification_prompts;

CREATE POLICY "Anyone can log a prompt event"
ON public.notification_prompts
FOR INSERT
TO anon, authenticated
WITH CHECK (
  action IS NOT NULL AND length(action) <= 64
  AND (phone IS NULL OR length(phone) <= 20)
  AND (device_fingerprint IS NULL OR length(device_fingerprint) <= 256)
);
