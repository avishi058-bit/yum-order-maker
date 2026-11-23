-- The estimate goes live: every paid order with burgers gets estimated_ready_at
-- from the model (rounded to the nearest 5 minutes) unless the kitchen already
-- set a time. orders.eta_source says who set it ('auto' / 'kitchen'); the
-- "10 minutes / almost ready" pushes only follow times the kitchen set.
alter table public.orders add column if not exists eta_source text;

create or replace function public.orders_eta_source()
returns trigger language plpgsql as $function$
begin
  if new.estimated_ready_at is distinct from old.estimated_ready_at then
    new.eta_source := case when coalesce(current_setting('app.eta_auto', true), '') = '1' then 'auto' else 'kitchen' end;
  end if;
  return new;
end $function$;
drop trigger if exists orders_eta_source on public.orders;
create trigger orders_eta_source before update of estimated_ready_at on public.orders
  for each row execute function public.orders_eta_source();

-- eta_record(order): after recording the prediction, when estimated_ready_at is
-- null it sets it to now() + shown minutes under app.eta_auto = '1'.
-- notify_orders_almost_ready(): both loops gained
--   AND coalesce(eta_source, 'kitchen') <> 'auto'
-- (patched live).
