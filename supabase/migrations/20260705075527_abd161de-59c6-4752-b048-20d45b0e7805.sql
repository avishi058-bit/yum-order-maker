ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS for_reopen boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_for_reopen ON public.push_subscriptions (for_reopen) WHERE for_reopen = true;
-- Allow anon to insert reopen push subscriptions (customers may not be authenticated)
DROP POLICY IF EXISTS "Anyone can insert reopen push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Anyone can insert reopen push subscriptions" ON public.push_subscriptions FOR INSERT TO anon, authenticated WITH CHECK (for_reopen = true);