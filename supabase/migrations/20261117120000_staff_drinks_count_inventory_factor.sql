-- Drinks: delivery Tuesday, count Sunday night - but only when an important
-- drink is already short, or the stock left (after orders) will not last until
-- the following delivery. Only the frozen count is required before leaving.
-- Bags/packs counted by staff now update the site's gram/unit inventory.
alter table public.staff_suppliers add column if not exists count_required boolean not null default false;
alter table public.staff_suppliers add column if not exists count_when_needed boolean not null default false;
update public.staff_suppliers set count_required = true where id = 'frozen';
update public.staff_suppliers set delivery_weekday = 2, count_weekday = 0, count_when_needed = true where id = 'drinks';

update public.staff_stock_items set pack_name = 'ארגז', pack_size = 24
 where name in ('סודה', 'בקבוק ענבים', 'בקבוק תפוזים', 'מים בטעם תפוח', 'מים בטעם ענבים', 'מים בטעם אפרסק');
update public.staff_stock_items set pack_name = 'ארגז', pack_size = 4 where name like 'וופל צ%יפס';
update public.staff_stock_items set pack_name = 'ארגז', pack_size = 5 where name = 'טבעות בצל';

-- How many site-inventory units one counted unit is (a fries bag = 2,500 g).
alter table public.staff_stock_items add column if not exists inventory_factor numeric;
update public.staff_stock_items set inventory_factor = 2500 where name like 'צ%יפס רגיל' or name like 'וופל צ%יפס';
update public.staff_stock_items set inventory_factor = 2000 where name = 'טבעות בצל';
-- A 13.3 kg bag of 200 g patties.
update public.staff_stock_items s set inventory_item_id = i.id, inventory_factor = 66
  from public.inventory_items i where s.name = 'קציצה' and i.name like 'קציצה%' and s.active;

create or replace function public.staff_stock_to_inventory(p_item public.staff_stock_items, p_qty numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_old numeric; v_unit text; v_new numeric;
begin
  if p_item.inventory_item_id is null then return; end if;
  select quantity, unit into v_old, v_unit from public.inventory_items where id = p_item.inventory_item_id;
  if p_item.inventory_factor is not null then
    v_new := round(p_qty * p_item.inventory_factor);
  elsif p_item.unit = 'יחידות' and v_unit = 'unit' then
    v_new := p_qty;
  else
    return;
  end if;
  if v_old = v_new then return; end if;
  perform public.inventory_set_quantity(p_item.inventory_item_id, v_new);
  insert into public.inventory_movements(inventory_item_id, delta, reason, note)
  values (p_item.inventory_item_id, v_new - v_old, 'staff_count', 'ספירה של עובד');
end $$;

-- Is a count needed for this supplier now? (always, unless count_when_needed)
create or replace function public.staff_supplier_needs_count(p_supplier text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare s public.staff_suppliers;
begin
  select * into s from public.staff_suppliers where id = p_supplier;
  if s.id is null then return false; end if;
  if not s.count_when_needed then return true; end if;
  return exists (
    select 1 from public.staff_stock_items i
    left join public.staff_stock_reports r on r.item_id = i.id and r.resolved_at is null
    left join public.inventory_items v on v.id = i.inventory_item_id
    left join lateral (
      select coalesce(-sum(m.delta), 0) / 28.0 as per_day from public.inventory_movements m
      where m.inventory_item_id = i.inventory_item_id and m.order_id is not null and m.created_at > now() - interval '28 days'
    ) u on true
    where i.active and i.supplier = p_supplier and i.order_rule is not null and not i.order_optional
      and (r.level in ('out', 'low')
           -- left after 9 days of sales (until the delivery after this one)
           or (v.id is not null and v.quantity - 9 * u.per_day <= case when i.order_rule = 'below' then i.order_below else coalesce(i.pack_size, 1) end)));
end $$;
revoke all on function public.staff_supplier_needs_count(text) from public, anon, authenticated;

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
         coalesce(' - אספקה ביום ' || public.staff_weekday_name(s.delivery_weekday), '') ||
         case when s.count_required then ' (חובה לפני יציאה)' else '' end,
         'supplier_count', 'today', s.id
  from public.staff_suppliers s
  where s.count_weekday = extract(dow from p_date)::int
    and not exists (select 1 from public.staff_task_runs x where x.shift_date = p_date and x.kind = 'supplier_count' and x.supplier = s.id)
    and public.staff_supplier_needs_count(s.id);

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

-- Only required counts block leaving.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.kitchen_staff_toggle(uuid)'::regprocedure);
  n := replace(d, 'where r.shift_date = v_shift.shift_date and r.kind = ''supplier_count'' and r.done_at is null limit 1;',
    'where r.shift_date = v_shift.shift_date and r.kind = ''supplier_count'' and r.done_at is null
         and exists (select 1 from public.staff_suppliers su where su.id = r.supplier and su.count_required) limit 1;');
  if n = d and position('count_required' in d) = 0 then raise exception 'kitchen_staff_toggle patch failed'; end if;
  if n <> d then execute n; end if;
end $$;

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
      continue when not public.staff_supplier_needs_count(s.id);
      select array_agg(a.staff_id) into v_ids from public.staff_shifts sh
        join public.staff_shift_assignments a on a.shift_id = sh.id
        join public.staff_members m on m.id = a.staff_id and m.active and not m.is_owner
       where sh.shift_date = v_today;
      if v_ids is not null then
        perform public.staff_notify_once('supcount-noon', v_today::text || '-' || s.id, v_ids,
          'היום בערב: ספירת ' || s.name,
          'במשמרת צריך לספור ' || s.name || ' במשימות, כדי להזמין מהספק.' ||
          case when s.count_required then ' בלי הספירה אי אפשר לצאת מהמשמרת.' else '' end);
      end if;
    end loop;
  end if;
  if v_shift.id is null or now() < v_shift.starts_at + interval '30 minutes' then return; end if;
  select array_agg(e.staff_id) into v_ids from public.staff_time_entries e
    join public.staff_members m on m.id = e.staff_id and not m.is_owner where e.clock_out is null;
  if v_ids is null then return; end if;
  perform public.staff_tasks_ensure(v_shift.shift_date);
  for s in select su.id, su.name, su.count_required from public.staff_suppliers su
           join public.staff_task_runs r on r.supplier = su.id
           where r.kind = 'supplier_count' and r.shift_date = v_shift.shift_date and r.done_at is null loop
    perform public.staff_notify_once('supcount-in', v_shift.id::text || '-' || s.id, v_ids,
      'תזכורת: ספירת ' || s.name, 'כשיש רגע - סופרים ' || s.name || ' במשימות, בטלפון או במסך המטבח.');
    if v_il::time >= '22:30' or v_il::date > v_shift.shift_date then
      perform public.staff_notify_once('supcount-late', v_shift.id::text || '-' || s.id, v_ids,
        'עוד לא נספרו ' || s.name,
        case when s.count_required then 'בלי הספירה אי אפשר לצאת מהמשמרת. ' else '' end || 'סופרים במשימות.');
    end if;
  end loop;
end $$;
