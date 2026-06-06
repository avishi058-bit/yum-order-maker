
SELECT cron.unschedule('reping-kitchen-pending-orders');
SELECT cron.schedule(
  'reping-kitchen-pending-orders',
  '30 seconds',
  $$ SELECT public.reping_kitchen_for_pending_orders(); $$
);
