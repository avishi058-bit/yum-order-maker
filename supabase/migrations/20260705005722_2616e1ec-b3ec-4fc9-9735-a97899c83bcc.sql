
CREATE TABLE public.notification_prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text,
  device_fingerprint text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('shown','accepted','dismissed','denied')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notification_prompts_action ON public.notification_prompts(action);
CREATE INDEX idx_notification_prompts_created_at ON public.notification_prompts(created_at DESC);
GRANT INSERT, SELECT ON public.notification_prompts TO anon, authenticated;
GRANT ALL ON public.notification_prompts TO service_role;
ALTER TABLE public.notification_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log a prompt event" ON public.notification_prompts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins can view all prompts" ON public.notification_prompts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
