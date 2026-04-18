
-- Table to store customers who want to be notified when website reopens after manual closure
CREATE TABLE public.reopen_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  name TEXT,
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup of pending notifications
CREATE INDEX idx_reopen_notifications_pending ON public.reopen_notifications (notified, created_at) WHERE notified = false;

-- Enable RLS
ALTER TABLE public.reopen_notifications ENABLE ROW LEVEL SECURITY;

-- Anyone can request a reopen notification (insert their phone)
CREATE POLICY "Anyone can subscribe for reopen notification"
ON public.reopen_notifications
FOR INSERT
TO public
WITH CHECK (true);

-- Only staff can read who's subscribed
CREATE POLICY "Staff can read reopen notifications"
ON public.reopen_notifications
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role));

-- Only admins can update (mark as notified)
CREATE POLICY "Admins can update reopen notifications"
ON public.reopen_notifications
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
