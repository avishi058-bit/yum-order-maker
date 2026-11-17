-- A popped-up task can be cancelled for tonight from the kitchen screen; the
-- owner is told. Cancelled tasks leave the lists.
alter table public.staff_task_runs add column if not exists skipped_at timestamptz;

create or replace function public.kitchen_task_skip(p_run_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.staff_task_runs; v_who text;
begin
  if not public.staff_caller_is_kitchen() then raise exception 'forbidden'; end if;
  update public.staff_task_runs set skipped_at = now() where id = p_run_id and done_at is null and skipped_at is null returning * into r;
  if r.id is null then return; end if;
  select split_part(m.display_name, ' ', 1) into v_who from public.staff_time_entries e join public.staff_members m on m.id = e.staff_id
   where e.clock_out is null and not m.is_owner order by e.clock_in limit 1;
  perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'skip-' || r.id,
    'title', coalesce(v_who, 'העובד') || ' ביטל/ה משימה', 'body', r.title, 'url', '/staff/')), '[]'::jsonb)
    from public.staff_members o where o.is_owner and o.active));
end $$;
revoke all on function public.kitchen_task_skip(uuid) from public, anon;
grant execute on function public.kitchen_task_skip(uuid) to authenticated;

do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.staff_tasks_json(date)'::regprocedure);
  n := replace(d, 'from public.staff_task_runs r where r.shift_date = p_date', 'from public.staff_task_runs r where r.shift_date = p_date and r.skipped_at is null');
  if n = d then raise exception 'staff_tasks_json patch failed'; end if;
  execute n;
  d := pg_get_functiondef('public.staff_give_idle_task()'::regprocedure);
  n := replace(d, 'and (r.done_at is null or r.created_at > now() - interval ''20 minutes'')',
                  'and ((r.done_at is null and r.skipped_at is null) or r.created_at > now() - interval ''20 minutes'')');
  if n = d then raise exception 'staff_give_idle_task patch failed'; end if;
  execute n;
  d := pg_get_functiondef('public.staff_shift_summaries()'::regprocedure);
  n := replace(d, 'where shift_date = v_date and not (source = ''idle'' and done_at is null);',
                  'where shift_date = v_date and skipped_at is null and not (source = ''idle'' and done_at is null);');
  if n = d then raise exception 'staff_shift_summaries patch failed'; end if;
  execute n;
end $$;
