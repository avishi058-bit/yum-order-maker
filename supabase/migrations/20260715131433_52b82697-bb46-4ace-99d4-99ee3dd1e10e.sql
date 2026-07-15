GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_courier(uuid) TO authenticated, anon;