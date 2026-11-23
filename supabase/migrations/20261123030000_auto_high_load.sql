-- Automatic "busy" mode: when more than 7 burgers are being prepared, the site
-- shows the busy banner on its own; it turns off again once it is 7 or fewer.
-- The kitchen's manual switch always wins: a manual "on" is never turned off
-- automatically, and a manual "off" pauses the automatic mode for 30 minutes.
alter table public.restaurant_status
  add column if not exists high_load_auto boolean not null default false,
  add column if not exists high_load_snooze_until timestamptz;

create or replace function public.restaurant_high_load_manual()
returns trigger language plpgsql as $function$
begin
  -- A change of high_load that did not come with a change of high_load_auto
  -- is a manual switch from the kitchen.
  if new.high_load is distinct from old.high_load and new.high_load_auto is not distinct from old.high_load_auto then
    if old.high_load_auto and not new.high_load then
      new.high_load_snooze_until := now() + interval '30 minutes';
    end if;
    new.high_load_auto := false;
  end if;
  return new;
end $function$;

drop trigger if exists restaurant_high_load_manual on public.restaurant_status;
create trigger restaurant_high_load_manual before update on public.restaurant_status
  for each row execute function public.restaurant_high_load_manual();

create or replace function public.kitchen_burgers_in_prep()
returns integer language sql stable security definer set search_path to 'public' as $function$
  select coalesce(sum(case
      when jsonb_typeof(oi.deal_burgers) = 'array' and jsonb_array_length(oi.deal_burgers) > 0
        then jsonb_array_length(oi.deal_burgers) * oi.quantity
      when oi.item_id like 'meal-%' or oi.item_id in ('classic','avishai','crazy-smash','napoleon','smash-double-cheese',
        'smash-moshavnikim','special-hadegel','double','haf-mifsha','crispy-chicken','arayes-special','arayes-special-4')
        then oi.quantity
      else 0 end), 0)::int
  from public.orders o join public.order_items oi on oi.order_id = o.id
  where o.status in ('new', 'preparing')
    and (o.scheduled_for is null or o.scheduled_for <= now() + interval '20 minutes');
$function$;

create or replace function public.restaurant_auto_high_load()
returns void language plpgsql security definer set search_path to 'public' as $function$
declare r public.restaurant_status; n int;
begin
  select * into r from public.restaurant_status limit 1;
  if r.id is null then return; end if;
  n := public.kitchen_burgers_in_prep();
  if n > 7 and not r.high_load and (r.high_load_snooze_until is null or r.high_load_snooze_until < now()) then
    update public.restaurant_status set high_load = true, high_load_auto = true where id = r.id;
  elsif n <= 7 and r.high_load and r.high_load_auto then
    update public.restaurant_status set high_load = false, high_load_auto = false where id = r.id;
  end if;
end $function$;

revoke execute on function public.restaurant_auto_high_load() from public, anon, authenticated;
revoke execute on function public.kitchen_burgers_in_prep() from public, anon, authenticated;

select cron.alter_job((select jobid from cron.job where jobname = 'staff-tasks-tick'),
  command := (select command from cron.job where jobname = 'staff-tasks-tick') || ' select public.restaurant_auto_high_load(); ');
