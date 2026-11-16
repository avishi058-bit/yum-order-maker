-- Shifts follow the opening hours exactly (no early arrival). Saturday night and
-- the night after a holiday open one hour after Shabbat / the holiday ends in
-- Beer Sheva (Hebcal times, rounded up to 5 minutes); days the place is closed
-- are blocked. Employees submit next week's availability with one button.
-- The ordering site keeps its own after-Shabbat opening rule (afterShabbatMin).

create table if not exists public.staff_special_days (
  day date primary key,
  closed boolean not null default false,
  opens_at time,
  label text,
  shabbat_ends time
);
create table if not exists public.staff_week_submissions (
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  week_start date not null,
  submitted_at timestamptz not null default now(),
  primary key (staff_id, week_start)
);
do $$
declare t text;
begin
  foreach t in array array['staff_special_days','staff_week_submissions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "Admin manages %s" on public.%I', t, t);
    execute format('create policy "Admin manages %s" on public.%I for all to authenticated using (public.has_role(auth.uid(), ''admin''::app_role)) with check (public.has_role(auth.uid(), ''admin''::app_role))', t, t);
  end loop;
end $$;

insert into public.staff_special_days(day, closed, opens_at, label, shabbat_ends) values
 ('2026-11-21', false, '18:20', null, '17:18'),
 ('2026-11-28', false, '18:20', null, '17:17'),
 ('2026-12-05', false, '18:20', null, '17:17'),
 ('2026-12-12', false, '18:20', null, '17:18'),
 ('2026-12-19', false, '18:25', null, '17:21'),
 ('2026-12-26', false, '18:25', null, '17:25'),
 ('2027-01-02', false, '18:30', null, '17:29'),
 ('2027-01-09', false, '18:35', null, '17:34'),
 ('2027-01-16', false, '18:40', null, '17:40'),
 ('2027-01-23', false, '18:50', null, '17:46'),
 ('2027-01-30', false, '18:55', null, '17:52'),
 ('2027-02-06', false, '19:00', null, '17:57'),
 ('2027-02-13', false, '19:05', null, '18:03'),
 ('2027-02-20', false, '19:10', null, '18:08'),
 ('2027-02-27', false, '19:15', null, '18:13'),
 ('2027-03-06', false, '19:20', null, '18:18'),
 ('2027-03-13', false, '19:25', null, '18:23'),
 ('2027-03-20', false, '19:30', null, '18:28'),
 ('2027-03-27', false, '20:35', null, '19:33'),
 ('2027-04-03', false, '20:40', null, '19:38'),
 ('2027-04-10', false, '20:45', null, '19:43'),
 ('2027-04-17', false, '20:50', null, '19:48'),
 ('2027-04-21', true, null, 'ערב פסח', null),
 ('2027-04-22', true, null, 'פסח', null),
 ('2027-04-24', true, null, 'חול המועד פסח', null),
 ('2027-04-25', true, null, 'חול המועד פסח', null),
 ('2027-04-26', true, null, 'חול המועד פסח', null),
 ('2027-04-27', true, null, 'חול המועד פסח', null),
 ('2027-04-28', true, null, 'שביעי של פסח', null),
 ('2027-05-01', false, '21:00', null, '19:58'),
 ('2027-05-03', true, null, 'ערב יום השואה', null),
 ('2027-05-08', false, '21:05', null, '20:04'),
 ('2027-05-10', true, null, 'ערב יום הזיכרון', null),
 ('2027-05-15', false, '21:10', null, '20:09'),
 ('2027-05-22', false, '21:15', null, '20:15'),
 ('2027-05-24', true, null, 'ליל ל״ג בעומר', null),
 ('2027-05-25', true, null, 'ל״ג בעומר', null),
 ('2027-05-29', false, '21:20', null, '20:19'),
 ('2027-06-05', false, '21:25', null, '20:24'),
 ('2027-06-10', true, null, 'ערב שבועות', null),
 ('2027-06-12', false, '21:30', null, '20:27'),
 ('2027-06-19', false, '21:30', null, '20:30'),
 ('2027-06-26', false, '21:35', null, '20:31'),
 ('2027-07-03', false, '21:35', null, '20:31'),
 ('2027-07-10', false, '21:30', null, '20:29'),
 ('2027-07-17', false, '21:30', null, '20:26'),
 ('2027-07-24', false, '21:25', null, '20:22'),
 ('2027-07-31', false, '21:20', null, '20:17'),
 ('2027-08-07', false, '21:15', null, '20:11'),
 ('2027-08-11', true, null, 'ליל תשעה באב', null),
 ('2027-08-12', false, '20:55', 'מוצאי תשעה באב', '19:55'),
 ('2027-08-14', false, '21:05', null, '20:03'),
 ('2027-08-21', false, '20:55', null, '19:55'),
 ('2027-08-28', false, '20:50', null, '19:47'),
 ('2027-09-04', false, '20:40', null, '19:38'),
 ('2027-09-11', false, '20:30', null, '19:29'),
 ('2027-09-18', false, '20:20', null, '19:19'),
 ('2027-09-25', false, '20:10', null, '19:10'),
 ('2027-10-02', true, null, 'ראש השנה', null),
 ('2027-10-03', false, '20:00', 'מוצאי ראש השנה', '19:00'),
 ('2027-10-09', false, '19:55', null, '18:53'),
 ('2027-10-10', true, null, 'ערב יום כיפור', null),
 ('2027-10-11', false, '19:50', 'מוצאי יום כיפור', '18:50'),
 ('2027-10-16', false, '19:45', null, '18:45'),
 ('2027-10-23', false, '19:40', null, '18:37'),
 ('2027-10-30', false, '19:35', null, '18:31'),
 ('2027-11-06', false, '18:30', null, '17:26'),
 ('2027-11-13', false, '18:25', null, '17:22'),
 ('2027-11-20', false, '18:20', null, '17:19'),
 ('2027-11-27', false, '18:20', null, '17:17'),
 ('2027-12-04', false, '18:20', null, '17:17'),
 ('2027-12-11', false, '18:20', null, '17:18'),
 ('2027-12-18', false, '18:20', null, '17:20'),
 ('2027-12-25', false, '18:25', null, '17:24')
on conflict (day) do nothing;

create or replace function public.staff_day_label(p_day date)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select d.label from public.staff_special_days d where d.day = p_day and d.label is not null),
    (array['ראשון','שני','שלישי','רביעי','חמישי','שישי','מוצ״ש'])[extract(dow from p_day)::int + 1])
$$;

create or replace function public.staff_ensure_week_impl(p_week_start date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_hours jsonb; d int; v_day date; v_h jsonb; v_from time; v_to time; v_start timestamptz; v_end timestamptz;
  v_sp public.staff_special_days;
begin
  if extract(dow from p_week_start) <> 0 then raise exception 'week must start on Sunday'; end if;
  select business_hours into v_hours from public.site_settings order by created_at limit 1;
  for d in 0..6 loop
    v_day := p_week_start + d;
    v_h := v_hours -> d::text;
    select * into v_sp from public.staff_special_days where day = v_day;
    continue when v_sp.closed is true;
    continue when v_h is null or coalesce((v_h->>'open')::boolean, false) = false;
    v_from := coalesce(v_sp.opens_at, (v_h->>'from')::time);
    v_to := (v_h->>'to')::time;
    v_start := (v_day + v_from) at time zone 'Asia/Jerusalem';
    v_end := (case when v_to <= v_from then (v_day + 1) + v_to else v_day + v_to end) at time zone 'Asia/Jerusalem';
    insert into public.staff_shifts(shift_date, starts_at, ends_at)
    values (v_day, v_start, v_end)
    on conflict (shift_date) do nothing;
  end loop;
end $$;

-- Admin closes or reopens a single day.
create or replace function public.staff_set_day_closed(p_day date, p_closed boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.staff_caller_is_admin() then raise exception 'forbidden'; end if;
  insert into public.staff_special_days(day, closed) values (p_day, p_closed)
  on conflict (day) do update set closed = excluded.closed;
  if p_closed then
    delete from public.staff_shifts where shift_date = p_day;
    delete from public.staff_shift_requests where shift_date = p_day;
  else
    perform public.staff_ensure_week_impl(p_day - extract(dow from p_day)::int);
  end if;
end $$;

create or replace function public.staff_portal_submit(p_token text, p_week_start date, p_dates date[])
returns void language plpgsql security definer set search_path = public as $$
declare
  me public.staff_members;
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_next_week date := v_today - extract(dow from v_today)::int + 7;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  if p_week_start is distinct from v_next_week then raise exception 'week_closed'; end if;
  if exists (select 1 from public.staff_schedule_weeks where week_start = p_week_start and published_at is not null) then
    raise exception 'week_published';
  end if;
  delete from public.staff_shift_requests where staff_id = me.id and shift_date between p_week_start and p_week_start + 6;
  insert into public.staff_shift_requests(staff_id, shift_date)
  select me.id, s.shift_date from public.staff_shifts s
  where s.shift_date = any(coalesce(p_dates, '{}'::date[])) and s.shift_date between p_week_start and p_week_start + 6;
  insert into public.staff_week_submissions(staff_id, week_start) values (me.id, p_week_start)
  on conflict (staff_id, week_start) do update set submitted_at = now();
end $$;
drop function if exists public.staff_portal_set_request(text, date, boolean);

create or replace function public.staff_portal_me(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me public.staff_members;
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_this_week date;
  v_next_week date;
  v_month_start timestamptz;
  v_worker text := public.staff_config('staff_worker_url');
  v_entries jsonb;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  v_this_week := v_today - extract(dow from v_today)::int;
  v_next_week := v_this_week + 7;
  v_month_start := date_trunc('month', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem';

  perform public.staff_ensure_week_impl(v_this_week);
  perform public.staff_ensure_week_impl(v_next_week);

  select coalesce(jsonb_agg(x order by x->>'clock_in'), '[]'::jsonb) into v_entries from (
    select jsonb_build_object(
      'clock_in', e.clock_in, 'clock_out', e.clock_out, 'auto_closed', e.auto_closed,
      'label', public.staff_day_label(coalesce(s.shift_date, (e.clock_in at time zone 'Asia/Jerusalem')::date)),
      'minutes', greatest(0, round(extract(epoch from (coalesce(e.clock_out, now()) - e.clock_in)) / 60))::int,
      'late_minutes', case when s.starts_at is not null and e.clock_in > s.starts_at + interval '5 minutes'
                           then round(extract(epoch from (e.clock_in - s.starts_at)) / 60)::int else 0 end) as x
    from public.staff_time_entries e left join public.staff_shifts s on s.id = e.shift_id
    where e.staff_id = me.id and e.clock_in >= v_month_start) t;

  return jsonb_build_object(
    'me', jsonb_build_object('name', me.display_name, 'is_owner', me.is_owner),
    'calendar_url', case when v_worker is null then null else v_worker || '/calendar?t=' || p_token end,
    'push_key', public.staff_config('staff_push_key'),
    'next_week', jsonb_build_object(
      'week_start', v_next_week,
      'published', exists (select 1 from public.staff_schedule_weeks w where w.week_start = v_next_week and w.published_at is not null),
      'submitted_at', (select q.submitted_at from public.staff_week_submissions q where q.staff_id = me.id and q.week_start = v_next_week),
      'closed', (select coalesce(jsonb_agg(jsonb_build_object('date', d.day, 'label', coalesce(d.label, 'סגור')) order by d.day), '[]'::jsonb)
                 from public.staff_special_days d where d.closed and d.day between v_next_week and v_next_week + 6),
      'days', (select coalesce(jsonb_agg(jsonb_build_object(
                 'date', s.shift_date, 'label', public.staff_day_label(s.shift_date), 'starts_at', s.starts_at, 'ends_at', s.ends_at,
                 'requested', exists (select 1 from public.staff_shift_requests q where q.staff_id = me.id and q.shift_date = s.shift_date))
               order by s.shift_date), '[]'::jsonb)
               from public.staff_shifts s where s.shift_date between v_next_week and v_next_week + 6)),
    'upcoming', (select coalesce(jsonb_agg(jsonb_build_object(
                   'date', s.shift_date, 'label', public.staff_day_label(s.shift_date), 'starts_at', s.starts_at, 'ends_at', s.ends_at,
                   'mine', exists (select 1 from public.staff_shift_assignments a where a.shift_id = s.id and a.staff_id = me.id),
                   'team', (select coalesce(jsonb_agg(m.display_name order by m.sort_order), '[]'::jsonb)
                            from public.staff_shift_assignments a join public.staff_members m on m.id = a.staff_id
                            where a.shift_id = s.id))
                 order by s.shift_date), '[]'::jsonb)
                 from public.staff_shifts s
                 join public.staff_schedule_weeks w on w.published_at is not null
                   and s.shift_date between w.week_start and w.week_start + 6
                 where s.ends_at > now() and s.shift_date <= v_today + 21
                   and (me.is_owner or exists (select 1 from public.staff_shift_assignments a where a.shift_id = s.id and a.staff_id = me.id))),
    'month', jsonb_build_object(
      'minutes', (select coalesce(sum((x->>'minutes')::int), 0) from jsonb_array_elements(v_entries) x),
      'late_count', (select count(*) from jsonb_array_elements(v_entries) x where (x->>'late_minutes')::int > 0),
      'entries', v_entries),
    'open_since', (select e.clock_in from public.staff_time_entries e where e.staff_id = me.id and e.clock_out is null)
  );
end $$;

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
        and not exists (select 1 from public.staff_week_submissions q
                        where q.staff_id = m.id and q.week_start = v_next_week)
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
      'body', 'מתחילים ב-' || to_char(r.starts_at at time zone 'Asia/Jerusalem', 'HH24:MI') || '. זמן להתארגן ולצאת.');
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
      'body', 'המשמרות שלך לשבוע של ' || to_char(r.week_start, 'DD/MM') || ': ' || x.days)), '[]'::jsonb)
      from (select a.staff_id, string_agg(public.staff_day_label(s.shift_date) || ' ' ||
                   to_char(s.starts_at at time zone 'Asia/Jerusalem', 'HH24:MI'), ', ' order by s.shift_date) as days
            from public.staff_shift_assignments a
            join public.staff_shifts s on s.id = a.shift_id
            join public.staff_members m on m.id = a.staff_id and m.active and not m.is_owner
            where s.shift_date between r.week_start and r.week_start + 6
            group by a.staff_id) x);
  end loop;

  perform public.staff_send_messages(v_msgs);
end $$;

revoke all on function public.staff_day_label(date) from public, anon;
grant execute on function public.staff_day_label(date) to authenticated, service_role;
revoke all on function public.staff_ensure_week_impl(date) from public, anon, authenticated;
revoke all on function public.staff_set_day_closed(date, boolean) from public, anon;
grant execute on function public.staff_set_day_closed(date, boolean) to authenticated;
revoke all on function public.staff_portal_submit(text, date, date[]) from public;
grant execute on function public.staff_portal_submit(text, date, date[]) to anon, authenticated;
revoke all on function public.staff_portal_me(text) from public;
grant execute on function public.staff_portal_me(text) to anon, authenticated;
revoke all on function public.staff_notify_tick() from public, anon, authenticated;

-- Rebuild upcoming shifts with the new hours (nothing is assigned or clocked yet
-- on days that have no assignment or time entry).
delete from public.staff_shifts s
 where s.shift_date >= (now() at time zone 'Asia/Jerusalem')::date
   and not exists (select 1 from public.staff_shift_assignments a where a.shift_id = s.id)
   and not exists (select 1 from public.staff_time_entries e where e.shift_id = s.id);
select public.staff_ensure_week_impl(((now() at time zone 'Asia/Jerusalem')::date - extract(dow from (now() at time zone 'Asia/Jerusalem')::date)::int));
select public.staff_ensure_week_impl(((now() at time zone 'Asia/Jerusalem')::date - extract(dow from (now() at time zone 'Asia/Jerusalem')::date)::int) + 7);
