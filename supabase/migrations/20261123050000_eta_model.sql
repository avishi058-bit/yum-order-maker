-- Order time estimate that learns. Fitted on ~1,450 past orders (median
-- regression; checked on the last 25% it never saw: off by ~8 minutes on
-- average, about the noise of when "ready" is tapped):
--   minutes = 11.6 + 2.8 x burgers in the order + 0.77 x burgers already in prep
--           + 0.6 x sides (fries, waffle, rings, mix) already in prep
--           + 5.3 if the kitchen was idle 30+ minutes (plancha warming up)
--           + 2.4 for website orders
-- Every order gets a prediction when it is paid; when it is marked ready the
-- real time is stored next to it, and the model shifts itself by the median
-- miss of the last 40 orders. Nothing is shown to customers yet (shadow mode).
create table if not exists public.eta_model (
  id int primary key default 1 check (id = 1),
  icpt numeric not null, k_own_b numeric not null, k_ahead_b numeric not null, k_ahead_s numeric not null,
  k_cold numeric not null, k_web numeric not null, bias numeric not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.eta_model (icpt, k_own_b, k_ahead_b, k_ahead_s, k_cold, k_web)
values (11.59, 2.79, 0.77, 0.61, 5.32, 2.42) on conflict (id) do nothing;

create table if not exists public.eta_predictions (
  order_id uuid primary key references public.orders(id) on delete cascade,
  predicted_at timestamptz not null default now(),
  raw_minutes numeric not null,
  bias numeric not null,
  minutes numeric not null,
  features jsonb not null,
  actual_minutes numeric,
  ready_at timestamptz
);
alter table public.eta_model enable row level security;
alter table public.eta_predictions enable row level security;

create or replace function public.order_burger_count(p_order uuid)
returns numeric language sql stable security definer set search_path to 'public' as $function$
  select coalesce(sum(case
      when jsonb_typeof(oi.deal_burgers) = 'array' and jsonb_array_length(oi.deal_burgers) > 0 then jsonb_array_length(oi.deal_burgers) * oi.quantity
      when oi.item_id like 'meal-%' or oi.item_id in ('classic','avishai','crazy-smash','napoleon','smash-double-cheese',
        'smash-moshavnikim','special-hadegel','double','haf-mifsha','crispy-chicken','arayes-special','arayes-special-4') then oi.quantity
      else 0 end), 0)
  from public.order_items oi where oi.order_id = p_order;
$function$;

create or replace function public.order_side_count(p_order uuid)
returns numeric language sql stable security definer set search_path to 'public' as $function$
  select coalesce(sum(case
      when oi.item_id in ('fries','sweet-potato-fries','onion-rings','tempura-onion','waffle-fries') then oi.quantity
      when oi.item_id = 'friends-mix' then 3 * oi.quantity
      when jsonb_typeof(oi.deal_burgers) = 'array' and jsonb_array_length(oi.deal_burgers) > 0 then 2 * oi.quantity
      when oi.item_id like 'meal-%' or oi.with_meal then oi.quantity
      else 0 end), 0)
  from public.order_items oi where oi.order_id = p_order;
$function$;

create or replace function public.eta_predict(p_order uuid)
returns numeric language plpgsql stable security definer set search_path to 'public' as $function$
declare m public.eta_model; o public.orders; own_b numeric; ab numeric; asd numeric; cold boolean;
begin
  select * into m from public.eta_model where id = 1;
  select * into o from public.orders where id = p_order;
  own_b := public.order_burger_count(p_order);
  select coalesce(sum(public.order_burger_count(x.id)), 0), coalesce(sum(public.order_side_count(x.id)), 0)
    into ab, asd
    from public.orders x where x.id <> p_order and x.status in ('new', 'preparing')
     and (x.scheduled_for is null or x.scheduled_for <= now() + interval '20 minutes');
  cold := not exists (select 1 from public.inventory_movements im where im.reason = 'order_ready' and im.created_at > now() - interval '30 minutes');
  return greatest(10, m.icpt + m.k_own_b * own_b + m.k_ahead_b * ab + m.k_ahead_s * asd
    + case when cold then m.k_cold else 0 end + case when o.order_source = 'website' then m.k_web else 0 end + m.bias);
end $function$;

-- Record a prediction for an order (once). Used when it is paid and, for
-- orders whose items arrive a moment after the order row (cash at the kiosk),
-- again from the minute tick.
create or replace function public.eta_record(p_order uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare m public.eta_model; o public.orders; raw numeric; own_b numeric; ab numeric; asd numeric; cold boolean;
begin
  select * into o from public.orders where id = p_order;
  if o.id is null or o.scheduled_for is not null or o.status <> 'new' then return; end if;
  if exists (select 1 from public.eta_predictions where order_id = p_order) then return; end if;
  own_b := public.order_burger_count(p_order);
  if own_b = 0 then return; end if;
  select * into m from public.eta_model where id = 1;
  select coalesce(sum(public.order_burger_count(x.id)), 0), coalesce(sum(public.order_side_count(x.id)), 0)
    into ab, asd from public.orders x where x.id <> p_order and x.status in ('new', 'preparing')
     and (x.scheduled_for is null or x.scheduled_for <= now() + interval '20 minutes');
  cold := not exists (select 1 from public.inventory_movements im where im.reason = 'order_ready' and im.created_at > now() - interval '30 minutes');
  raw := m.icpt + m.k_own_b * own_b + m.k_ahead_b * ab + m.k_ahead_s * asd
    + case when cold then m.k_cold else 0 end + case when o.order_source = 'website' then m.k_web else 0 end;
  insert into public.eta_predictions (order_id, raw_minutes, bias, minutes, features)
  values (p_order, raw, m.bias, greatest(10, raw + m.bias),
    jsonb_build_object('own_b', own_b, 'ahead_b', ab, 'ahead_s', asd, 'cold', cold, 'source', o.order_source, 'dine_in', o.dine_in))
  on conflict (order_id) do nothing;
end $function$;

create or replace function public.eta_on_order_new()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.status = 'new' and (tg_op = 'INSERT' or old.status is distinct from 'new') then
    begin
      perform public.eta_record(new.id);
    exception when others then
      null; -- never block an order because of the estimate
    end;
  end if;
  return null;
end $function$;

drop trigger if exists eta_on_order_new on public.orders;
create trigger eta_on_order_new after insert or update of status on public.orders
  for each row execute function public.eta_on_order_new();

-- Store real times and re-centre the model on the last 40 finished orders.
create or replace function public.eta_learn()
returns void language plpgsql security definer set search_path to 'public' as $function$
declare b numeric; n int; r record;
begin
  for r in select o.id from public.orders o where o.status = 'new' and o.created_at > now() - interval '5 minutes'
           and not exists (select 1 from public.eta_predictions p where p.order_id = o.id) loop
    begin perform public.eta_record(r.id); exception when others then null; end;
  end loop;
  update public.eta_predictions p set ready_at = rr.ready_at,
    actual_minutes = round((extract(epoch from rr.ready_at - p.predicted_at) / 60)::numeric, 1)
  from (select im.order_id, min(im.created_at) ready_at from public.inventory_movements im
        where im.reason = 'order_ready' and im.created_at > now() - interval '2 days' group by im.order_id) rr
  where p.order_id = rr.order_id and p.actual_minutes is null;
  select count(*), percentile_cont(0.5) within group (order by actual_minutes - raw_minutes)
    into n, b
    from (select actual_minutes, raw_minutes from public.eta_predictions
          where actual_minutes between 2 and 120 order by ready_at desc limit 40) x;
  if n >= 15 then
    update public.eta_model set bias = round(greatest(-10, least(15, b))::numeric, 1), updated_at = now() where id = 1;
  end if;
end $function$;

-- How good are we? (for the owner)
create or replace function public.eta_accuracy(p_days int default 14)
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select jsonb_build_object(
    'orders', count(*),
    'avg_miss_minutes', round(avg(abs(actual_minutes - minutes))::numeric, 1),
    'within_5_pct', round(100.0 * avg((abs(actual_minutes - minutes) <= 5)::int)),
    'later_than_estimate_by_10_pct', round(100.0 * avg((actual_minutes - minutes > 10)::int)),
    'bias', (select bias from public.eta_model where id = 1))
  from public.eta_predictions
  where actual_minutes between 2 and 120 and predicted_at > now() - make_interval(days => p_days);
$function$;

revoke execute on function public.eta_predict(uuid) from public, anon, authenticated;
revoke execute on function public.eta_learn() from public, anon, authenticated;
revoke execute on function public.eta_record(uuid) from public, anon, authenticated;
revoke execute on function public.eta_accuracy(int) from public, anon, authenticated;
revoke execute on function public.order_burger_count(uuid) from public, anon, authenticated;
revoke execute on function public.order_side_count(uuid) from public, anon, authenticated;

select cron.alter_job((select jobid from cron.job where jobname = 'staff-tasks-tick'),
  command := (select command from cron.job where jobname = 'staff-tasks-tick') || ' select public.eta_learn(); ');
