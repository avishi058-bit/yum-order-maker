-- Quiet time only when it is really quiet: no customer building an order on
-- the site or the kiosk (the kitchen screen reports it), no order waiting for
-- payment, and no pre-order due within 20 minutes.
create table if not exists public.staff_kitchen_signal (
  id int primary key default 1 check (id = 1),
  last_customer_at timestamptz
);
insert into public.staff_kitchen_signal(id) values (1) on conflict do nothing;
alter table public.staff_kitchen_signal enable row level security;
revoke all on public.staff_kitchen_signal from anon;

create or replace function public.kitchen_customers_active()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.staff_caller_is_kitchen() then raise exception 'forbidden'; end if;
  update public.staff_kitchen_signal set last_customer_at = now() where id = 1;
end $$;
revoke all on function public.kitchen_customers_active() from public, anon;
grant execute on function public.kitchen_customers_active() to authenticated;

create or replace function public.staff_really_quiet()
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.staff_kitchen_signal k where k.last_customer_at > now() - interval '3 minutes')
     and not exists (select 1 from public.orders o where o.status = 'pending_payment' and o.created_at > now() - interval '10 minutes')
     and not exists (select 1 from public.orders o where o.scheduled_for between now() - interval '10 minutes' and now() + interval '20 minutes'
                     and o.status not in ('cancelled', 'payment_failed', 'completed'))
$$;
revoke all on function public.staff_really_quiet() from public, anon, authenticated;

do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.staff_give_idle_task()'::regprocedure);
  n := replace(d, '  if v_name is null then return; end if;', '  if v_name is null then return; end if;
  if not public.staff_really_quiet() then return; end if;');
  if n = d then raise exception 'staff_give_idle_task patch failed'; end if;
  execute n;
  d := pg_get_functiondef('public.staff_closing_nudge()'::regprocedure);
  n := replace(d, '  if exists (select 1 from public.orders o where o.status in (''new'', ''preparing'')) then return; end if;',
    '  if exists (select 1 from public.orders o where o.status in (''new'', ''preparing'')) then return; end if;
  if not public.staff_really_quiet() then return; end if;');
  if n = d then raise exception 'staff_closing_nudge patch failed'; end if;
  execute n;
end $$;
