CREATE TABLE public.blocked_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL UNIQUE,
  reason text NOT NULL,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  blocked_by uuid REFERENCES auth.users(id)
);

GRANT SELECT ON public.blocked_ips TO authenticated;
GRANT ALL ON public.blocked_ips TO service_role;

ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view blocked ips"
  ON public.blocked_ips FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete blocked ips"
  ON public.blocked_ips FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_blocked_ips_ip ON public.blocked_ips(ip_address);