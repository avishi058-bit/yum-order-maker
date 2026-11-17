-- 20 minutes after an employee clocks out (time to finish lights and locking
-- from the phone), the owner gets what was done and what wasn't.
create or replace function public.staff_shift_summaries()
returns void language plpgsql security definer set search_path = public as $$
declare e record; v_date date; v_total int; v_done int; v_missing text; v_owner uuid[];
begin
  select array_agg(id) into v_owner from public.staff_members where is_owner and active;
  if v_owner is null then return; end if;
  for e in select t.*, m.display_name from public.staff_time_entries t join public.staff_members m on m.id = t.staff_id and not m.is_owner
           where t.clock_out between now() - interval '3 hours' and now() - interval '20 minutes'
             and not exists (select 1 from public.staff_notification_log l where l.kind = 'summary' and l.key = t.id::text) loop
    v_date := coalesce((select s.shift_date from public.staff_shifts s where s.id = e.shift_id),
                       ((e.clock_in at time zone 'Asia/Jerusalem') - interval '4 hours')::date);
    select count(*), count(*) filter (where done_at is not null),
           string_agg(title, ', ' order by (section is not null), sort_order) filter (where done_at is null)
      into v_total, v_done, v_missing
      from public.staff_task_runs where shift_date = v_date and not (source = 'idle' and done_at is null);
    if v_total = 0 then
      insert into public.staff_notification_log(kind, key, staff_id) select 'summary', e.id::text, x from unnest(v_owner) x on conflict do nothing;
      continue;
    end if;
    perform public.staff_notify_once('summary', e.id::text, v_owner,
      split_part(e.display_name, ' ', 1) || ' סיים/ה משמרת - ' || v_done || ' מתוך ' || v_total || ' משימות',
      case when v_missing is null then 'כל המשימות בוצעו ✓' else 'לא בוצעו: ' || left(v_missing, 300) end, '/staff/');
  end loop;
end $$;
revoke all on function public.staff_shift_summaries() from public, anon, authenticated;

select cron.unschedule('staff-tasks-tick') where exists (select 1 from cron.job where jobname = 'staff-tasks-tick');
select cron.schedule('staff-tasks-tick', '* * * * *', $cron$ select public.staff_give_idle_task(); select public.staff_clockout_reminders(); select public.staff_closing_nudge(); select public.staff_supplier_reminders(); select public.staff_owner_order_reminders(); select public.staff_shift_summaries(); $cron$);
