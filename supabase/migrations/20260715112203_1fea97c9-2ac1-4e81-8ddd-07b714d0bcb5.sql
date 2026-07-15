CREATE TABLE public.blocked_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  reason text NOT NULL,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  blocked_by uuid REFERENCES auth.users(id)
);

GRANT SELECT ON public.blocked_phones TO authenticated;
GRANT ALL ON public.blocked_phones TO service_role;

ALTER TABLE public.blocked_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view blocked phones"
  ON public.blocked_phones FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete blocked phones"
  ON public.blocked_phones FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_blocked_phones_phone ON public.blocked_phones(phone);