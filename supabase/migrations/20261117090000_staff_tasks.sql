-- Shift tasks: a closing checklist every shift, weekly cleaning tasks on set
-- days, a short rotating stock count, and extra tasks handed out when the
-- kitchen has been quiet for 10 minutes. Unfinished tasks carry over to the
-- next shift. The kitchen screen shows and ticks them; clocking out asks
-- about anything left. Also: a reminder an hour after the shift ends.

create table if not exists public.staff_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 120),
  -- closing: every shift; weekly: on its weekday; count: short stock count;
  -- idle: only handed out when the kitchen is quiet.
  kind text not null check (kind in ('closing', 'weekly', 'count', 'idle')),
  weekday int check (weekday between 0 and 6),
  at_opening boolean not null default false,
  sort_order int not null default 0,
  active boolean not null default true,
  check (kind <> 'weekly' or weekday is not null)
);
create table if not exists public.staff_task_runs (
  id uuid primary key default gen_random_uuid(),
  shift_date date not null,
  task_id uuid references public.staff_tasks(id) on delete set null,
  title text not null,
  kind text not null,
  source text not null check (source in ('today', 'carry', 'idle')),
  at_opening boolean not null default false,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  done_by uuid references public.staff_members(id) on delete set null,
  carried boolean not null default false
);
create index if not exists staff_task_runs_date_idx on public.staff_task_runs(shift_date);
create unique index if not exists staff_task_runs_one_per_day on public.staff_task_runs(shift_date, task_id) where task_id is not null;
create table if not exists public.staff_stock_counts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.staff_stock_items(id) on delete cascade,
  quantity numeric(6,1) not null check (quantity between 0 and 999),
  staff_id uuid references public.staff_members(id) on delete set null,
  created_at timestamptz not null default now()
);
do $$
declare t text;
begin
  foreach t in array array['staff_tasks','staff_task_runs','staff_stock_counts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "Admin manages %s" on public.%I', t, t);
    execute format('create policy "Admin manages %s" on public.%I for all to authenticated using (public.has_role(auth.uid(), ''admin''::app_role)) with check (public.has_role(auth.uid(), ''admin''::app_role))', t, t);
  end loop;
end $$;

insert into public.staff_tasks(title, kind, weekday, at_opening, sort_order)
select v.* from (values
  ('ספירת מלאי קצרה', 'count', null::int, false, 0),
  ('מסיר שומנים על הפלאנצ׳ה', 'weekly', 0, false, 1),
  ('לנקות לכלוך מתחתית הצ׳יפסר', 'weekly', 1, true, 2),
  ('לנקות חלונות', 'weekly', 2, false, 3),
  ('לנקות מקררים - דלתות ומדפים', 'weekly', 3, false, 4),
  ('לטאטא את הדק בחוץ', 'weekly', 4, false, 5),
  ('להוציא את כל הירקות ממגירת הירקות ולהחזיר מסודר', 'idle', null, false, 10),
  ('טייק אווי - צ׳יפס והמבורגר', 'idle', null, false, 11),
  ('לסדר מחסן', 'idle', null, false, 12),
  ('לסדר בחוץ', 'idle', null, false, 13),
  ('לנקות את הדק', 'idle', null, false, 14),
  ('לנקות שולחנות', 'idle', null, false, 15),
  ('למלא רטבים', 'idle', null, false, 16),
  ('לטאטא בחוץ', 'idle', null, false, 17),
  ('למלא פחיות במקרר', 'idle', null, false, 18),
  ('מגבונים', 'idle', null, false, 19),
  ('לנקות חלונות', 'idle', null, false, 20),
  ('לחתוך ירקות', 'idle', null, false, 21),
  ('למלא סיכות במהדק', 'idle', null, false, 22),
  ('מילוי רטבים לטייק אווי', 'idle', null, false, 23)
) v(title, kind, weekday, at_opening, sort_order)
where not exists (select 1 from public.staff_tasks);

create or replace function public.staff_caller_is_kitchen()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.role() = 'service_role' or public.has_role(auth.uid(), 'kitchen'::app_role) or public.has_role(auth.uid(), 'admin'::app_role)
$$;

-- Today's runs: closing + count tasks, this weekday's weekly tasks, and
-- anything left from earlier shifts (moved here once).
create or replace function public.staff_tasks_ensure(p_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.staff_task_runs(shift_date, task_id, title, kind, source, at_opening)
  select p_date, t.id, t.title, t.kind, 'today', t.at_opening from public.staff_tasks t
  where t.active and (t.kind in ('closing', 'count') or t.weekday = extract(dow from p_date)::int)
  on conflict (shift_date, task_id) where task_id is not null do nothing;

  with old as (
    update public.staff_task_runs r set carried = true
    where r.shift_date < p_date and r.done_at is null and not r.carried and r.kind not in ('count', 'idle')
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
    'tasks', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'kind', r.kind, 'source', r.source,
                'at_opening', r.at_opening, 'done', r.done_at is not null)
              order by r.done_at is not null, r.at_opening desc, (r.source = 'idle') desc, r.created_at), '[]'::jsonb)
              from public.staff_task_runs r where r.shift_date = v_date),
    -- A different handful of frozen goods and rolls each day.
    'count_items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'unit', i.unit, 'step', i.step)), '[]'::jsonb)
              from (select * from public.staff_stock_items
                    where active and not low_only and category in ('קפואים', 'לחמניות')
                    order by md5(id::text || v_date::text) limit 4) i));
end $$;

create or replace function public.kitchen_task_set(p_run_id uuid, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_who uuid;
begin
  if not public.staff_caller_is_kitchen() then raise exception 'forbidden'; end if;
  select e.staff_id into v_who from public.staff_time_entries e where e.clock_out is null order by e.clock_in limit 1;
  update public.staff_task_runs set done_at = case when p_done then now() end, done_by = case when p_done then v_who end
  where id = p_run_id;
end $$;

create or replace function public.kitchen_stock_count(p_counts jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_who uuid;
begin
  if not public.staff_caller_is_kitchen() then raise exception 'forbidden'; end if;
  select e.staff_id into v_who from public.staff_time_entries e where e.clock_out is null order by e.clock_in limit 1;
  insert into public.staff_stock_counts(item_id, quantity, staff_id)
  select (c->>'item_id')::uuid, (c->>'quantity')::numeric, v_who
  from jsonb_array_elements(p_counts) c
  where (c->>'quantity')::numeric between 0 and 999
    and exists (select 1 from public.staff_stock_items i where i.id = (c->>'item_id')::uuid);
end $$;

-- Quiet kitchen: during a shift with someone clocked in, no order waiting or
-- being made and none placed for 10 minutes -> hand out one task: from the
-- quiet-time list (least recently done first, not given yet today), else a
-- weekly task not done yet this week. One open quiet-time task at a time.
create or replace function public.staff_give_idle_task()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_shift public.staff_shifts := public.staff_current_shift();
  v_week date;
  v_task public.staff_tasks;
  v_name text;
begin
  if v_shift.id is null or now() not between v_shift.starts_at + interval '10 minutes' and v_shift.ends_at then return; end if;
  select m.display_name into v_name from public.staff_time_entries e join public.staff_members m on m.id = e.staff_id
   where e.clock_out is null order by e.clock_in limit 1;
  if v_name is null then return; end if;
  if exists (select 1 from public.orders o where o.status in ('new', 'preparing')) then return; end if;
  if exists (select 1 from public.orders o where o.status <> 'pending_payment' and o.created_at > now() - interval '10 minutes') then return; end if;
  if exists (select 1 from public.staff_task_runs r where r.shift_date = v_shift.shift_date and r.source = 'idle'
             and (r.done_at is null or r.created_at > now() - interval '20 minutes')) then return; end if;
  v_week := v_shift.shift_date - extract(dow from v_shift.shift_date)::int;
  select t.* into v_task from public.staff_tasks t
   where t.active and t.kind = 'idle'
     and not exists (select 1 from public.staff_task_runs r where r.task_id = t.id and r.shift_date = v_shift.shift_date)
   order by (select max(r.done_at) from public.staff_task_runs r where r.task_id = t.id) nulls first, t.sort_order
   limit 1;
  if v_task.id is null then
    select t.* into v_task from public.staff_tasks t
     where t.active and t.kind = 'weekly'
       and not exists (select 1 from public.staff_task_runs r where r.task_id = t.id
                       and r.shift_date between v_week and v_week + 6 and (r.done_at is not null or r.shift_date = v_shift.shift_date))
     order by ((t.weekday - extract(dow from v_shift.shift_date)::int + 7) % 7), t.sort_order
     limit 1;
  end if;
  if v_task.id is null then return; end if;
  insert into public.staff_task_runs(shift_date, task_id, title, kind, source, at_opening)
  values (v_shift.shift_date, v_task.id, v_task.title, v_task.kind, 'idle', false)
  on conflict (shift_date, task_id) where task_id is not null do nothing;
  perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'idle-' || v_task.id,
    'title', 'משימה לזמן שקט', 'body', v_name || ' קיבל/ה: ' || v_task.title, 'url', '/admin/shifts')), '[]'::jsonb)
    from public.staff_members o where o.is_owner and o.active));
end $$;

-- Still clocked in an hour after the shift ended: remind once.
create or replace function public.staff_clockout_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_msgs jsonb := '[]'::jsonb;
begin
  for r in
    select e.staff_id, s.id as shift_id from public.staff_time_entries e join public.staff_shifts s on s.id = e.shift_id
    where e.clock_out is null and now() > s.ends_at + interval '60 minutes'
      and not exists (select 1 from public.staff_notification_log l where l.kind = 'clockout' and l.key = s.id::text and l.staff_id = e.staff_id)
  loop
    insert into public.staff_notification_log(kind, key, staff_id) values ('clockout', r.shift_id::text, r.staff_id);
    v_msgs := v_msgs || jsonb_build_object('staff_id', r.staff_id, 'tag', 'clockout-' || r.shift_id,
      'title', 'שכחת לצאת מהמשמרת?', 'body', 'אם סיימת, לוחצים "יציאה" במסך המטבח.');
  end loop;
  perform public.staff_send_messages(v_msgs);
end $$;

revoke all on function public.staff_caller_is_kitchen() from public, anon;
revoke all on function public.staff_tasks_ensure(date) from public, anon, authenticated;
revoke all on function public.kitchen_tasks_today() from public, anon;
grant execute on function public.kitchen_tasks_today() to authenticated;
revoke all on function public.kitchen_task_set(uuid, boolean) from public, anon;
grant execute on function public.kitchen_task_set(uuid, boolean) to authenticated;
revoke all on function public.kitchen_stock_count(jsonb) from public, anon;
grant execute on function public.kitchen_stock_count(jsonb) to authenticated;
revoke all on function public.staff_give_idle_task() from public, anon, authenticated;
revoke all on function public.staff_clockout_reminders() from public, anon, authenticated;

select cron.unschedule('staff-tasks-tick') where exists (select 1 from cron.job where jobname = 'staff-tasks-tick');
select cron.schedule('staff-tasks-tick', '* * * * *', $cron$ select public.staff_give_idle_task(); select public.staff_clockout_reminders(); $cron$);
