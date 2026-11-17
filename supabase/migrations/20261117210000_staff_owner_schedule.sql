-- The owner builds the schedule inside his own staff app (his personal link):
-- who asked for each day, rule warnings, pick who works, publish. Each person
-- has a colour. The owner's calendar feed names who works each shift.
alter table public.staff_members add column if not exists color text;
update public.staff_members set color = case
  when display_name like 'אליה%' then '#2563eb'
  when display_name like 'יובל%' then '#9333ea'
  when is_owner then '#e8502f' end
where color is null;

create or replace function public.staff_owner_by_token(p_token text)
returns public.staff_members language plpgsql stable security definer set search_path = public as $$
declare me public.staff_members;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  if not me.is_owner then raise exception 'forbidden'; end if;
  return me;
end $$;
revoke all on function public.staff_owner_by_token(text) from public, anon, authenticated;

create or replace function public.staff_owner_week(p_token text, p_week_start date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me public.staff_members; v_ws date := p_week_start - extract(dow from p_week_start)::int;
begin
  me := public.staff_owner_by_token(p_token);
  perform public.staff_ensure_week_impl(v_ws);
  return jsonb_build_object(
    'week_start', v_ws,
    'published', exists (select 1 from public.staff_schedule_weeks w where w.week_start = v_ws and w.published_at is not null),
    'owner', jsonb_build_object('id', me.id, 'name', me.display_name, 'color', coalesce(me.color, '#e8502f')),
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'name', m.display_name, 'color', coalesce(m.color, '#64748b'),
        'submitted_at', (select ws.submitted_at from public.staff_week_submissions ws where ws.staff_id = m.id and ws.week_start = v_ws),
        'requests', (select count(*) from public.staff_shift_requests r where r.staff_id = m.id and r.shift_date between v_ws and v_ws + 6),
        'weekend', exists (select 1 from public.staff_shift_requests r where r.staff_id = m.id and r.shift_date between v_ws and v_ws + 6
                           and extract(dow from r.shift_date) in (4, 6))
      ) order by m.sort_order, m.display_name), '[]'::jsonb)
      from public.staff_members m where m.active and not m.is_owner),
    'closed', (select coalesce(jsonb_agg(jsonb_build_object('date', d.day, 'label', public.staff_day_label(d.day)) order by d.day), '[]'::jsonb)
      from public.staff_special_days d where d.closed and d.day between v_ws and v_ws + 6),
    'days', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'date', s.shift_date, 'label', public.staff_day_label(s.shift_date), 'starts_at', s.starts_at, 'ends_at', s.ends_at,
        'requested', (select coalesce(jsonb_agg(r.staff_id), '[]'::jsonb) from public.staff_shift_requests r where r.shift_date = s.shift_date),
        'assigned', (select coalesce(jsonb_agg(a.staff_id), '[]'::jsonb) from public.staff_shift_assignments a where a.shift_id = s.id)
      ) order by s.shift_date), '[]'::jsonb)
      from public.staff_shifts s where s.shift_date between v_ws and v_ws + 6
        and not exists (select 1 from public.staff_special_days d where d.day = s.shift_date and d.closed)));
end $$;

create or replace function public.staff_owner_assign(p_token text, p_shift_id uuid, p_staff_id uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me public.staff_members;
begin
  me := public.staff_owner_by_token(p_token);
  if not exists (select 1 from public.staff_members m where m.id = p_staff_id and m.active) then raise exception 'not_found'; end if;
  if not exists (select 1 from public.staff_shifts s where s.id = p_shift_id) then raise exception 'not_found'; end if;
  if p_on then
    insert into public.staff_shift_assignments(shift_id, staff_id) values (p_shift_id, p_staff_id) on conflict do nothing;
  else
    delete from public.staff_shift_assignments where shift_id = p_shift_id and staff_id = p_staff_id;
  end if;
end $$;

-- Publishing sends each employee their shifts (the notify tick picks it up).
create or replace function public.staff_owner_publish(p_token text, p_week_start date)
returns void language plpgsql security definer set search_path = public as $$
declare me public.staff_members; v_ws date := p_week_start - extract(dow from p_week_start)::int;
begin
  me := public.staff_owner_by_token(p_token);
  insert into public.staff_schedule_weeks(week_start, published_at, notified_at) values (v_ws, now(), null)
  on conflict (week_start) do update set published_at = now(), notified_at = null;
end $$;
revoke all on function public.staff_owner_week(text, date), public.staff_owner_assign(text, uuid, uuid, boolean), public.staff_owner_publish(text, date) from public;
grant execute on function public.staff_owner_week(text, date), public.staff_owner_assign(text, uuid, uuid, boolean), public.staff_owner_publish(text, date) to anon, authenticated;

-- Calendar titles: "משמרת הבקתה" for employees; who works, for the owner.
create or replace function public.staff_calendar_feed(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me public.staff_members;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
      'title', case when me.is_owner then
          coalesce((select string_agg(split_part(m.display_name, ' ', 1), ', ' order by m.sort_order)
                    from public.staff_shift_assignments a join public.staff_members m on m.id = a.staff_id and not m.is_owner
                    where a.shift_id = s.id), 'אני') || ' - משמרת הבקתה'
        else 'משמרת הבקתה' end,
      'team', '[]'::jsonb)
    order by s.starts_at), '[]'::jsonb)
    from public.staff_shifts s
    join public.staff_schedule_weeks w on w.published_at is not null and s.shift_date between w.week_start and w.week_start + 6
    where s.shift_date >= (now() at time zone 'Asia/Jerusalem')::date - 30
      and not exists (select 1 from public.staff_special_days d where d.day = s.shift_date and d.closed)
      and (me.is_owner or exists (select 1 from public.staff_shift_assignments a where a.shift_id = s.id and a.staff_id = me.id)));
end $$;
