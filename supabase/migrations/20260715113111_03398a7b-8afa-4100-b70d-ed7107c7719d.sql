REVOKE EXECUTE ON FUNCTION public.is_ip_blocked(text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_activate_attack_mode() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_attack_mode_active() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_ip_blocked(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_and_activate_attack_mode() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_attack_mode_active() TO service_role;