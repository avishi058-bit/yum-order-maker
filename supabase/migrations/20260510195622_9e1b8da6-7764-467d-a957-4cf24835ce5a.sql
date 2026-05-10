CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_phone text,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_order ON public.push_subscriptions(order_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe to push"
  ON public.push_subscriptions
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Staff can read push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role));

CREATE POLICY "Staff can delete push subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role));