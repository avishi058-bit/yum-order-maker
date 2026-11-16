-- The employee page talks to these token-gated functions directly (no edge
-- function needed). Push reminders and the calendar feed are served by a small
-- external worker (workers/staff), configured in internal_config:
--   staff_worker_url     - base URL of the worker
--   staff_worker_secret  - shared secret the worker checks on /notify
--   staff_push_key       - the worker's VAPID public key (for subscribing)

create or replace function public.staff_member_by_token(p_token text)
returns public.staff_members language sql stable security definer set search_path = public, extensions as $$
  select m.* from public.staff_members m
  where p_token ~ '^[0-9a-f]{48}$'
    and m.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and m.active
$$;

create or replace function public.staff_config(p_key text)
returns text language sql stable security definer set search_path = public as $$
  select value from public.internal_config where key = p_key
$$;

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

  select coalesce(jsonb_agg(x order by x->>'clock_in' desc), '[]'::jsonb) into v_entries from (
    select jsonb_build_object(
      'clock_in', e.clock_in, 'clock_out', e.clock_out, 'auto_closed', e.auto_closed,
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
      'days', (select coalesce(jsonb_agg(jsonb_build_object(
                 'date', s.shift_date, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
                 'requested', exists (select 1 from public.staff_shift_requests q where q.staff_id = me.id and q.shift_date = s.shift_date))
               order by s.shift_date), '[]'::jsonb)
               from public.staff_shifts s where s.shift_date between v_next_week and v_next_week + 6)),
    'upcoming', (select coalesce(jsonb_agg(jsonb_build_object(
                   'date', s.shift_date, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
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

create or replace function public.staff_portal_set_request(p_token text, p_date date, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  me public.staff_members;
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_next_week date := v_today - extract(dow from v_today)::int + 7;
  v_ws date := p_date - extract(dow from p_date)::int;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  if v_ws < v_next_week or v_ws > v_next_week + 7 then raise exception 'week_closed'; end if;
  if exists (select 1 from public.staff_schedule_weeks where week_start = v_ws and published_at is not null) then
    raise exception 'week_published';
  end if;
  if not exists (select 1 from public.staff_shifts where shift_date = p_date) then raise exception 'no_shift'; end if;
  if p_on then
    insert into public.staff_shift_requests(staff_id, shift_date) values (me.id, p_date) on conflict do nothing;
  else
    delete from public.staff_shift_requests where staff_id = me.id and shift_date = p_date;
  end if;
end $$;

create or replace function public.staff_portal_push(p_token text, p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.staff_members;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'invalid_subscription';
  end if;
  delete from public.staff_push_subscriptions where endpoint = p_endpoint;
  insert into public.staff_push_subscriptions(staff_id, endpoint, p256dh, auth) values (me.id, p_endpoint, p_p256dh, p_auth);
end $$;

-- Calendar feed rows for the worker (published weeks only).
create or replace function public.staff_calendar_feed(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me public.staff_members;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
      'team', (select coalesce(jsonb_agg(m.display_name order by m.sort_order), '[]'::jsonb)
               from public.staff_shift_assignments a join public.staff_members m on m.id = a.staff_id where a.shift_id = s.id),
      'owner', (select o.display_name from public.staff_members o where o.is_owner and o.active order by o.sort_order limit 1))
    order by s.starts_at), '[]'::jsonb)
    from public.staff_shifts s
    join public.staff_schedule_weeks w on w.published_at is not null and s.shift_date between w.week_start and w.week_start + 6
    where s.shift_date >= (now() at time zone 'Asia/Jerusalem')::date - 30
      and (me.is_owner or exists (select 1 from public.staff_shift_assignments a where a.shift_id = s.id and a.staff_id = me.id)));
end $$;

create or replace function public.staff_ensure_week_impl(p_week_start date)
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

create or replace function public.staff_ensure_week(p_week_start date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.staff_caller_is_admin() then raise exception 'forbidden'; end if;
  perform public.staff_ensure_week_impl(p_week_start);
end $$;

-- Hand the queued reminders, with each person's push subscriptions, to the
-- external worker. Nothing is sent until the worker is configured.
create or replace function public.staff_send_messages(p_msgs jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url text := public.staff_config('staff_worker_url');
  v_secret text := public.staff_config('staff_worker_secret');
  v_payload jsonb;
begin
  if v_url is null or v_secret is null or jsonb_array_length(coalesce(p_msgs, '[]'::jsonb)) = 0 then return; end if;
  select coalesce(jsonb_agg(m || jsonb_build_object('subs', s.subs)), '[]'::jsonb) into v_payload
  from jsonb_array_elements(p_msgs) m
  cross join lateral (
    select jsonb_agg(jsonb_build_object('endpoint', p.endpoint, 'p256dh', p.p256dh, 'auth', p.auth)) as subs
    from public.staff_push_subscriptions p where p.staff_id = (m->>'staff_id')::uuid) s
  where s.subs is not null;
  if jsonb_array_length(v_payload) = 0 then return; end if;
  perform net.http_post(
    url := v_url || '/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-staff-secret', v_secret),
    body := jsonb_build_object('messages', v_payload));
end $$;

-- The worker reports subscriptions the push service no longer accepts.
create or replace function public.staff_push_expired(p_secret text, p_endpoints text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_secret is null or p_secret is distinct from public.staff_config('staff_worker_secret') then raise exception 'forbidden'; end if;
  delete from public.staff_push_subscriptions where endpoint = any(p_endpoints);
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

  perform public.staff_send_messages(v_msgs);
end $$;

revoke all on function public.staff_member_by_token(text) from public, anon, authenticated;
revoke all on function public.staff_config(text) from public, anon, authenticated;
revoke all on function public.staff_portal_me(text) from public;
revoke all on function public.staff_portal_set_request(text, date, boolean) from public;
revoke all on function public.staff_portal_push(text, text, text, text) from public;
revoke all on function public.staff_calendar_feed(text) from public;
grant execute on function public.staff_portal_me(text) to anon, authenticated;
grant execute on function public.staff_portal_set_request(text, date, boolean) to anon, authenticated;
grant execute on function public.staff_portal_push(text, text, text, text) to anon, authenticated;
grant execute on function public.staff_calendar_feed(text) to anon, authenticated;
revoke all on function public.staff_ensure_week_impl(date) from public, anon, authenticated;
revoke all on function public.staff_send_messages(jsonb) from public, anon, authenticated;
revoke all on function public.staff_push_expired(text, text[]) from public;
grant execute on function public.staff_push_expired(text, text[]) to anon;
