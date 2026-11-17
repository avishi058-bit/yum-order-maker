-- Short task names, and the owner's new structure:
-- * "משימות השבוע": cleaning/refill tasks done once or twice a week, spread over
--   the employees' shifts (not the owner's), at most 3 new ones a shift, the
--   longest-waiting first. Undone ones move to the next employee shift.
--   Sauces also when a shift sold over 40 patties; deck and squeezers can also
--   come as quiet-time tasks.
-- * Closing: drinks refill every other day, or when over 20 cans were sold.
--   Patties and buns to thaw: up to 40 (Thursday 70).
alter table public.staff_tasks drop constraint if exists staff_tasks_kind_check;
alter table public.staff_tasks add constraint staff_tasks_kind_check check (kind in ('closing', 'weekly', 'count', 'idle', 'rotating'));
alter table public.staff_tasks add column if not exists per_week int check (per_week between 1 and 7);
alter table public.staff_tasks add column if not exists rule text check (rule in ('alt_day_or_cans_20', 'or_burgers_40'));
alter table public.staff_tasks add column if not exists idle_ok boolean not null default false;
alter table public.staff_tasks add column if not exists action text;
alter table public.staff_task_runs add column if not exists action text;

-- Retire the previous closing list and the idle/weekly names that change.
update public.staff_tasks set active = false where active and kind = 'closing';
update public.staff_tasks set title = v.n, section = 'משימות השבוע', sort_order = v.o
  from (values ('מסיר שומנים על הפלאנצ׳ה', 'מסיר שומנים לפלנצ׳ה', 40), ('לנקות לכלוך מתחתית הצ׳יפסר', 'תחתית הצ׳יפסר', 41),
               ('לנקות מקררים - דלתות ומדפים', 'לנקות מקררים', 42)) v(o_title, n, o)
 where active and kind = 'weekly' and title = v.o_title;
update public.staff_tasks set title = v.n
  from (values ('להוציא את כל הירקות ממגירת הירקות ולהחזיר מסודר', 'לסדר מגירת ירקות'), ('למלא סיכות במהדק', 'סיכות במהדק'),
               ('מילוי רטבים לטייק אווי', 'רטבים לטייק אווי')) v(o_title, n)
 where active and kind = 'idle' and title = v.o_title;

insert into public.staff_tasks(title, kind, section, sort_order, per_week, rule, idle_ok, action)
select v.t, v.k, v.s, v.o, v.pw, v.r, v.i, v.a from (values
  ('לטאטא דק', 'rotating', 'משימות השבוע', 50, 2, null, true, null),
  ('לנקות חלונות', 'rotating', 'משימות השבוע', 51, 1, null, false, null),
  ('לנקות סקוויזרים', 'rotating', 'משימות השבוע', 52, 1, null, true, null),
  ('לנקות קיר נירוסטה', 'rotating', 'משימות השבוע', 53, 1, null, false, null),
  ('לנקות קירות קטנים בפלנצ׳ה', 'rotating', 'משימות השבוע', 54, 1, null, false, null),
  ('למלא טייק אווי', 'rotating', 'משימות השבוע', 55, 1, null, false, null),
  ('מילוי רטבים', 'rotating', 'משימות השבוע', 56, 2, 'or_burgers_40', false, null),
  ('למלא קוקוטים - שזיפים וצ׳ילי', 'rotating', 'משימות השבוע', 57, 1, null, false, null),
  ('למלא מיונז וקטשופ', 'rotating', 'משימות השבוע', 58, 1, null, false, null),
  ('לנקות שולחנות בחוץ', 'closing', 'קידום סגירה', 101, null, null, false, null),
  ('לספור מלאי ירקות ולעדכן', 'closing', 'קידום סגירה', 102, null, null, false, 'stock:ירקות'),
  ('למלא שתייה', 'closing', 'סדר סגירה', 201, null, 'alt_day_or_cans_20', false, null),
  ('לעדכן חוסרים', 'closing', 'סדר סגירה', 204, null, null, false, 'stock'),
  ('להכניס ירקות ורטבים למקרר', 'closing', 'סדר סגירה', 205, null, null, false, null),
  ('סגירת קופה', 'closing', 'סדר סגירה', 206, null, null, false, null),
  ('לנקות את השולחן', 'closing', 'סדר סגירה', 207, null, null, false, null),
  ('להטעין בוקסה וטאבלט', 'closing', 'סדר סגירה', 208, null, null, false, null),
  ('לאסוף את כל הכלים', 'closing', 'סדר סגירה', 209, null, null, false, null),
  ('לשטוף כלים', 'closing', 'סדר סגירה', 210, null, null, false, null),
  ('כלים לייבוש', 'closing', 'סדר סגירה', 211, null, null, false, null),
  ('לוודא שהפלנצ׳ה והצ׳יפסר כבויים', 'closing', 'סדר סגירה', 212, null, null, false, null),
  ('לכבות אורות בבקתה - בפנים ובחוץ', 'closing', 'סדר סגירה', 213, null, null, false, null),
  ('לכבות אורות בשירותים ובמחסנים', 'closing', 'סדר סגירה', 214, null, null, false, null),
  ('לנעול שירותים ולסגור מחסנים', 'closing', 'סדר סגירה', 215, null, null, false, null)
) v(t, k, s, o, pw, r, i, a)
where not exists (select 1 from public.staff_tasks x where x.active and x.title = v.t and x.kind = v.k);

-- A shift with an employee on it (not only the owner).
create or replace function public.staff_is_employee_day(p_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_shifts s
    join public.staff_shift_assignments a on a.shift_id = s.id
    join public.staff_members m on m.id = a.staff_id and not m.is_owner
    where s.shift_date = p_date)
$$;

-- How many units of an inventory product (name pattern) orders used on a business day.
create or replace function public.staff_day_sold(p_date date, p_pattern text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(-m.delta), 0) from public.inventory_movements m
  join public.inventory_items i on i.id = m.inventory_item_id
  where i.name like p_pattern and m.reason = 'order_ready'
    and m.created_at >= (p_date::timestamp + interval '6 hours') at time zone 'Asia/Jerusalem'
    and m.created_at < (p_date::timestamp + interval '30 hours') at time zone 'Asia/Jerusalem'
$$;

-- "קציצות להפשרה - עד 40" (Thursday 70; ask the owner before a long break).
create or replace function public.staff_thaw_text(p_date date, p_what text)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_hours jsonb; d int; v_day date; v_sp public.staff_special_days; v_open boolean;
begin
  select business_hours into v_hours from public.site_settings order by created_at limit 1;
  for d in 1..7 loop
    v_day := p_date + d;
    select * into v_sp from public.staff_special_days where day = v_day;
    v_open := coalesce((v_hours -> (extract(dow from v_day)::int)::text ->> 'open')::boolean, false) and v_sp.closed is not true;
    if v_open then
      if d > 2 then return p_what || ' להפשרה - לבדוק עם אבישי כמה'; end if;
      return p_what || ' להפשרה - עד ' || case when extract(dow from p_date) = 4 then 70 else 40 end;
    end if;
  end loop;
  return p_what || ' להפשרה - לבדוק עם אבישי כמה';
end $$;
create or replace function public.staff_patty_text(p_date date)
returns text language sql stable security definer set search_path = public as $$
  select public.staff_thaw_text(p_date, 'קציצות')
$$;

create or replace function public.staff_tasks_ensure(p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare v_emp boolean := public.staff_is_employee_day(p_date);
begin
  -- Daily closing tasks, fixed weekly tasks, the short count.
  insert into public.staff_task_runs(shift_date, task_id, title, kind, source, at_opening, section, sort_order, action)
  select p_date, t.id, t.title, t.kind, 'today', t.at_opening, t.section, t.sort_order, t.action from public.staff_tasks t
  where t.active and t.rule is null and (t.kind in ('closing', 'count') or (t.kind = 'weekly' and t.weekday = extract(dow from p_date)::int))
  on conflict (shift_date, task_id) where task_id is not null do nothing;

  -- Drinks: every other day, or after a day with over 20 cans.
  insert into public.staff_task_runs(shift_date, task_id, title, kind, source, section, sort_order, action)
  select p_date, t.id, t.title, t.kind, 'today', t.section, t.sort_order, t.action from public.staff_tasks t
  where t.active and t.rule = 'alt_day_or_cans_20'
    and (coalesce((select max(r.shift_date) from public.staff_task_runs r where r.task_id = t.id and r.done_at is not null), p_date - 30) < p_date - 1
         or public.staff_day_sold(p_date, 'פחית%') > 20)
  on conflict (shift_date, task_id) where task_id is not null do nothing;

  -- Patties and buns to thaw for the next day.
  if not exists (select 1 from public.staff_task_runs where shift_date = p_date and kind = 'patties') then
    insert into public.staff_task_runs(shift_date, task_id, title, kind, source, section, sort_order)
    values (p_date, null, public.staff_thaw_text(p_date, 'קציצות'), 'patties', 'today', 'סדר סגירה', 202);
  end if;
  if not exists (select 1 from public.staff_task_runs where shift_date = p_date and kind = 'buns') then
    insert into public.staff_task_runs(shift_date, task_id, title, kind, source, section, sort_order)
    values (p_date, null, public.staff_thaw_text(p_date, 'לחמניות'), 'buns', 'today', 'סדר סגירה', 203);
  end if;

  -- Supplier counts.
  insert into public.staff_task_runs(shift_date, task_id, title, kind, source, supplier)
  select p_date, null, 'ספירת ' || s.name || ' לספק' ||
         coalesce(' - אספקה ביום ' || public.staff_weekday_name(s.delivery_weekday), '') ||
         case when s.count_required then ' (חובה לפני יציאה)' else '' end,
         'supplier_count', 'today', s.id
  from public.staff_suppliers s
  where s.count_weekday = extract(dow from p_date)::int
    and not exists (select 1 from public.staff_task_runs x where x.shift_date = p_date and x.kind = 'supplier_count' and x.supplier = s.id)
    and public.staff_supplier_needs_count(s.id);

  -- Undone weekly/rotating tasks move to the next shift (rotating ones only to an employee shift).
  with old as (
    update public.staff_task_runs r set carried = true
    where r.shift_date < p_date and r.done_at is null and not r.carried and r.kind in ('weekly', 'rotating')
      and (r.kind <> 'rotating' or v_emp)
      and not exists (select 1 from public.staff_task_runs x where x.shift_date = p_date and x.task_id = r.task_id)
    returning r.task_id, r.title, r.kind, r.at_opening, r.section, r.sort_order
  )
  insert into public.staff_task_runs(shift_date, task_id, title, kind, source, at_opening, section, sort_order)
  select p_date, task_id, title, kind, 'carry', at_opening, section, sort_order from old
  on conflict (shift_date, task_id) where task_id is not null do nothing;

  -- This shift's share of the week's tasks: up to 3, longest-waiting first.
  if v_emp then
    insert into public.staff_task_runs(shift_date, task_id, title, kind, source, section, sort_order)
    select p_date, c.id, c.title, 'rotating', 'today', c.section, c.sort_order from (
      select t.*, (p_date - coalesce((select max(r.shift_date) from public.staff_task_runs r
                    where (r.task_id = t.id or (r.title = t.title and r.kind = 'idle')) and r.done_at is not null), p_date - 30))::numeric
                  / (7.0 / t.per_week) as score
      from public.staff_tasks t
      where t.active and t.kind = 'rotating'
        and not exists (select 1 from public.staff_task_runs r where r.task_id = t.id and (r.shift_date = p_date or (r.done_at is null and not r.carried)))
    ) c
    where c.score >= 1
    order by c.score desc, c.sort_order
    limit greatest(0, 3 - (select count(*) from public.staff_task_runs x where x.shift_date = p_date and x.kind = 'rotating'))
    on conflict (shift_date, task_id) where task_id is not null do nothing;
  end if;

  -- Sauces again after a busy shift (over 40 patties).
  if public.staff_day_sold(p_date, 'קציצה%') > 40 then
    insert into public.staff_task_runs(shift_date, task_id, title, kind, source, section, sort_order)
    select p_date, t.id, t.title, 'rotating', 'today', t.section, t.sort_order from public.staff_tasks t
    where t.active and t.rule = 'or_burgers_40'
    on conflict (shift_date, task_id) where task_id is not null do nothing;
  end if;
end $$;

-- Tasks with their section and button (e.g. straight to the vegetable count).
create or replace function public.staff_tasks_json(p_date date)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'kind', r.kind, 'source', r.source,
      'at_opening', r.at_opening, 'done', r.done_at is not null, 'section', r.section, 'action', r.action,
      'items', case r.kind
        when 'supplier_count' then (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'unit', i.unit, 'step', i.step,
              'pack_name', i.pack_name, 'pack_size', i.pack_size) order by i.sort_order, i.name), '[]'::jsonb)
            from public.staff_stock_items i where i.active and not i.low_only and i.supplier = r.supplier)
        when 'count' then (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'unit', i.unit, 'step', i.step,
              'pack_name', i.pack_name, 'pack_size', i.pack_size)), '[]'::jsonb)
            from (select * from public.staff_stock_items where active and not low_only and category in ('קפואים', 'לחמניות')
                  order by md5(id::text || p_date::text) limit 4) i)
        end)
    order by (r.section is not null), (r.kind = 'supplier_count') desc, r.at_opening desc, (r.source = 'idle') desc,
             coalesce(r.sort_order, 0), r.created_at), '[]'::jsonb)
  from public.staff_task_runs r where r.shift_date = p_date
$$;

-- Quiet-time tasks: the idle list, then week tasks marked for quiet time
-- (deck, squeezers) when not done in the last 2 days - never twice a shift.
create or replace function public.staff_give_idle_task()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_shift public.staff_shifts := public.staff_current_shift();
  v_task public.staff_tasks;
  v_name text;
begin
  if v_shift.id is null or now() not between v_shift.starts_at + interval '10 minutes' and v_shift.ends_at then return; end if;
  select m.display_name into v_name from public.staff_time_entries e join public.staff_members m on m.id = e.staff_id
   where e.clock_out is null order by e.clock_in limit 1;
  if v_name is null then return; end if;
  if exists (select 1 from public.orders o where o.status in ('new', 'preparing')) then return; end if;
  if exists (select 1 from public.orders o where o.status not in ('pending_payment', 'payment_failed', 'cancelled') and o.created_at > now() - interval '10 minutes') then return; end if;
  if exists (select 1 from public.staff_task_runs r where r.shift_date = v_shift.shift_date and r.source = 'idle'
             and (r.done_at is null or r.created_at > now() - interval '20 minutes')) then return; end if;
  select t.* into v_task from public.staff_tasks t
   where t.active and (t.kind = 'idle' or (t.kind = 'rotating' and t.idle_ok
         and not exists (select 1 from public.staff_task_runs r where r.task_id = t.id and r.done_at > now() - interval '2 days')))
     and not exists (select 1 from public.staff_task_runs r where r.shift_date = v_shift.shift_date and (r.task_id = t.id or r.title = t.title))
   order by (t.kind = 'rotating'), (select max(r.done_at) from public.staff_task_runs r where r.task_id = t.id) nulls first, t.sort_order
   limit 1;
  if v_task.id is null then return; end if;
  insert into public.staff_task_runs(shift_date, task_id, title, kind, source, at_opening)
  values (v_shift.shift_date, v_task.id, v_task.title, 'idle', 'idle', false)
  on conflict (shift_date, task_id) where task_id is not null do nothing;
  perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'idle-' || v_task.id,
    'title', 'משימה לזמן שקט', 'body', v_name || ' קיבל/ה: ' || v_task.title, 'url', '/admin/shifts')), '[]'::jsonb)
    from public.staff_members o where o.is_owner and o.active));
end $$;

-- Tonight's open runs of the retired list make way for the new one.
delete from public.staff_task_runs r using public.staff_tasks t
 where r.task_id = t.id and not t.active and r.done_at is null and r.shift_date >= (now() at time zone 'Asia/Jerusalem')::date;
update public.staff_task_runs set title = public.staff_thaw_text(shift_date, 'קציצות'), sort_order = 202
 where kind = 'patties' and done_at is null and shift_date >= (now() at time zone 'Asia/Jerusalem')::date;
