-- Staff stock reports: an employee marks a product as "ran out" or "running
-- low" from the personal page; the admin sees open reports and clears them.

create table if not exists public.staff_stock_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null check (category in ('טייק אווי', 'ירקות', 'שתייה', 'קפואים', 'לחמניות')),
  sort_order int not null default 0,
  active boolean not null default true
);
create table if not exists public.staff_stock_reports (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.staff_stock_items(id) on delete cascade,
  level text not null check (level in ('out', 'low')),
  staff_id uuid references public.staff_members(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index if not exists staff_stock_reports_one_open on public.staff_stock_reports(item_id) where resolved_at is null;
do $$
declare t text;
begin
  foreach t in array array['staff_stock_items','staff_stock_reports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "Admin manages %s" on public.%I', t, t);
    execute format('create policy "Admin manages %s" on public.%I for all to authenticated using (public.has_role(auth.uid(), ''admin''::app_role)) with check (public.has_role(auth.uid(), ''admin''::app_role))', t, t);
  end loop;
end $$;

-- Products taken from the site's inventory list, grouped for the staff page.
insert into public.staff_stock_items(name, category, sort_order)
select i.name,
       case when i.category in ('בירות', 'בקבוקים', 'פחיות') then 'שתייה'
            when i.category = 'לחם' then 'לחמניות'
            else 'קפואים' end,
       (case i.category when 'פחיות' then 100 when 'בקבוקים' then 200 when 'בירות' then 300 else 0 end) + i.sort_order
from public.inventory_items i
on conflict (name) do nothing;
insert into public.staff_stock_items(name, category, sort_order) values
 ('חסה', 'ירקות', 1), ('עגבנייה', 'ירקות', 2), ('בצל', 'ירקות', 3), ('חמוצים', 'ירקות', 4)
on conflict (name) do nothing;

create or replace function public.staff_stock_json()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'category', i.category,
           'level', (select r.level from public.staff_stock_reports r where r.item_id = i.id and r.resolved_at is null))
         order by i.sort_order, i.name), '[]'::jsonb)
  from public.staff_stock_items i where i.active
$$;

-- p_level: 'out', 'low', or null to take the report back.
create or replace function public.staff_portal_stock_set(p_token text, p_item_id uuid, p_level text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.staff_members; v_item public.staff_stock_items;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  select * into v_item from public.staff_stock_items where id = p_item_id and active;
  if v_item.id is null then raise exception 'not_found'; end if;
  if p_level is null then
    update public.staff_stock_reports set resolved_at = now() where item_id = p_item_id and resolved_at is null;
    return;
  end if;
  if p_level not in ('out', 'low') then raise exception 'not_found'; end if;
  insert into public.staff_stock_reports(item_id, level, staff_id) values (p_item_id, p_level, me.id)
  on conflict (item_id) where resolved_at is null do update set level = excluded.level, staff_id = excluded.staff_id, created_at = now();
  perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'stock-' || p_item_id,
    'title', case when p_level = 'out' then 'נגמר: ' else 'נשאר קצת: ' end || v_item.name,
    'body', 'דיווח של ' || me.display_name || ' · ' || v_item.category,
    'url', '/admin/shifts')), '[]'::jsonb) from public.staff_members o where o.is_owner and o.active and o.id <> me.id));
end $$;

do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.staff_portal_me(text)'::regprocedure);
  if position('''stock''' in d) = 0 then
    n := replace(d, '''open_since'', (select', '''stock'', public.staff_stock_json(),
    ''open_since'', (select');
    if n = d then raise exception 'portal_me stock patch failed'; end if;
    execute n;
  end if;
end $$;

revoke all on function public.staff_stock_json() from public, anon, authenticated;
revoke all on function public.staff_portal_stock_set(text, uuid, text) from public;
grant execute on function public.staff_portal_stock_set(text, uuid, text) to anon, authenticated;
