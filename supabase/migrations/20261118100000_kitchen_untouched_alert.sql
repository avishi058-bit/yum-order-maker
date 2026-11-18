-- If the kitchen screen shows a task reminder, the place is quiet, and nobody
-- has touched the tablet for 20 minutes since, the employee is probably
-- outside and has not seen it - tell the owner once.
alter table public.staff_kitchen_signal
  add column if not exists last_touch_at timestamptz,
  add column if not exists reminder_shown_at timestamptz,
  add column if not exists reminder_title text;

create or replace function public.kitchen_touch()
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.staff_caller_is_kitchen() then raise exception 'forbidden'; end if;
  update public.staff_kitchen_signal set last_touch_at = now() where id = 1;
end $function$;

-- p_title null = no reminder on screen any more.
create or replace function public.kitchen_reminder_shown(p_title text)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.staff_caller_is_kitchen() then raise exception 'forbidden'; end if;
  if p_title is null then
    update public.staff_kitchen_signal set reminder_shown_at = null, reminder_title = null where id = 1;
  else
    update public.staff_kitchen_signal
       set reminder_shown_at = case when reminder_title is distinct from left(p_title, 200) or reminder_shown_at is null then now() else reminder_shown_at end,
           reminder_title = left(p_title, 200)
     where id = 1;
  end if;
end $function$;

revoke execute on function public.kitchen_touch() from public, anon;
revoke execute on function public.kitchen_reminder_shown(text) from public, anon;
grant execute on function public.kitchen_touch() to authenticated;
grant execute on function public.kitchen_reminder_shown(text) to authenticated;

create or replace function public.staff_untouched_alert()
returns void language plpgsql security definer set search_path to 'public' as $function$
declare s record; v_name text;
begin
  select * into s from public.staff_kitchen_signal where id = 1;
  if s.reminder_shown_at is null or s.reminder_shown_at > now() - interval '20 minutes' then return; end if;
  if s.last_touch_at is not null and s.last_touch_at > s.reminder_shown_at then return; end if;
  -- Still quiet: no orders in progress and none in the last 15 minutes.
  if exists (select 1 from public.orders o where o.status in ('new', 'preparing')) then return; end if;
  if exists (select 1 from public.orders o where o.updated_at > now() - interval '15 minutes'
             and o.status not in ('pending_payment', 'payment_failed', 'cancelled')) then return; end if;
  select split_part(m.display_name, ' ', 1) into v_name from public.staff_time_entries e
    join public.staff_members m on m.id = e.staff_id and not m.is_owner
   where e.clock_out is null order by e.clock_in limit 1;
  if v_name is null then return; end if;
  perform public.staff_notify_once('untouched', s.reminder_shown_at::text,
    array(select o.id from public.staff_members o where o.is_owner and o.active),
    v_name || ' לא ראה/תה את המשימות',
    'כבר 20 דקות מוצגת במטבח "' || coalesce(s.reminder_title, 'תזכורת') || '" ואף אחד לא נגע בטאבלט. כנראה בחוץ.',
    '/staff/');
end $function$;

revoke execute on function public.staff_untouched_alert() from public, anon, authenticated;

select cron.alter_job((select jobid from cron.job where jobname = 'staff-tasks-tick'),
  command := (select command from cron.job where jobname = 'staff-tasks-tick') || ' select public.staff_untouched_alert(); ');
