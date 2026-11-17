-- Waste reports ("a patty fell", "a bun burned"): the employee picks what and
-- why; the site's inventory goes down by that amount, and the owner sees a
-- monthly list. Also: plain water by the case, takeaway delivered on Tuesday
-- (owner reminded on Monday when takeaway items are reported missing).
update public.staff_stock_items set pack_name = 'ארגז', pack_size = 24 where name = 'מים';
update public.staff_suppliers set delivery_weekday = 2 where id = 'takeaway';

create table if not exists public.staff_waste_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  amount numeric not null default 1,
  sort_order int not null default 0,
  active boolean not null default true
);
create table if not exists public.staff_waste_logs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.staff_waste_items(id) on delete set null,
  item_name text not null,
  quantity int not null check (quantity between 1 and 50),
  reason text not null,
  staff_id uuid references public.staff_members(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.staff_waste_items enable row level security;
alter table public.staff_waste_logs enable row level security;
revoke all on public.staff_waste_items, public.staff_waste_logs from anon;
grant select, insert, update on public.staff_waste_items to authenticated;
grant select on public.staff_waste_logs to authenticated;
drop policy if exists "Admin manages staff_waste_items" on public.staff_waste_items;
create policy "Admin manages staff_waste_items" on public.staff_waste_items for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role)) with check (public.has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "Admin reads staff_waste_logs" on public.staff_waste_logs;
create policy "Admin reads staff_waste_logs" on public.staff_waste_logs for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

-- Portions use the most common amount in the site's recipes (a fries portion in grams).
insert into public.staff_waste_items(name, inventory_item_id, amount, sort_order)
select v.n, i.id,
       case when v.portion then coalesce((select mode() within group (order by r.amount_per_unit) from public.inventory_recipes r where r.inventory_item_id = i.id), 0) else 1 end,
       v.s
from (values ('קציצה', 'קציצה%', false, 1), ('לחמניה', 'לחמניה רגילה', false, 2), ('לחמניה ללא גלוטן', 'לחמניה ללא גלוטן', false, 3),
             ('חזה עוף', 'חזה עוף קריספי', false, 4), ('מנת צ׳יפס', 'צ%יפס רגיל', true, 5), ('מנת וופל צ׳יפס', 'וופל צ%יפס', true, 6),
             ('מנת טבעות בצל', 'טבעות בצל', true, 7)) v(n, pat, portion, s)
left join lateral (select id from public.inventory_items where name like v.pat order by name limit 1) i on true
on conflict (name) do nothing;
insert into public.staff_waste_items(name, inventory_item_id, amount, sort_order)
values ('המבורגר שלם', null, 1, 8), ('אחר', null, 1, 9)
on conflict (name) do nothing;

create or replace function public.staff_portal_waste_list(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me public.staff_members;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  return jsonb_build_object(
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name) order by w.sort_order, w.name), '[]'::jsonb)
              from public.staff_waste_items w where w.active),
    'today', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'name', l.item_name, 'quantity', l.quantity, 'reason', l.reason,
                'at', l.created_at, 'can_remove', l.created_at > now() - interval '5 minutes') order by l.created_at desc), '[]'::jsonb)
              from public.staff_waste_logs l where l.staff_id = me.id and l.created_at > now() - interval '14 hours'));
end $$;

create or replace function public.staff_portal_waste_add(p_token text, p_item_id uuid, p_qty int, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.staff_members; w public.staff_waste_items; v_log uuid;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  select * into w from public.staff_waste_items where id = p_item_id and active;
  if w.id is null or p_qty not between 1 and 50 or length(coalesce(p_reason, '')) not between 1 and 80 then raise exception 'not_found'; end if;
  if (select count(*) from public.staff_waste_logs where staff_id = me.id and created_at > now() - interval '1 hour') >= 30 then raise exception 'too_many'; end if;
  insert into public.staff_waste_logs(item_id, item_name, quantity, reason, staff_id) values (w.id, w.name, p_qty, p_reason, me.id) returning id into v_log;
  if w.inventory_item_id is not null and w.amount > 0 then
    update public.inventory_items set quantity = quantity - w.amount * p_qty where id = w.inventory_item_id;
    insert into public.inventory_movements(inventory_item_id, delta, reason, note)
    values (w.inventory_item_id, -w.amount * p_qty, 'waste', 'פחת: ' || p_reason || ' · ' || v_log::text);
  end if;
end $$;

create or replace function public.staff_portal_waste_remove(p_token text, p_log_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me public.staff_members; l public.staff_waste_logs; w public.staff_waste_items;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  select * into l from public.staff_waste_logs where id = p_log_id and staff_id = me.id and created_at > now() - interval '5 minutes';
  if l.id is null then raise exception 'not_found'; end if;
  select * into w from public.staff_waste_items where id = l.item_id;
  if w.inventory_item_id is not null and w.amount > 0 then
    update public.inventory_items set quantity = quantity + w.amount * l.quantity where id = w.inventory_item_id;
    insert into public.inventory_movements(inventory_item_id, delta, reason, note)
    values (w.inventory_item_id, w.amount * l.quantity, 'waste', 'ביטול פחת · ' || l.id::text);
  end if;
  delete from public.staff_waste_logs where id = l.id;
end $$;
revoke all on function public.staff_portal_waste_list(text), public.staff_portal_waste_add(text, uuid, int, text), public.staff_portal_waste_remove(text, uuid) from public;
grant execute on function public.staff_portal_waste_list(text), public.staff_portal_waste_add(text, uuid, int, text), public.staff_portal_waste_remove(text, uuid) to anon, authenticated;

-- Monday morning: takeaway items reported missing -> remind the owner to order.
create or replace function public.staff_owner_order_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare v_il timestamp := now() at time zone 'Asia/Jerusalem'; s record; v_n int; v_owner uuid[];
begin
  if v_il::time < '10:00' or v_il::time > '20:00' then return; end if;
  select array_agg(id) into v_owner from public.staff_members where is_owner and active;
  if v_owner is null then return; end if;
  for s in select * from public.staff_suppliers
           where delivery_weekday is not null and count_weekday is null
             and extract(dow from v_il::date)::int = (delivery_weekday + 6) % 7 loop
    select count(*) into v_n from public.staff_stock_reports r join public.staff_stock_items i on i.id = r.item_id
     where r.resolved_at is null and i.supplier = s.id and i.active;
    continue when v_n = 0;
    perform public.staff_notify_once('order-due', v_il::date::text || '-' || s.id, v_owner,
      'להזמין היום מספק ה' || s.name,
      v_n || ' מוצרים חסרים. ההזמנה מוכנה בדף הסידור - בודקים ושולחים בוואטסאפ.', '/admin/shifts#orders');
  end loop;
end $$;
revoke all on function public.staff_owner_order_reminders() from public, anon, authenticated;

select cron.unschedule('staff-tasks-tick') where exists (select 1 from cron.job where jobname = 'staff-tasks-tick');
select cron.schedule('staff-tasks-tick', '* * * * *', $cron$ select public.staff_give_idle_task(); select public.staff_clockout_reminders(); select public.staff_closing_nudge(); select public.staff_supplier_reminders(); select public.staff_owner_order_reminders(); $cron$);

-- "אחר" needs to say what was thrown away.
drop function if exists public.staff_portal_waste_add(text, uuid, int, text);
create or replace function public.staff_portal_waste_add(p_token text, p_item_id uuid, p_qty int, p_reason text, p_what text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me public.staff_members; w public.staff_waste_items; v_log uuid; v_name text;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  select * into w from public.staff_waste_items where id = p_item_id and active;
  if w.id is null or p_qty not between 1 and 50 or length(coalesce(p_reason, '')) not between 1 and 80 then raise exception 'not_found'; end if;
  v_name := case when w.name = 'אחר' then nullif(trim(left(coalesce(p_what, ''), 60)), '') else w.name end;
  if v_name is null then raise exception 'not_found'; end if;
  if (select count(*) from public.staff_waste_logs where staff_id = me.id and created_at > now() - interval '1 hour') >= 30 then raise exception 'too_many'; end if;
  insert into public.staff_waste_logs(item_id, item_name, quantity, reason, staff_id) values (w.id, v_name, p_qty, p_reason, me.id) returning id into v_log;
  if w.inventory_item_id is not null and w.amount > 0 then
    update public.inventory_items set quantity = quantity - w.amount * p_qty where id = w.inventory_item_id;
    insert into public.inventory_movements(inventory_item_id, delta, reason, note)
    values (w.inventory_item_id, -w.amount * p_qty, 'waste', 'פחת: ' || p_reason || ' · ' || v_log::text);
  end if;
end $$;
revoke all on function public.staff_portal_waste_add(text, uuid, int, text, text) from public;
grant execute on function public.staff_portal_waste_add(text, uuid, int, text, text) to anon, authenticated;
