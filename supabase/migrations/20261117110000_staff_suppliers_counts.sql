-- Suppliers and order rules. Before a delivery the evening shift counts that
-- supplier's products (frozen: count Sunday night, delivery Tuesday); leaving
-- the shift needs the count. The owner gets a ready order to send by WhatsApp.
-- Supplier phone numbers are set in the live database only (public repo).
create table if not exists public.staff_suppliers (
  id text primary key,
  name text not null,
  phone text,
  delivery_weekday int check (delivery_weekday between 0 and 6),
  count_weekday int check (count_weekday between 0 and 6),
  sort_order int not null default 0
);
alter table public.staff_suppliers enable row level security;
revoke all on public.staff_suppliers from anon;
grant select, update on public.staff_suppliers to authenticated;
drop policy if exists "Admin reads staff_suppliers" on public.staff_suppliers;
create policy "Admin reads staff_suppliers" on public.staff_suppliers for select to authenticated using (public.has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "Admin updates staff_suppliers" on public.staff_suppliers;
create policy "Admin updates staff_suppliers" on public.staff_suppliers for update to authenticated using (public.has_role(auth.uid(), 'admin'::app_role));
insert into public.staff_suppliers(id, name, delivery_weekday, count_weekday, sort_order) values
  ('frozen', 'קפואים', 2, 0, 1), ('drinks', 'שתייה', null, null, 2), ('takeaway', 'טייק אווי', null, null, 3)
on conflict (id) do nothing;

-- fill: complete to order_target packs (whole packs only);
-- below: order order_target packs when order_below units or fewer are left.
alter table public.staff_stock_items add column if not exists supplier text references public.staff_suppliers(id) on delete set null;
alter table public.staff_stock_items add column if not exists order_rule text check (order_rule in ('fill', 'below'));
alter table public.staff_stock_items add column if not exists order_target numeric;
alter table public.staff_stock_items add column if not exists order_below numeric;
alter table public.staff_stock_items add column if not exists order_optional boolean not null default false;
alter table public.staff_task_runs add column if not exists supplier text references public.staff_suppliers(id) on delete set null;

update public.staff_stock_items set name = 'סודה', pack_name = null, pack_size = null where name = 'פחית סודה';
update public.staff_stock_items set active = false
 where name in ('בירה לאף', 'בירה פאולנר', 'בירה סטלה', 'בירה מכבי 7.9%', 'בירה שפירא');
update public.staff_stock_items set pack_name = 'ארגז', pack_size = 4 where name like 'צ%יפס רגיל';
update public.staff_stock_items set supplier = 'frozen'
 where name like 'צ%יפס רגיל' or name like 'וופל צ%יפס' or name in ('טבעות בצל', 'טבעות בצל בטמפורה');
update public.staff_stock_items set supplier = 'drinks' where category = 'שתייה';
update public.staff_stock_items set supplier = 'takeaway' where coalesce(shop_category, category) = 'טייק אווי';

update public.staff_stock_items set order_rule = 'fill', order_target = 5 where name like 'צ%יפס רגיל';
update public.staff_stock_items set order_rule = 'below', order_below = 1, order_target = 1
 where name like 'וופל צ%יפס' or name in ('טבעות בצל', 'טבעות בצל בטמפורה');
update public.staff_stock_items i set order_rule = 'fill', order_target = v.t
  from (values ('פחית קולה', 9), ('פחית זירו', 9), ('פחית פאנטה', 3), ('פחית ספרייט', 2),
               ('פחית בלו מוחיטו', 1), ('פחית בלו אבטיח', 1), ('פחית בלו דיי', 1), ('פחית בלו מלון תפוח', 1),
               ('פחית פאנטה ענבים', 1), ('פחית פאנטה אקזוטי', 1), ('פחית פאנטה פירות יער', 1), ('פחית ספרייט זירו', 2),
               ('סודה', 2), ('בקבוק ענבים', 2), ('בקבוק תפוזים', 2), ('מים', 2),
               ('מים בטעם תפוח', 1), ('מים בטעם ענבים', 1), ('מים בטעם אפרסק', 1)) v(n, t)
 where i.name = v.n;
update public.staff_stock_items set order_optional = true where name = 'פחית פאנטה פירות יער';
update public.staff_stock_items set order_rule = 'below', order_below = 11, order_target = 1 where name = 'פחית בלו';
update public.staff_stock_items set order_rule = 'below', order_below = 2, order_target = 1
 where name in ('בירה קרלסברג', 'בירה גולדסטאר', 'בירה הייניקן', 'בירה קורונה', 'בירה הוגרדן', 'בירה גולדסטאר אנפילטר');

-- Sends a message once per (kind, key, person).
create or replace function public.staff_notify_once(p_kind text, p_key text, p_staff uuid[], p_title text, p_body text, p_url text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_ids uuid[];
begin
  with ins as (
    insert into public.staff_notification_log(kind, key, staff_id)
    select p_kind, p_key, x from unnest(p_staff) x on conflict do nothing returning staff_id
  ) select array_agg(staff_id) into v_ids from ins;
  if v_ids is null then return; end if;
  perform public.staff_send_messages((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('staff_id', x, 'tag', p_kind || '-' || p_key,
    'title', p_title, 'body', p_body, 'url', p_url))) from unnest(v_ids) x));
end $$;
revoke all on function public.staff_notify_once(text, text, uuid[], text, text, text) from public, anon, authenticated;

create or replace function public.staff_weekday_name(p_dow int)
returns text language sql immutable as $$
  select (array['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'])[p_dow + 1]
$$;

-- Tonight's tasks, with the products to count for count tasks.
create or replace function public.staff_tasks_json(p_date date)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'kind', r.kind, 'source', r.source,
      'at_opening', r.at_opening, 'done', r.done_at is not null,
      'items', case r.kind
        when 'supplier_count' then (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'unit', i.unit, 'step', i.step,
              'pack_name', i.pack_name, 'pack_size', i.pack_size) order by i.sort_order, i.name), '[]'::jsonb)
            from public.staff_stock_items i where i.active and not i.low_only and i.supplier = r.supplier)
        when 'count' then (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'unit', i.unit, 'step', i.step,
              'pack_name', i.pack_name, 'pack_size', i.pack_size)), '[]'::jsonb)
            from (select * from public.staff_stock_items where active and not low_only and category in ('קפואים', 'לחמניות')
                  order by md5(id::text || p_date::text) limit 4) i)
        end)
    order by r.done_at is not null, (r.kind = 'supplier_count') desc, r.at_opening desc, (r.source = 'idle') desc, r.created_at), '[]'::jsonb)
  from public.staff_task_runs r where r.shift_date = p_date
$$;
revoke all on function public.staff_tasks_json(date) from public, anon, authenticated;

create or replace function public.staff_tasks_ensure(p_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.staff_task_runs(shift_date, task_id, title, kind, source, at_opening)
  select p_date, t.id, t.title, t.kind, 'today', t.at_opening from public.staff_tasks t
  where t.active and (t.kind in ('closing', 'count') or t.weekday = extract(dow from p_date)::int)
  on conflict (shift_date, task_id) where task_id is not null do nothing;

  if not exists (select 1 from public.staff_task_runs where shift_date = p_date and kind = 'patties') then
    insert into public.staff_task_runs(shift_date, task_id, title, kind, source)
    values (p_date, null, public.staff_patty_text(p_date), 'patties', 'today');
  end if;

  insert into public.staff_task_runs(shift_date, task_id, title, kind, source, supplier)
  select p_date, null, 'ספירת ' || s.name || ' לספק' ||
         coalesce(' - אספקה ביום ' || public.staff_weekday_name(s.delivery_weekday), '') || ' (חובה לפני יציאה)',
         'supplier_count', 'today', s.id
  from public.staff_suppliers s
  where s.count_weekday = extract(dow from p_date)::int
    and not exists (select 1 from public.staff_task_runs x where x.shift_date = p_date and x.kind = 'supplier_count' and x.supplier = s.id);

  with old as (
    update public.staff_task_runs r set carried = true
    where r.shift_date < p_date and r.done_at is null and not r.carried and r.kind not in ('count', 'idle', 'patties', 'supplier_count')
      and not exists (select 1 from public.staff_task_runs x where x.shift_date = p_date and x.task_id = r.task_id)
    returning r.task_id, r.title, r.kind, r.at_opening
  )
  insert into public.staff_task_runs(shift_date, task_id, title, kind, source, at_opening)
  select p_date, task_id, title, kind, 'carry', at_opening from old
  on conflict (shift_date, task_id) where task_id is not null do nothing;
end $$;

create or replace function public.kitchen_tasks_today()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_shift public.staff_shifts; v_date date;
begin
  if not public.staff_caller_is_kitchen() then raise exception 'forbidden'; end if;
  v_shift := public.staff_current_shift();
  v_date := coalesce(v_shift.shift_date, (now() at time zone 'Asia/Jerusalem')::date);
  if v_shift.id is not null then perform public.staff_tasks_ensure(v_date); end if;
  return jsonb_build_object(
    'shift_date', v_date,
    'closing_nudge', v_shift.id is not null and exists (select 1 from public.staff_notification_log l where l.kind = 'closing' and l.key = v_shift.id::text),
    'tasks', public.staff_tasks_json(v_date),
    'count_items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'unit', i.unit, 'step', i.step)), '[]'::jsonb)
              from (select * from public.staff_stock_items
                    where active and not low_only and category in ('קפואים', 'לחמניות')
                    order by md5(id::text || v_date::text) limit 4) i));
end $$;

-- Records a count task (kitchen screen or the employee's phone).
create or replace function public.staff_record_count(p_run_id uuid, p_counts jsonb, p_staff uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c jsonb; v_item public.staff_stock_items; v_run public.staff_task_runs; v_sup public.staff_suppliers;
begin
  select * into v_run from public.staff_task_runs where id = p_run_id;
  if v_run.id is null or v_run.kind not in ('count', 'supplier_count') then raise exception 'not_found'; end if;
  for c in select * from jsonb_array_elements(coalesce(p_counts, '[]'::jsonb)) loop
    select * into v_item from public.staff_stock_items where id = (c->>'item_id')::uuid and active;
    continue when v_item.id is null or (c->>'quantity') is null or (c->>'quantity')::numeric not between 0 and 9999;
    insert into public.staff_stock_counts(item_id, quantity, staff_id) values (v_item.id, (c->>'quantity')::numeric, p_staff);
    perform public.staff_stock_to_inventory(v_item, (c->>'quantity')::numeric);
  end loop;
  update public.staff_task_runs set done_at = now(), done_by = p_staff where id = p_run_id and done_at is null;
  if v_run.kind = 'supplier_count' and v_run.done_at is null then
    select * into v_sup from public.staff_suppliers where id = v_run.supplier;
    perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'order-' || v_sup.id,
      'title', 'ההזמנה לספק ה' || v_sup.name || ' מוכנה',
      'body', 'הספירה הסתיימה. בודקים, מורידים מה שלא צריך ושולחים בוואטסאפ.',
      'url', '/admin/shifts#orders')), '[]'::jsonb) from public.staff_members o where o.is_owner and o.active));
  end if;
end $$;
revoke all on function public.staff_record_count(uuid, jsonb, uuid) from public, anon, authenticated;

create or replace function public.kitchen_task_count(p_run_id uuid, p_counts jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_who uuid;
begin
  if not public.staff_caller_is_kitchen() then raise exception 'forbidden'; end if;
  select e.staff_id into v_who from public.staff_time_entries e where e.clock_out is null order by e.clock_in limit 1;
  perform public.staff_record_count(p_run_id, p_counts, v_who);
end $$;
revoke all on function public.kitchen_task_count(uuid, jsonb) from public, anon;
grant execute on function public.kitchen_task_count(uuid, jsonb) to authenticated;

-- Employee's phone: tonight's tasks (only for whoever is on tonight's shift).
create or replace function public.staff_portal_on_shift(me public.staff_members, v_shift public.staff_shifts)
returns boolean language sql stable security definer set search_path = public as $$
  select v_shift.id is not null and (me.is_owner
    or exists (select 1 from public.staff_shift_assignments a where a.shift_id = v_shift.id and a.staff_id = me.id)
    or exists (select 1 from public.staff_time_entries e where e.staff_id = me.id and e.clock_out is null))
$$;
revoke all on function public.staff_portal_on_shift(public.staff_members, public.staff_shifts) from public, anon, authenticated;

create or replace function public.staff_portal_tasks(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me public.staff_members; v_shift public.staff_shifts;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  v_shift := public.staff_current_shift();
  if not public.staff_portal_on_shift(me, v_shift) then
    return jsonb_build_object('on_shift', false, 'tasks', '[]'::jsonb);
  end if;
  perform public.staff_tasks_ensure(v_shift.shift_date);
  return jsonb_build_object('on_shift', true, 'shift_date', v_shift.shift_date, 'tasks', public.staff_tasks_json(v_shift.shift_date));
end $$;

create or replace function public.staff_portal_task_set(p_token text, p_run_id uuid, p_done boolean, p_counts jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare me public.staff_members; v_shift public.staff_shifts; v_run public.staff_task_runs;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  v_shift := public.staff_current_shift();
  if not public.staff_portal_on_shift(me, v_shift) then raise exception 'no_shift'; end if;
  select * into v_run from public.staff_task_runs where id = p_run_id and shift_date = v_shift.shift_date;
  if v_run.id is null then raise exception 'not_found'; end if;
  if v_run.kind in ('count', 'supplier_count') then
    if not p_done then raise exception 'not_found'; end if;
    perform public.staff_record_count(p_run_id, p_counts, me.id);
  else
    update public.staff_task_runs set done_at = case when p_done then now() end, done_by = case when p_done then me.id end where id = p_run_id;
  end if;
end $$;
revoke all on function public.staff_portal_tasks(text) from public;
grant execute on function public.staff_portal_tasks(text) to anon, authenticated;
revoke all on function public.staff_portal_task_set(text, uuid, boolean, jsonb) from public;
grant execute on function public.staff_portal_task_set(text, uuid, boolean, jsonb) to anon, authenticated;

-- Clocking out needs tonight's supplier count (not for the owner).
create or replace function public.kitchen_staff_toggle(p_staff_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_open public.staff_time_entries;
  v_shift public.staff_shifts;
  v_member public.staff_members;
  v_need uuid;
begin
  if not (public.has_role(auth.uid(), 'kitchen'::app_role) or public.has_role(auth.uid(), 'admin'::app_role)) then
    raise exception 'forbidden';
  end if;
  select * into v_member from public.staff_members where id = p_staff_id and active;
  if v_member.id is null then raise exception 'not found'; end if;
  select * into v_open from public.staff_time_entries where staff_id = p_staff_id and clock_out is null;
  v_shift := public.staff_current_shift();
  if v_open.id is not null then
    if now() - v_open.clock_in < interval '1 minute' then
      return jsonb_build_object('state', 'in', 'since', v_open.clock_in);
    end if;
    if not v_member.is_owner and v_shift.id is not null then
      perform public.staff_tasks_ensure(v_shift.shift_date);
      select r.id into v_need from public.staff_task_runs r
       where r.shift_date = v_shift.shift_date and r.kind = 'supplier_count' and r.done_at is null limit 1;
      if v_need is not null then return jsonb_build_object('state', 'need_count', 'run_id', v_need); end if;
    end if;
    update public.staff_time_entries set clock_out = now() where id = v_open.id;
    return jsonb_build_object('state', 'out');
  end if;
  if not v_member.is_owner and v_shift.id is not null and now() < v_shift.starts_at - interval '10 minutes' then
    if not exists (select 1 from public.staff_early_requests where staff_id = p_staff_id and shift_id = v_shift.id and status = 'pending') then
      insert into public.staff_early_requests(staff_id, shift_id) values (p_staff_id, v_shift.id);
      perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'early-' || v_shift.id,
        'title', v_member.display_name || ' רוצה להיכנס מוקדם',
        'body', 'המשמרת מתחילה ב-' || to_char(v_shift.starts_at at time zone 'Asia/Jerusalem', 'HH24:MI') || '. מאשרים בדף הסידור.',
        'url', '/admin/shifts')), '[]'::jsonb) from public.staff_members o where o.is_owner and o.active));
    end if;
    return jsonb_build_object('state', 'pending');
  end if;
  update public.staff_early_requests set status = 'superseded', decided_at = now()
   where staff_id = p_staff_id and status = 'pending';
  insert into public.staff_time_entries(staff_id, shift_id) values (p_staff_id, v_shift.id);
  return jsonb_build_object('state', 'in', 'since', now());
end $$;

-- Reminders for a count night: at noon to tonight's team, then during the shift.
create or replace function public.staff_supplier_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_il timestamp := now() at time zone 'Asia/Jerusalem';
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_shift public.staff_shifts := public.staff_current_shift();
  s record; v_ids uuid[];
begin
  if v_il::time >= '12:00' and v_il::time < '18:00' then
    for s in select * from public.staff_suppliers where count_weekday = extract(dow from v_today)::int loop
      select array_agg(a.staff_id) into v_ids from public.staff_shifts sh
        join public.staff_shift_assignments a on a.shift_id = sh.id
        join public.staff_members m on m.id = a.staff_id and m.active and not m.is_owner
       where sh.shift_date = v_today;
      if v_ids is not null then
        perform public.staff_notify_once('supcount-noon', v_today::text || '-' || s.id, v_ids,
          'היום בערב: ספירת ' || s.name,
          'במשמרת צריך לספור ' || s.name || ' במשימות, כדי להזמין מהספק. בלי הספירה אי אפשר לצאת מהמשמרת.');
      end if;
    end loop;
  end if;
  if v_shift.id is null or now() < v_shift.starts_at + interval '30 minutes' then return; end if;
  select array_agg(e.staff_id) into v_ids from public.staff_time_entries e
    join public.staff_members m on m.id = e.staff_id and not m.is_owner where e.clock_out is null;
  if v_ids is null then return; end if;
  perform public.staff_tasks_ensure(v_shift.shift_date);
  for s in select su.id, su.name from public.staff_suppliers su
           join public.staff_task_runs r on r.supplier = su.id
           where r.kind = 'supplier_count' and r.shift_date = v_shift.shift_date and r.done_at is null loop
    perform public.staff_notify_once('supcount-in', v_shift.id::text || '-' || s.id, v_ids,
      'תזכורת: ספירת ' || s.name, 'כשיש רגע - סופרים ' || s.name || ' במשימות, בטלפון או במסך המטבח.');
    if v_il::time >= '22:30' or v_il::date > v_shift.shift_date then
      perform public.staff_notify_once('supcount-late', v_shift.id::text || '-' || s.id, v_ids,
        'עוד לא נספרו ' || s.name, 'בלי הספירה אי אפשר לצאת מהמשמרת. סופרים במשימות.');
    end if;
  end loop;
end $$;
revoke all on function public.staff_supplier_reminders() from public, anon, authenticated;

select cron.unschedule('staff-tasks-tick') where exists (select 1 from cron.job where jobname = 'staff-tasks-tick');
select cron.schedule('staff-tasks-tick', '* * * * *', $cron$ select public.staff_give_idle_task(); select public.staff_clockout_reminders(); select public.staff_closing_nudge(); select public.staff_supplier_reminders(); $cron$);
