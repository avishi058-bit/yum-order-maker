
REVOKE ALL ON FUNCTION public.get_webhook_secret() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_webhook_secret() FROM anon, authenticated;
-- service_role and postgres retain access; SECURITY DEFINER trigger functions still work.
