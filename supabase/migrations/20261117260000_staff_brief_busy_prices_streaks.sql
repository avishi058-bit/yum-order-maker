-- 1. Receipt prices: each purchase keeps what was paid; the owner hears when
--    a product costs more than last time.
-- 2. Morning brief: yesterday in one push at 10:00, and in the owner's app.
-- 3. Busy alert: many open orders -> the kitchen is asked "need help?" and the
--    owner is told; "need help" asks the employees who are off shift, who answer
--    in their app.
-- 4. Encouragement after a shift with every task done, and for streaks.

-- 1. Prices
alter table public.staff_stock_purchases add column if not exists price numeric(10,2) check (price is null or price >= 0);

drop function if exists public.staff_stock_purchase(uuid, numeric, text);
create or replace function public.staff_stock_purchase(p_report_id uuid, p_qty numeric, p_source text default 'manual', p_price numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.staff_stock_reports; v_item public.staff_stock_items; v_have numeric; v_last numeric; v_unit numeric;
begin
  if not public.staff_caller_is_admin() then raise exception 'forbidden'; end if;
  select * into r from public.staff_stock_reports where id = p_report_id and resolved_at is null;
  if r.id is null then raise exception 'not_found'; end if;
  update public.staff_stock_reports set resolved_at = now() where id = r.id;
  if p_qty is null or p_qty <= 0 then return; end if;
  select * into v_item from public.staff_stock_items where id = r.item_id;
  -- Price per unit against the last known one.
  if p_price is not null and p_price > 0 then
    v_unit := p_price / p_qty;
    select p.price / p.quantity into v_last from public.staff_stock_purchases p
     where p.item_id = r.item_id and p.price is not null and p.quantity > 0 order by p.created_at desc limit 1;
  end if;
  insert into public.staff_stock_purchases(item_id, report_id, quantity, source, price)
  values (r.item_id, r.id, least(p_qty, 9999), case when p_source = 'receipt' then 'receipt' else 'manual' end, nullif(p_price, 0));
  if v_last is not null and v_unit > v_last * 1.05 then
    perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'price-' || r.item_id,
      'title', 'המחיר עלה: ' || v_item.name,
      'body', 'מ-' || round(v_last, 2) || ' ל-' || round(v_unit, 2) || ' ₪ ל' || case v_item.unit when 'יחידות' then 'יחידה' else v_item.unit end
              || ' (' || round((v_unit / v_last - 1) * 100) || '%)', 'url', '/admin/shifts')), '[]'::jsonb)
      from public.staff_members o where o.is_owner and o.active));
  end if;
  v_have := case r.level when 'out' then 0 when 'count' then r.quantity end;
  if v_have is not null then
    insert into public.staff_stock_counts(item_id, quantity, staff_id) values (r.item_id, v_have + p_qty, null);
    perform public.staff_stock_to_inventory(v_item, v_have + p_qty);
  elsif v_item.inventory_item_id is not null and (v_item.inventory_factor is not null or v_item.unit = 'יחידות') then
    update public.inventory_items set quantity = quantity + p_qty * coalesce(v_item.inventory_factor, 1) where id = v_item.inventory_item_id;
    insert into public.inventory_movements(inventory_item_id, delta, reason, note)
    values (v_item.inventory_item_id, p_qty * coalesce(v_item.inventory_factor, 1), 'staff_purchase', 'קנייה של אבישי');
  end if;
end $$;
revoke all on function public.staff_stock_purchase(uuid, numeric, text, numeric) from public, anon;
grant execute on function public.staff_stock_purchase(uuid, numeric, text, numeric) to authenticated;

-- 2. Yesterday
create or replace function public.staff_day_brief(p_date date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz := (p_date::timestamp + interval '6 hours') at time zone 'Asia/Jerusalem';
        v_to timestamptz := (p_date::timestamp + interval '30 hours') at time zone 'Asia/Jerusalem';
begin
  return jsonb_build_object(
    'date', p_date,
    'orders', (select count(*) from public.orders o where o.created_at >= v_from and o.created_at < v_to and o.status not in ('pending_payment', 'payment_failed', 'cancelled')),
    'revenue', (select coalesce(round(sum(o.total)), 0) from public.orders o where o.created_at >= v_from and o.created_at < v_to and o.status not in ('pending_payment', 'payment_failed', 'cancelled')),
    'patties', public.staff_day_sold(p_date, 'קציצה%'),
    'workers', (select coalesce(jsonb_agg(jsonb_build_object('name', split_part(m.display_name, ' ', 1), 'minutes',
                  round(extract(epoch from coalesce(e.clock_out, now()) - e.clock_in) / 60)) order by e.clock_in), '[]'::jsonb)
                from public.staff_time_entries e join public.staff_members m on m.id = e.staff_id and not m.is_owner
                where e.clock_in >= v_from and e.clock_in < v_to),
    'tasks_total', (select count(*) from public.staff_task_runs r where r.shift_date = p_date and not (r.source = 'idle' and r.done_at is null)),
    'tasks_done', (select count(*) from public.staff_task_runs r where r.shift_date = p_date and r.done_at is not null),
    'missing', (select coalesce(jsonb_agg(r.title order by (r.section is not null), r.sort_order), '[]'::jsonb) from public.staff_task_runs r
                where r.shift_date = p_date and r.done_at is null and r.source <> 'idle'),
    'waste', (select coalesce(jsonb_agg(jsonb_build_object('name', l.item_name, 'quantity', l.quantity, 'reason', l.reason)), '[]'::jsonb)
              from public.staff_waste_logs l where l.created_at >= v_from and l.created_at < v_to),
    'shopping', (select count(*) from public.staff_stock_reports r where r.resolved_at is null),
    'today', (select coalesce(string_agg(split_part(m.display_name, ' ', 1), ', '), 'אתה') from public.staff_shifts s
              join public.staff_shift_assignments a on a.shift_id = s.id join public.staff_members m on m.id = a.staff_id and not m.is_owner
              where s.shift_date = p_date + 1),
    'open_today', exists (select 1 from public.staff_shifts s where s.shift_date = p_date + 1
              and not exists (select 1 from public.staff_special_days d where d.day = s.shift_date and d.closed)));
end $$;
revoke all on function public.staff_day_brief(date) from public, anon, authenticated;

create or replace function public.staff_owner_brief(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_today date := (now() at time zone 'Asia/Jerusalem')::date; v_day date;
begin
  perform public.staff_owner_by_token(p_token);
  -- The last day that had a shift (yesterday, or before a closed day).
  select max(s.shift_date) into v_day from public.staff_shifts s where s.shift_date < v_today
    and not exists (select 1 from public.staff_special_days d where d.day = s.shift_date and d.closed);
  return public.staff_day_brief(coalesce(v_day, v_today - 1));
end $$;
grant execute on function public.staff_owner_brief(text) to anon, authenticated;

create or replace function public.staff_morning_brief()
returns void language plpgsql security definer set search_path = public as $$
declare v_il timestamp := now() at time zone 'Asia/Jerusalem'; b jsonb; v_owner uuid[]; v_body text;
begin
  if v_il::time < '10:00' or v_il::time > '13:00' then return; end if;
  select array_agg(id) into v_owner from public.staff_members where is_owner and active;
  if v_owner is null then return; end if;
  b := public.staff_day_brief(v_il::date - 1);
  if (b->>'orders')::int = 0 and (b->>'tasks_total')::int = 0 then return; end if;
  v_body := (b->>'orders') || ' הזמנות · ' || (b->>'revenue') || ' ₪'
    || case when (b->>'tasks_total')::int > 0 then ' · משימות ' || (b->>'tasks_done') || '/' || (b->>'tasks_total') else '' end
    || case when jsonb_array_length(b->'waste') > 0 then ' · פחת ' || jsonb_array_length(b->'waste') else '' end
    || case when (b->>'shopping')::int > 0 then ' · לקנות ' || (b->>'shopping') else '' end
    || case when (b->>'open_today')::boolean then ' · היום: ' || (b->>'today') else '' end;
  perform public.staff_notify_once('brief', v_il::date::text, v_owner, 'אתמול בבקתה', v_body, '/staff/');
end $$;
revoke all on function public.staff_morning_brief() from public, anon, authenticated;

-- 3. Busy alert and help
create table if not exists public.staff_busy_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  open_orders int not null,
  help_asked_at timestamptz,
  dismissed_at timestamptz
);
create table if not exists public.staff_help_answers (
  event_id uuid not null references public.staff_busy_events(id) on delete cascade,
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  coming boolean not null,
  answered_at timestamptz not null default now(),
  primary key (event_id, staff_id)
);
alter table public.staff_busy_events enable row level security;
alter table public.staff_help_answers enable row level security;
revoke all on public.staff_busy_events, public.staff_help_answers from anon;

-- Busy = 6 or more orders waiting or being made. Once an hour at most.
create or replace function public.staff_busy_check()
returns void language plpgsql security definer set search_path = public as $$
declare v_open int; v_shift public.staff_shifts := public.staff_current_shift(); v_ev uuid;
begin
  if v_shift.id is null then return; end if;
  select count(*) into v_open from public.orders o where o.status in ('new', 'preparing');
  if v_open < 6 then return; end if;
  if exists (select 1 from public.staff_busy_events e where e.created_at > now() - interval '60 minutes') then return; end if;
  insert into public.staff_busy_events(open_orders) values (v_open) returning id into v_ev;
  perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'busy-' || v_ev,
    'title', 'עומס בבקתה', 'body', v_open || ' הזמנות פתוחות. במסך המטבח שואלים אם צריך עזרה.', 'url', '/staff/')), '[]'::jsonb)
    from public.staff_members o where o.is_owner and o.active));
end $$;
revoke all on function public.staff_busy_check() from public, anon, authenticated;

-- Kitchen: the open busy event (last 45 minutes) with the answers.
create or replace function public.kitchen_busy_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e public.staff_busy_events;
begin
  if not public.staff_caller_is_kitchen() then raise exception 'forbidden'; end if;
  select * into e from public.staff_busy_events where created_at > now() - interval '45 minutes' and dismissed_at is null
   order by created_at desc limit 1;
  if e.id is null then return null; end if;
  return jsonb_build_object('id', e.id, 'open_orders', e.open_orders, 'help_asked', e.help_asked_at is not null,
    'answers', (select coalesce(jsonb_agg(jsonb_build_object('name', split_part(m.display_name, ' ', 1), 'coming', a.coming) order by a.answered_at), '[]'::jsonb)
                from public.staff_help_answers a join public.staff_members m on m.id = a.staff_id where a.event_id = e.id));
end $$;

create or replace function public.kitchen_busy_answer(p_event_id uuid, p_need_help boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_ids uuid[];
begin
  if not public.staff_caller_is_kitchen() then raise exception 'forbidden'; end if;
  if not p_need_help then
    update public.staff_busy_events set dismissed_at = now() where id = p_event_id;
    return;
  end if;
  update public.staff_busy_events set help_asked_at = now() where id = p_event_id and help_asked_at is null;
  if not found then return; end if;
  -- Everyone not on shift now (the owner too).
  select array_agg(m.id) into v_ids from public.staff_members m
   where m.active and not exists (select 1 from public.staff_time_entries e where e.staff_id = m.id and e.clock_out is null);
  if v_ids is null then return; end if;
  perform public.staff_send_messages((select jsonb_agg(jsonb_build_object('staff_id', x, 'tag', 'help-' || p_event_id,
    'title', 'צריך עזרה בבקתה', 'body', 'יש עומס. יכול/ה להגיע? עונים באפליקציה.', 'url', '/staff/')) from unnest(v_ids) x));
end $$;
revoke all on function public.kitchen_busy_status(), public.kitchen_busy_answer(uuid, boolean) from public, anon;
grant execute on function public.kitchen_busy_status(), public.kitchen_busy_answer(uuid, boolean) to authenticated;

-- Staff app: an open help request (last 60 minutes) and my answer.
create or replace function public.staff_portal_help(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me public.staff_members; e public.staff_busy_events;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  select * into e from public.staff_busy_events where help_asked_at > now() - interval '60 minutes' and dismissed_at is null
   order by help_asked_at desc limit 1;
  if e.id is null or exists (select 1 from public.staff_time_entries t where t.staff_id = me.id and t.clock_out is null) then return null; end if;
  return jsonb_build_object('id', e.id, 'asked_at', e.help_asked_at,
    'my_answer', (select a.coming from public.staff_help_answers a where a.event_id = e.id and a.staff_id = me.id),
    'answers', (select coalesce(jsonb_agg(jsonb_build_object('name', split_part(m.display_name, ' ', 1), 'coming', a.coming)), '[]'::jsonb)
                from public.staff_help_answers a join public.staff_members m on m.id = a.staff_id where a.event_id = e.id));
end $$;

create or replace function public.staff_portal_help_answer(p_token text, p_event_id uuid, p_coming boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me public.staff_members;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  if not exists (select 1 from public.staff_busy_events where id = p_event_id and help_asked_at > now() - interval '60 minutes') then raise exception 'not_found'; end if;
  insert into public.staff_help_answers(event_id, staff_id, coming) values (p_event_id, me.id, p_coming)
  on conflict (event_id, staff_id) do update set coming = excluded.coming, answered_at = now();
  -- The owner and whoever is on shift hear the answer.
  perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', m.id, 'tag', 'help-answer-' || p_event_id || '-' || me.id,
    'title', split_part(me.display_name, ' ', 1) || case when p_coming then ' מגיע/ה לעזור ✓' else ' לא יכול/ה להגיע' end,
    'body', 'תשובה לבקשת העזרה', 'url', '/staff/')), '[]'::jsonb)
    from public.staff_members m where m.active and m.id <> me.id
      and (m.is_owner or exists (select 1 from public.staff_time_entries t where t.staff_id = m.id and t.clock_out is null))));
end $$;
revoke all on function public.staff_portal_help(text), public.staff_portal_help_answer(text, uuid, boolean) from public;
grant execute on function public.staff_portal_help(text), public.staff_portal_help_answer(text, uuid, boolean) to anon, authenticated;

-- 4. Encouragement: once the shift summary goes out, the employee gets a
-- thank-you when every task was done, with streaks (3, 5, 10...) called out,
-- and on-time streaks.
create or replace function public.staff_encouragements()
returns void language plpgsql security definer set search_path = public as $$
declare e record; v_date date; v_streak int; v_ontime int; v_title text; v_body text; d record;
begin
  for e in select t.*, m.display_name from public.staff_time_entries t join public.staff_members m on m.id = t.staff_id and not m.is_owner
           where t.clock_out between now() - interval '3 hours' and now() - interval '21 minutes'
             and not exists (select 1 from public.staff_notification_log l where l.kind = 'cheer' and l.key = t.id::text) loop
    -- Consecutive shifts (newest first) with every task done.
    v_streak := 0;
    for d in select distinct coalesce(s.shift_date, ((x.clock_in at time zone 'Asia/Jerusalem') - interval '4 hours')::date) as day
             from public.staff_time_entries x left join public.staff_shifts s on s.id = x.shift_id
             where x.staff_id = e.staff_id and x.clock_out is not null and x.clock_out <= e.clock_out
             order by 1 desc limit 30 loop
      exit when not exists (select 1 from public.staff_task_runs r where r.shift_date = d.day)
             or exists (select 1 from public.staff_task_runs r where r.shift_date = d.day and r.done_at is null and r.source <> 'idle');
      v_streak := v_streak + 1;
    end loop;
    -- Consecutive shifts arriving on time (within 5 minutes of the start).
    v_ontime := 0;
    for d in select x.clock_in, s.starts_at from public.staff_time_entries x join public.staff_shifts s on s.id = x.shift_id
             where x.staff_id = e.staff_id and x.clock_in <= e.clock_in order by x.clock_in desc limit 30 loop
      exit when d.clock_in > d.starts_at + interval '5 minutes';
      v_ontime := v_ontime + 1;
    end loop;
    v_title := null;
    if v_streak >= 1 then
      v_title := case when v_streak in (3, 5, 10, 15, 20, 30) then v_streak || ' משמרות ברצף בלי לפספס משימה 🔥'
                      else 'כל המשימות בוצעו - כל הכבוד!' end;
      v_body := case when v_ontime in (5, 10, 20) then 'וגם ' || v_ontime || ' משמרות ברצף שהגעת בזמן ⏰' else 'תודה על משמרת מעולה 🍔' end;
    elsif v_ontime in (5, 10, 20) then
      v_title := v_ontime || ' משמרות ברצף שהגעת בזמן ⏰';
      v_body := 'תודה, זה עושה הבדל.';
    end if;
    if v_title is null then
      insert into public.staff_notification_log(kind, key, staff_id) values ('cheer', e.id::text, e.staff_id) on conflict do nothing;
      continue;
    end if;
    perform public.staff_notify_once('cheer', e.id::text, array[e.staff_id], v_title, v_body, '/staff/');
  end loop;
end $$;
revoke all on function public.staff_encouragements() from public, anon, authenticated;

select cron.unschedule('staff-tasks-tick') where exists (select 1 from cron.job where jobname = 'staff-tasks-tick');
select cron.schedule('staff-tasks-tick', '* * * * *', $cron$ select public.staff_give_idle_task(); select public.staff_clockout_reminders(); select public.staff_closing_nudge(); select public.staff_supplier_reminders(); select public.staff_owner_order_reminders(); select public.staff_shift_summaries(); select public.staff_submission_reminders(); select public.staff_morning_brief(); select public.staff_busy_check(); select public.staff_encouragements(); $cron$);

-- 5. "להכין בצל מטוגן" ticked = fried onion is available again on the menu.
create or replace function public.staff_prep_done()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.done_at is not null and old.done_at is null and new.kind = 'prep' and new.title = 'להכין בצל מטוגן' then
    update public.menu_availability set available = true where item_id = 'fried-onion' and available is false;
  end if;
  return new;
end $$;
drop trigger if exists staff_prep_done on public.staff_task_runs;
create trigger staff_prep_done after update of done_at on public.staff_task_runs
  for each row when (new.kind = 'prep') execute function public.staff_prep_done();
