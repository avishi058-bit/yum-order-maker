-- Staff shifts: employees sign up for next week's evening shifts from a personal
-- link (/staff/<token>), the admin assigns and publishes the week, and staff clock
-- in and out by tapping their name on the kitchen screen.
-- Employee names live only in the database (the repository is public).
-- Employees never get a database login: their page talks to the staff-portal edge
-- function, which checks the SHA-256 hash of their link token.

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(btrim(display_name)) between 1 and 60),
  is_owner boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  token_hash text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  shift_date date not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  created_at timestamptz not null default now()
);

-- "I can work this day" from the employee.
create table if not exists public.staff_shift_requests (
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  shift_date date not null,
  created_at timestamptz not null default now(),
  primary key (staff_id, shift_date)
);

-- Who the admin put on each shift. A shift with no rows is covered by the owner.
create table if not exists public.staff_shift_assignments (
  shift_id uuid not null references public.staff_shifts(id) on delete cascade,
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shift_id, staff_id)
);

-- A week (Sunday start) becomes visible to employees once published.
create table if not exists public.staff_schedule_weeks (
  week_start date primary key check (extract(dow from week_start) = 0),
  published_at timestamptz,
  notified_at timestamptz
);

create table if not exists public.staff_time_entries (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  shift_id uuid references public.staff_shifts(id) on delete set null,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  auto_closed boolean not null default false,
  check (clock_out is null or clock_out > clock_in)
);
create index if not exists staff_time_entries_staff_in_idx on public.staff_time_entries(staff_id, clock_in);
-- One open entry per person.
create unique index if not exists staff_time_entries_one_open on public.staff_time_entries(staff_id) where clock_out is null;

create table if not exists public.staff_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Dedupe for reminders (one per kind/key/person).
create table if not exists public.staff_notification_log (
  kind text not null,
  key text not null,
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (kind, key, staff_id)
);

-- RLS: admin manages everything; kitchen and employees go through the
-- security-definer functions below or the staff-portal edge function.
do $$
declare t text;
begin
  foreach t in array array['staff_members','staff_shifts','staff_shift_requests','staff_shift_assignments',
                           'staff_schedule_weeks','staff_time_entries','staff_push_subscriptions','staff_notification_log']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "Admin manages %s" on public.%I', t, t);
    execute format('create policy "Admin manages %s" on public.%I for all to authenticated using (public.has_role(auth.uid(), ''admin''::app_role)) with check (public.has_role(auth.uid(), ''admin''::app_role))', t, t);
  end loop;
end $$;

-- Token hash is never readable or writable from the client, even by admin
-- (column grants, since a table-wide grant would include it).
revoke select, insert, update on public.staff_members from authenticated;
grant select (id, display_name, is_owner, active, sort_order, created_at) on public.staff_members to authenticated;
grant insert (display_name, is_owner, active, sort_order) on public.staff_members to authenticated;
grant update (display_name, is_owner, active, sort_order) on public.staff_members to authenticated;

create or replace function public.staff_caller_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.role() = 'service_role' or public.has_role(auth.uid(), 'admin'::app_role)
$$;

-- Evening shift per open day of the week starting p_week_start (a Sunday):
-- arrive 30 minutes before opening, end at closing (next day when past midnight).
create or replace function public.staff_ensure_week(p_week_start date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_hours jsonb;
  d int;
  v_day date;
  v_h jsonb;
  v_from time;
  v_to time;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.staff_caller_is_admin() then raise exception 'forbidden'; end if;
  if extract(dow from p_week_start) <> 0 then raise exception 'week must start on Sunday'; end if;
  select business_hours into v_hours from public.site_settings order by created_at limit 1;
  for d in 0..6 loop
    v_day := p_week_start + d;
    v_h := v_hours -> d::text;
    continue when v_h is null or coalesce((v_h->>'open')::boolean, false) = false;
    v_from := (v_h->>'from')::time;
    v_to := (v_h->>'to')::time;
    v_start := ((v_day + v_from) - interval '30 minutes') at time zone 'Asia/Jerusalem';
    v_end := (case when v_to <= v_from then (v_day + 1) + v_to else v_day + v_to end) at time zone 'Asia/Jerusalem';
    insert into public.staff_shifts(shift_date, starts_at, ends_at)
    values (v_day, v_start, v_end)
    on conflict (shift_date) do nothing;
  end loop;
end $$;

-- New personal link for an employee; the old link stops working.
create or replace function public.staff_issue_link(p_staff_id uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_token text;
begin
  if not public.staff_caller_is_admin() then raise exception 'forbidden'; end if;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  update public.staff_members set token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex')
  where id = p_staff_id;
  if not found then raise exception 'not found'; end if;
  return v_token;
end $$;

-- The shift that is "now" for the kitchen: today's shift, or last night's while
-- it is still running after midnight.
create or replace function public.staff_current_shift()
returns public.staff_shifts language sql stable security definer set search_path = public as $$
  select s.* from public.staff_shifts s
  where now() between s.starts_at - interval '4 hours' and s.ends_at + interval '2 hours'
  order by s.starts_at desc limit 1
$$;

create or replace function public.staff_month_minutes(p_staff_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(extract(epoch from (coalesce(e.clock_out, now()) - e.clock_in)) / 60), 0)::int
  from public.staff_time_entries e
  where e.staff_id = p_staff_id
    and e.clock_in >= (date_trunc('month', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem')
$$;

-- Kitchen screen: who is on tonight, their status and hours this month.
create or replace function public.kitchen_staff_today()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_shift public.staff_shifts;
  v_people jsonb;
begin
  if not (public.has_role(auth.uid(), 'kitchen'::app_role) or public.has_role(auth.uid(), 'admin'::app_role)) then
    raise exception 'forbidden';
  end if;
  v_shift := public.staff_current_shift();
  with on_shift as (
    select m.* from public.staff_members m
    join public.staff_shift_assignments a on a.staff_id = m.id
    where v_shift.id is not null and a.shift_id = v_shift.id and m.active
  ), people as (
    select * from on_shift
    union all
    select m.* from public.staff_members m
    where m.active and m.is_owner and not exists (select 1 from on_shift)
    union
    -- anyone already clocked in stays visible so they can clock out
    select m.* from public.staff_members m
    join public.staff_time_entries e on e.staff_id = m.id and e.clock_out is null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'name', p.display_name,
      'is_owner', p.is_owner,
      'open_since', (select e.clock_in from public.staff_time_entries e where e.staff_id = p.id and e.clock_out is null),
      'month_minutes', public.staff_month_minutes(p.id)
    ) order by p.is_owner, p.sort_order, p.display_name), '[]'::jsonb)
  into v_people
  from (select distinct on (id) * from people) p;

  return jsonb_build_object(
    'shift', case when v_shift.id is null then null else jsonb_build_object(
      'id', v_shift.id, 'date', v_shift.shift_date, 'starts_at', v_shift.starts_at, 'ends_at', v_shift.ends_at) end,
    'people', v_people);
end $$;

-- Kitchen screen: tap a name to clock in, tap again to clock out.
create or replace function public.kitchen_staff_toggle(p_staff_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_open public.staff_time_entries;
  v_shift public.staff_shifts;
begin
  if not (public.has_role(auth.uid(), 'kitchen'::app_role) or public.has_role(auth.uid(), 'admin'::app_role)) then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.staff_members where id = p_staff_id and active) then
    raise exception 'not found';
  end if;
  select * into v_open from public.staff_time_entries where staff_id = p_staff_id and clock_out is null;
  if v_open.id is not null then
    -- ignore a double tap right after clocking in
    if now() - v_open.clock_in < interval '1 minute' then
      return jsonb_build_object('state', 'in', 'since', v_open.clock_in);
    end if;
    update public.staff_time_entries set clock_out = now() where id = v_open.id;
    return jsonb_build_object('state', 'out');
  end if;
  v_shift := public.staff_current_shift();
  insert into public.staff_time_entries(staff_id, shift_id) values (p_staff_id, v_shift.id);
  return jsonb_build_object('state', 'in', 'since', now());
end $$;

-- Every minute: close forgotten clock-outs and queue reminders. Pushes are sent
-- by the staff-notify edge function only when there is something to send.
create or replace function public.staff_notify_tick()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_now_il timestamp := now() at time zone 'Asia/Jerusalem';
  v_next_week date := (v_now_il::date - extract(dow from v_now_il)::int) + 7;
  v_msgs jsonb := '[]'::jsonb;
  r record;
begin
  -- Forgotten clock-out: close at the shift end, two hours after it ended.
  update public.staff_time_entries e
     set clock_out = greatest(s.ends_at, e.clock_in + interval '1 minute'), auto_closed = true
    from public.staff_shifts s
   where e.clock_out is null and e.shift_id = s.id and now() > s.ends_at + interval '2 hours';
  update public.staff_time_entries e
     set clock_out = e.clock_in + interval '8 hours', auto_closed = true
   where e.clock_out is null and e.shift_id is null and now() > e.clock_in + interval '10 hours';

  -- Friday 12:00-20:00: remind employees who did not sign up for next week yet.
  if extract(dow from v_now_il) = 5 and v_now_il::time between '12:00' and '20:00' then
    for r in
      select m.id from public.staff_members m
      where m.active and not m.is_owner
        and not exists (select 1 from public.staff_shift_requests q
                        where q.staff_id = m.id and q.shift_date between v_next_week and v_next_week + 6)
        and not exists (select 1 from public.staff_notification_log l
                        where l.kind = 'friday' and l.key = v_next_week::text and l.staff_id = m.id)
    loop
      insert into public.staff_notification_log(kind, key, staff_id) values ('friday', v_next_week::text, r.id);
      v_msgs := v_msgs || jsonb_build_object('staff_id', r.id, 'tag', 'friday-' || v_next_week,
        'title', 'שולחים משמרות לשבוע הבא',
        'body', 'זה הזמן לסמן באיזה ימים אתם יכולים לעבוד בשבוע הבא.');
    end loop;
  end if;

  -- One hour before a shift: time to get ready.
  for r in
    select a.staff_id, s.id as shift_id, s.starts_at from public.staff_shift_assignments a
    join public.staff_shifts s on s.id = a.shift_id
    join public.staff_members m on m.id = a.staff_id and m.active
    join public.staff_schedule_weeks w on w.published_at is not null
      and s.shift_date between w.week_start and w.week_start + 6
    where s.starts_at between now() and now() + interval '60 minutes'
      and not exists (select 1 from public.staff_notification_log l
                      where l.kind = 'prep' and l.key = s.id::text and l.staff_id = a.staff_id)
  loop
    insert into public.staff_notification_log(kind, key, staff_id) values ('prep', r.shift_id::text, r.staff_id);
    v_msgs := v_msgs || jsonb_build_object('staff_id', r.staff_id, 'tag', 'prep-' || r.shift_id,
      'title', 'משמרת בעוד שעה',
      'body', 'המשמרת מתחילה ב-' || to_char(r.starts_at at time zone 'Asia/Jerusalem', 'HH24:MI') || '. זמן להתארגן ולצאת.');
  end loop;

  -- 5 minutes after the start with no clock-in: tell the employee and the owner.
  for r in
    select a.staff_id, m.display_name, s.id as shift_id, s.starts_at from public.staff_shift_assignments a
    join public.staff_shifts s on s.id = a.shift_id
    join public.staff_members m on m.id = a.staff_id and m.active
    join public.staff_schedule_weeks w on w.published_at is not null
      and s.shift_date between w.week_start and w.week_start + 6
    where now() between s.starts_at + interval '5 minutes' and s.ends_at
      and not exists (select 1 from public.staff_time_entries e
                      where e.staff_id = a.staff_id and e.clock_in >= s.starts_at - interval '4 hours')
      and not exists (select 1 from public.staff_notification_log l
                      where l.kind = 'late' and l.key = s.id::text and l.staff_id = a.staff_id)
  loop
    insert into public.staff_notification_log(kind, key, staff_id) values ('late', r.shift_id::text, r.staff_id);
    v_msgs := v_msgs || jsonb_build_object('staff_id', r.staff_id, 'tag', 'late-' || r.shift_id,
      'title', 'אתם מאחרים למשמרת',
      'body', 'המשמרת התחילה ב-' || to_char(r.starts_at at time zone 'Asia/Jerusalem', 'HH24:MI') || '. כשמגיעים, לוחצים על השם במסך המטבח.');
    v_msgs := v_msgs || (select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'late-' || r.shift_id || '-' || r.staff_id,
      'title', r.display_name || ' מאחר/ת',
      'body', 'המשמרת התחילה ב-' || to_char(r.starts_at at time zone 'Asia/Jerusalem', 'HH24:MI') || ' ועוד אין כניסה במסך המטבח.',
      'url', '/admin/shifts')), '[]'::jsonb)
      from public.staff_members o where o.is_owner and o.active);
  end loop;

  -- Published (or re-published) week: tell everyone who is on it.
  for r in select w.week_start from public.staff_schedule_weeks w
           where w.published_at is not null and w.notified_at is null loop
    update public.staff_schedule_weeks set notified_at = now() where week_start = r.week_start;
    v_msgs := v_msgs || (select coalesce(jsonb_agg(jsonb_build_object('staff_id', x.staff_id, 'tag', 'week-' || r.week_start,
      'title', 'סידור העבודה פורסם',
      'body', 'יש לכם ' || x.n || ' משמרות בשבוע של ' || to_char(r.week_start, 'DD/MM') || '. לחצו לצפייה.')), '[]'::jsonb)
      from (select a.staff_id, count(*) as n from public.staff_shift_assignments a
            join public.staff_shifts s on s.id = a.shift_id
            join public.staff_members m on m.id = a.staff_id and m.active and not m.is_owner
            where s.shift_date between r.week_start and r.week_start + 6
            group by a.staff_id) x);
  end loop;

  if jsonb_array_length(v_msgs) > 0 then
    perform net.http_post(
      url := 'https://kdkcygokopwvutwvrgnp.supabase.co/functions/v1/staff-notify',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', public.get_webhook_secret()),
      body := jsonb_build_object('messages', v_msgs)
    );
  end if;
end $$;

revoke all on function public.staff_caller_is_admin() from public, anon;
revoke all on function public.staff_ensure_week(date) from public, anon;
revoke all on function public.staff_issue_link(uuid) from public, anon;
revoke all on function public.staff_current_shift() from public, anon;
revoke all on function public.staff_month_minutes(uuid) from public, anon;
revoke all on function public.kitchen_staff_today() from public, anon;
revoke all on function public.kitchen_staff_toggle(uuid) from public, anon;
revoke all on function public.staff_notify_tick() from public, anon, authenticated;
grant execute on function public.staff_ensure_week(date) to authenticated, service_role;
grant execute on function public.staff_issue_link(uuid) to authenticated;
grant execute on function public.kitchen_staff_today() to authenticated;
grant execute on function public.kitchen_staff_toggle(uuid) to authenticated;
grant execute on function public.staff_month_minutes(uuid) to service_role;
grant execute on function public.staff_current_shift() to service_role;

select cron.unschedule('staff-notify-tick') where exists (select 1 from cron.job where jobname = 'staff-notify-tick');
select cron.schedule('staff-notify-tick', '* * * * *', $$ select public.staff_notify_tick(); $$);
