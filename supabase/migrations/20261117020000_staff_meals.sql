-- Staff meals: employees report drinks and staff meals they took, at staff
-- prices. The admin sees each person's monthly total.

create table if not exists public.staff_meal_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(8,2) not null check (price >= 0),
  sort_order int not null default 0,
  active boolean not null default true
);
create table if not exists public.staff_meal_logs (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  item_name text not null,
  price numeric(8,2) not null,
  created_at timestamptz not null default now()
);
create index if not exists staff_meal_logs_staff_idx on public.staff_meal_logs(staff_id, created_at);
do $$
declare t text;
begin
  foreach t in array array['staff_meal_items','staff_meal_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "Admin manages %s" on public.%I', t, t);
    execute format('create policy "Admin manages %s" on public.%I for all to authenticated using (public.has_role(auth.uid(), ''admin''::app_role)) with check (public.has_role(auth.uid(), ''admin''::app_role))', t, t);
  end loop;
end $$;

insert into public.staff_meal_items(name, price, sort_order) values
 ('המבורגר', 15, 1), ('כפולה', 25, 2), ('תוספת קציצה', 10, 3), ('צ׳יפס', 5, 4),
 ('שתייה', 5, 5), ('פיוז טי', 6, 6), ('בירה', 8, 7),
 ('בצל מטוגן', 2, 8), ('ריבת בצל', 2, 9), ('ביצת עין', 2, 10), ('גבינה', 2, 11), ('רוסטביף', 8, 12)
on conflict (name) do nothing;

create or replace function public.staff_meals_json(p_staff_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with logs as (
    select l.* from public.staff_meal_logs l
    where l.staff_id = p_staff_id
      and l.created_at >= (date_trunc('month', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'))
  select jsonb_build_object(
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'price', i.price) order by i.sort_order, i.name), '[]'::jsonb)
              from public.staff_meal_items i where i.active),
    'month_total', (select coalesce(sum(price), 0) from logs),
    'logs', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', item_name, 'price', price, 'at', created_at,
                      'can_remove', created_at > now() - interval '12 hours') order by created_at desc), '[]'::jsonb) from logs))
$$;

create or replace function public.staff_portal_meal_add(p_token text, p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me public.staff_members; v_item public.staff_meal_items;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  select * into v_item from public.staff_meal_items where id = p_item_id and active;
  if v_item.id is null then raise exception 'not_found'; end if;
  if (select count(*) from public.staff_meal_logs where staff_id = me.id and created_at > now() - interval '12 hours') >= 30 then
    raise exception 'too_many';
  end if;
  insert into public.staff_meal_logs(staff_id, item_name, price) values (me.id, v_item.name, v_item.price);
end $$;

-- An employee can take back a report only within 12 hours.
create or replace function public.staff_portal_meal_remove(p_token text, p_log_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me public.staff_members;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  delete from public.staff_meal_logs where id = p_log_id and staff_id = me.id and created_at > now() - interval '12 hours';
  if not found then raise exception 'not_found'; end if;
end $$;

do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.staff_portal_me(text)'::regprocedure);
  if position('''meals''' in d) = 0 then
    n := replace(d, '''open_since'', (select', '''meals'', public.staff_meals_json(me.id),
    ''open_since'', (select');
    if n = d then raise exception 'portal_me meals patch failed'; end if;
    execute n;
  end if;
end $$;

revoke all on function public.staff_meals_json(uuid) from public, anon, authenticated;
revoke all on function public.staff_portal_meal_add(text, uuid) from public;
grant execute on function public.staff_portal_meal_add(text, uuid) to anon, authenticated;
revoke all on function public.staff_portal_meal_remove(text, uuid) from public;
grant execute on function public.staff_portal_meal_remove(text, uuid) to anon, authenticated;
