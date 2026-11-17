-- Quiet-time and closing tasks also reach the employee's phone, and the
-- owner hears when a quiet-time task is done.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.staff_give_idle_task()'::regprocedure);
  n := replace(d, '''title'', ''משימה לזמן שקט'', ''body'', v_name || '' קיבל/ה: '' || v_task.title, ''url'', ''/admin/shifts'')), ''[]''::jsonb)
    from public.staff_members o where o.is_owner and o.active));',
  '''title'', ''משימה לזמן שקט'', ''body'', v_name || '' קיבל/ה: '' || v_task.title, ''url'', ''/staff/'')), ''[]''::jsonb)
    from public.staff_members o where o.is_owner and o.active));
  perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object(''staff_id'', e.staff_id, ''tag'', ''idle-me-'' || v_task.id,
    ''title'', ''רגע שקט? משימה'', ''body'', v_task.title, ''url'', ''/staff/'')), ''[]''::jsonb)
    from public.staff_time_entries e join public.staff_members m on m.id = e.staff_id and not m.is_owner where e.clock_out is null));');
  if n = d then raise exception 'staff_give_idle_task patch failed'; end if;
  execute n;
  d := pg_get_functiondef('public.staff_portal_tasks(text)'::regprocedure);
  n := replace(d, '''tasks'', public.staff_tasks_json(v_shift.shift_date));',
    '''tasks'', public.staff_tasks_json(v_shift.shift_date),
    ''closing_nudge'', exists (select 1 from public.staff_notification_log l where l.kind = ''closing'' and l.key = v_shift.id::text));');
  if n = d then raise exception 'staff_portal_tasks patch failed'; end if;
  execute n;
end $$;

create or replace function public.staff_idle_done_notice()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_who text;
begin
  if new.done_at is null or old.done_at is not null or new.source <> 'idle' then return new; end if;
  select split_part(m.display_name, ' ', 1) into v_who from public.staff_members m where m.id = new.done_by;
  perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'idle-done-' || new.id,
    'title', coalesce(v_who, 'העובד') || ' ביצע/ה ✓', 'body', new.title, 'url', '/staff/')), '[]'::jsonb)
    from public.staff_members o where o.is_owner and o.active and o.id is distinct from new.done_by));
  return new;
end $$;
drop trigger if exists staff_idle_done_notice on public.staff_task_runs;
create trigger staff_idle_done_notice after update of done_at on public.staff_task_runs
  for each row when (new.source = 'idle') execute function public.staff_idle_done_notice();
