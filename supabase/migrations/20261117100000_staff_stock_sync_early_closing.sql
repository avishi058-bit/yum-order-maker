-- 1. Counting in packs: eggs by tray of 12, cans by case of 24 (plus units).
-- 2. Staff counts update the site's inventory (same products, counted in units),
--    which orders already draw down.
-- 3. Turning onion / tomato / lettuce off in the kitchen marks it "ran out".
-- 4. Clocking in more than 10 minutes early waits for the owner's approval.
-- 5. After 22:00 and 15 quiet minutes: start closing (cans, patties for tomorrow).
alter table public.staff_stock_items add column if not exists pack_name text;
alter table public.staff_stock_items add column if not exists pack_size int check (pack_size is null or pack_size > 1);
alter table public.staff_stock_items add column if not exists inventory_item_id uuid references public.inventory_items(id) on delete set null;

update public.staff_stock_items set pack_name = 'תבנית', pack_size = 12 where name = 'ביצים';
update public.staff_stock_items set pack_name = 'ארגז', pack_size = 24 where name like 'פחית %';
update public.staff_stock_items s set inventory_item_id = i.id
  from public.inventory_items i where i.name = s.name and s.inventory_item_id is null;

create or replace function public.staff_stock_json()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'category', i.category,
           'unit', i.unit, 'step', i.step, 'low_only', i.low_only, 'pack_name', i.pack_name, 'pack_size', i.pack_size,
           'level', r.level, 'quantity', r.quantity) order by i.sort_order, i.name), '[]'::jsonb)
  from public.staff_stock_items i
  left join public.staff_stock_reports r on r.item_id = i.id and r.resolved_at is null
  where i.active
$$;

-- "נשארה חצי חבילה" / "נשארו 2 ארגזים ו-5 יחידות" ...
create or replace function public.staff_stock_amount_text(p_item public.staff_stock_items, p_qty numeric)
returns text language plpgsql immutable as $$
declare v_one text; v_n text; v_packs int; v_rem numeric;
begin
  if p_item.pack_size is not null and p_qty >= p_item.pack_size then
    v_packs := floor(p_qty / p_item.pack_size); v_rem := p_qty - v_packs * p_item.pack_size;
    return 'נשארו ' || case when v_packs = 1 then p_item.pack_name || ' אחד' else v_packs || ' ' || p_item.pack_name || (case p_item.pack_name when 'ארגז' then 'ים' when 'תבנית' then 'ות' else '' end) end
      || case when v_rem > 0 then ' ו-' || trim(trailing '.' from trim(trailing '0' from v_rem::text)) || ' יחידות' else '' end;
  end if;
  v_one := case p_item.unit when 'חבילות' then 'חבילה' when 'פחיות' then 'פחית' else 'יחידה' end;
  v_n := case when p_qty = trunc(p_qty) then trunc(p_qty)::text else trunc(p_qty)::text || '½' end;
  return case when p_qty = 0.5 then 'נשארה חצי ' || v_one
              when p_qty = 1 then 'נשארה ' || v_one || ' אחת'
              else 'נשארו ' || v_n || ' ' || p_item.unit end;
end $$;

-- A staff count sets the linked inventory item (only where both count units).
create or replace function public.staff_stock_to_inventory(p_item public.staff_stock_items, p_qty numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_old numeric; v_unit text;
begin
  if p_item.inventory_item_id is null or p_item.unit <> 'יחידות' then return; end if;
  select quantity, unit into v_old, v_unit from public.inventory_items where id = p_item.inventory_item_id;
  if v_unit is distinct from 'unit' or v_old = p_qty then return; end if;
  perform public.inventory_set_quantity(p_item.inventory_item_id, p_qty);
  insert into public.inventory_movements(inventory_item_id, delta, reason, note)
  values (p_item.inventory_item_id, p_qty - v_old, 'staff_count', 'ספירה של עובד');
end $$;

create or replace function public.staff_portal_stock_set(p_token text, p_item_id uuid, p_level text, p_qty numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare me public.staff_members; v_item public.staff_stock_items; v_what text;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  select * into v_item from public.staff_stock_items where id = p_item_id and active;
  if v_item.id is null then raise exception 'not_found'; end if;
  if p_level is null then
    update public.staff_stock_reports set resolved_at = now() where item_id = p_item_id and resolved_at is null;
    return;
  end if;
  if p_level not in ('out', 'low', 'count') then raise exception 'not_found'; end if;
  if v_item.low_only and p_level <> 'low' then raise exception 'not_found'; end if;
  if p_level = 'count' and (p_qty is null or p_qty < 0 or p_qty > 9999 or mod(p_qty, v_item.step) <> 0) then raise exception 'not_found'; end if;
  if p_level = 'count' and p_qty = 0 then p_level := 'out'; end if;
  insert into public.staff_stock_reports(item_id, level, quantity, staff_id)
  values (p_item_id, p_level, case when p_level = 'count' then p_qty end, me.id)
  on conflict (item_id) where resolved_at is null
  do update set level = excluded.level, quantity = excluded.quantity, staff_id = excluded.staff_id, created_at = now();
  if p_level in ('count', 'out') then perform public.staff_stock_to_inventory(v_item, coalesce(p_qty, 0)); end if;
  v_what := case p_level when 'out' then 'נגמר' when 'low' then 'נשאר קצת' else public.staff_stock_amount_text(v_item, p_qty) end;
  perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'stock-' || p_item_id,
    'title', v_what || ': ' || v_item.name,
    'body', 'דיווח של ' || me.display_name || ' · ' || v_item.category,
    'url', '/admin/shifts')), '[]'::jsonb) from public.staff_members o where o.is_owner and o.active and o.id <> me.id));
end $$;
revoke all on function public.staff_stock_amount_text(public.staff_stock_items, numeric) from public, anon;
revoke all on function public.staff_stock_to_inventory(public.staff_stock_items, numeric) from public, anon, authenticated;
revoke all on function public.staff_portal_stock_set(text, uuid, text, numeric) from public;
grant execute on function public.staff_portal_stock_set(text, uuid, text, numeric) to anon, authenticated;

-- Short stock count from the kitchen also updates inventory.
create or replace function public.kitchen_stock_count(p_counts jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_who uuid; c jsonb; v_item public.staff_stock_items;
begin
  if not public.staff_caller_is_kitchen() then raise exception 'forbidden'; end if;
  select e.staff_id into v_who from public.staff_time_entries e where e.clock_out is null order by e.clock_in limit 1;
  for c in select * from jsonb_array_elements(p_counts) loop
    select * into v_item from public.staff_stock_items where id = (c->>'item_id')::uuid;
    continue when v_item.id is null or (c->>'quantity')::numeric not between 0 and 9999;
    insert into public.staff_stock_counts(item_id, quantity, staff_id) values (v_item.id, (c->>'quantity')::numeric, v_who);
    perform public.staff_stock_to_inventory(v_item, (c->>'quantity')::numeric);
  end loop;
end $$;

-- Vegetables switched off in the kitchen = ran out.
create or replace function public.staff_stock_from_availability()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_item public.staff_stock_items;
begin
  if new.available is not false or old.available is false then return new; end if;
  select * into v_item from public.staff_stock_items where active and name = case new.item_id
    when 'onion' then 'בצל סגול' when 'tomato' then 'עגבניות' when 'lettuce' then 'חסה' end;
  if v_item.id is null then return new; end if;
  insert into public.staff_stock_reports(item_id, level, quantity, staff_id) values (v_item.id, 'out', null, null)
  on conflict (item_id) where resolved_at is null do update set level = 'out', quantity = null, created_at = now();
  perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'stock-' || v_item.id,
    'title', 'נגמר: ' || v_item.name, 'body', 'הורד מהזמינות במסך המטבח', 'url', '/admin/shifts')), '[]'::jsonb)
    from public.staff_members o where o.is_owner and o.active));
  return new;
end $$;
drop trigger if exists staff_stock_from_availability on public.menu_availability;
create trigger staff_stock_from_availability after update of available on public.menu_availability
  for each row when (new.item_id in ('onion', 'tomato', 'lettuce')) execute function public.staff_stock_from_availability();

-- Early clock-in requests.
create table if not exists public.staff_early_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  shift_id uuid references public.staff_shifts(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'superseded')),
  decided_at timestamptz
);
alter table public.staff_early_requests enable row level security;
revoke all on public.staff_early_requests from anon;
grant select on public.staff_early_requests to authenticated;
drop policy if exists "Admin reads staff_early_requests" on public.staff_early_requests;
create policy "Admin reads staff_early_requests" on public.staff_early_requests for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

create or replace function public.kitchen_staff_toggle(p_staff_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_open public.staff_time_entries;
  v_shift public.staff_shifts;
  v_member public.staff_members;
begin
  if not (public.has_role(auth.uid(), 'kitchen'::app_role) or public.has_role(auth.uid(), 'admin'::app_role)) then
    raise exception 'forbidden';
  end if;
  select * into v_member from public.staff_members where id = p_staff_id and active;
  if v_member.id is null then raise exception 'not found'; end if;
  select * into v_open from public.staff_time_entries where staff_id = p_staff_id and clock_out is null;
  if v_open.id is not null then
    if now() - v_open.clock_in < interval '1 minute' then
      return jsonb_build_object('state', 'in', 'since', v_open.clock_in);
    end if;
    update public.staff_time_entries set clock_out = now() where id = v_open.id;
    return jsonb_build_object('state', 'out');
  end if;
  v_shift := public.staff_current_shift();
  -- More than 10 minutes before the start: ask the owner first.
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

create or replace function public.staff_decide_early(p_request_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v public.staff_early_requests;
begin
  if not public.staff_caller_is_admin() then raise exception 'forbidden'; end if;
  select * into v from public.staff_early_requests where id = p_request_id and status = 'pending';
  if v.id is null then raise exception 'not_found'; end if;
  update public.staff_early_requests set status = case when p_approve then 'approved' else 'rejected' end, decided_at = now() where id = v.id;
  if p_approve and not exists (select 1 from public.staff_time_entries where staff_id = v.staff_id and clock_out is null) then
    insert into public.staff_time_entries(staff_id, shift_id, clock_in) values (v.staff_id, v.shift_id, v.requested_at);
  end if;
  perform public.staff_send_messages(jsonb_build_array(jsonb_build_object('staff_id', v.staff_id, 'tag', 'early-' || v.id,
    'title', case when p_approve then 'הכניסה המוקדמת אושרה' else 'הכניסה המוקדמת לא אושרה' end,
    'body', case when p_approve then 'נרשמת למשמרת מ-' || to_char(v.requested_at at time zone 'Asia/Jerusalem', 'HH24:MI') || '.'
                 else 'לוחצים "כניסה" שוב כשמגיע זמן המשמרת.' end)));
end $$;
revoke all on function public.staff_decide_early(uuid, boolean) from public, anon;
grant execute on function public.staff_decide_early(uuid, boolean) to authenticated;

-- Kitchen list: who has an early request waiting.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.kitchen_staff_today()'::regprocedure);
  if position('pending_early' in d) = 0 then
    n := replace(d, '''open_since'', (select e.clock_in from public.staff_time_entries e where e.staff_id = p.id and e.clock_out is null),',
      '''open_since'', (select e.clock_in from public.staff_time_entries e where e.staff_id = p.id and e.clock_out is null),
      ''pending_early'', exists (select 1 from public.staff_early_requests q where q.staff_id = p.id and q.status = ''pending''),');
    if n = d then raise exception 'kitchen_staff_today patch failed'; end if;
    execute n;
  end if;
end $$;

-- Patties to take out for the next working day.
create or replace function public.staff_patty_text(p_date date)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_hours jsonb; d int; v_day date; v_sp public.staff_special_days; v_open boolean;
begin
  select business_hours into v_hours from public.site_settings order by created_at limit 1;
  for d in 1..7 loop
    v_day := p_date + d;
    select * into v_sp from public.staff_special_days where day = v_day;
    v_open := coalesce((v_hours -> (extract(dow from v_day)::int)::text ->> 'open')::boolean, false) and v_sp.closed is not true;
    if v_open then
      if d > 2 then return 'לוודא עם אבישי כמה קציצות להוציא למחר'; end if;
      return 'להוציא קציצות ל' || case when d = 1 then 'מחר' else public.staff_day_label(v_day) end || ' - להשלים ל-' ||
             case when extract(dow from p_date) = 4 then 70 else 40 end || ' יחידות';
    end if;
  end loop;
  return 'לוודא עם אבישי כמה קציצות להוציא למחר';
end $$;
revoke all on function public.staff_patty_text(date) from public, anon, authenticated;

-- The patty task joins each shift's list (once per day).
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

  with old as (
    update public.staff_task_runs r set carried = true
    where r.shift_date < p_date and r.done_at is null and not r.carried and r.kind not in ('count', 'idle', 'patties')
      and not exists (select 1 from public.staff_task_runs x where x.shift_date = p_date and x.task_id = r.task_id)
    returning r.task_id, r.title, r.kind, r.at_opening
  )
  insert into public.staff_task_runs(shift_date, task_id, title, kind, source, at_opening)
  select p_date, task_id, title, kind, 'carry', at_opening from old
  on conflict (shift_date, task_id) where task_id is not null do nothing;
end $$;

-- After 22:00, 15 minutes without a new order and nothing open: start closing.
create or replace function public.staff_closing_nudge()
returns void language plpgsql security definer set search_path = public as $$
declare v_shift public.staff_shifts := public.staff_current_shift(); v_msgs jsonb;
begin
  if v_shift.id is null or now() < v_shift.starts_at or now() > v_shift.ends_at then return; end if;
  if (now() at time zone 'Asia/Jerusalem')::time < '22:00' and (now() at time zone 'Asia/Jerusalem')::date = v_shift.shift_date then return; end if;
  if exists (select 1 from public.staff_notification_log where kind = 'closing' and key = v_shift.id::text) then return; end if;
  if exists (select 1 from public.orders o where o.status in ('new', 'preparing')) then return; end if;
  if exists (select 1 from public.orders o where o.status not in ('pending_payment', 'payment_failed', 'cancelled') and o.created_at > now() - interval '15 minutes') then return; end if;
  select coalesce(jsonb_agg(jsonb_build_object('staff_id', e.staff_id, 'tag', 'closing-' || v_shift.id,
    'title', 'מתחילים לקדם סגירה',
    'body', 'למלא פחיות במקרר · ' || public.staff_patty_text(v_shift.shift_date) || ' · משימות סגירה במסך המטבח')), '[]'::jsonb)
    into v_msgs from public.staff_time_entries e where e.clock_out is null;
  if jsonb_array_length(v_msgs) = 0 then return; end if;
  insert into public.staff_notification_log(kind, key, staff_id)
  select 'closing', v_shift.id::text, (m->>'staff_id')::uuid from jsonb_array_elements(v_msgs) m on conflict do nothing;
  perform public.staff_send_messages(v_msgs);
end $$;
revoke all on function public.staff_closing_nudge() from public, anon, authenticated;

-- Kitchen tasks payload: closing banner flag.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.kitchen_tasks_today()'::regprocedure);
  if position('closing_nudge' in d) = 0 then
    n := replace(d, '''shift_date'', v_date,', '''shift_date'', v_date,
    ''closing_nudge'', exists (select 1 from public.staff_notification_log l where l.kind = ''closing'' and l.key = v_shift.id::text),');
    if n = d then raise exception 'kitchen_tasks_today patch failed'; end if;
    execute n;
  end if;
end $$;

select cron.unschedule('staff-tasks-tick') where exists (select 1 from cron.job where jobname = 'staff-tasks-tick');
select cron.schedule('staff-tasks-tick', '* * * * *', $cron$ select public.staff_give_idle_task(); select public.staff_clockout_reminders(); select public.staff_closing_nudge(); $cron$);
