
REVOKE EXECUTE ON FUNCTION public.pull_fridge_for_menu_id(uuid,text,integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.restore_fridge_for_menu_id(uuid,text,integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.resolve_fridge_menu_ids(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.restore_fridge_for_order_item(uuid,jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_orders_almost_ready() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.reping_kitchen_for_pending_orders() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_saved_carts() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_verification_codes() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_otp_rate_limit(text) FROM anon, public;
