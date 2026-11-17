-- Fried onion switched off in the kitchen: "להכין בצל מטוגן" joins tonight's
-- tasks (and whoever is on shift is told); switched back on = done.
create or replace function public.staff_task_from_availability()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_shift public.staff_shifts := public.staff_current_shift(); v_date date; v_ids uuid[]; v_was boolean;
begin
  v_date := coalesce(v_shift.shift_date, (now() at time zone 'Asia/Jerusalem')::date);
  v_was := case when tg_op = 'UPDATE' then old.available else true end;
  if new.available is false and v_was is distinct from false then
    if not exists (select 1 from public.staff_task_runs where shift_date = v_date and kind = 'prep' and title = 'להכין בצל מטוגן' and done_at is null) then
      insert into public.staff_task_runs(shift_date, task_id, title, kind, source, sort_order)
      values (v_date, null, 'להכין בצל מטוגן', 'prep', 'today', 0);
    end if;
    select array_agg(e.staff_id) into v_ids from public.staff_time_entries e where e.clock_out is null;
    if v_ids is not null then
      perform public.staff_send_messages((select jsonb_agg(jsonb_build_object('staff_id', x, 'tag', 'prep-fried-onion',
        'title', 'בצל מטוגן נגמר', 'body', 'להכין בצל מטוגן - נוסף למשימות')) from unnest(v_ids) x));
    end if;
  elsif new.available is true and v_was is false then
    update public.staff_task_runs set done_at = now()
     where shift_date = v_date and kind = 'prep' and title = 'להכין בצל מטוגן' and done_at is null;
  end if;
  return new;
end $$;
drop trigger if exists staff_task_from_availability on public.menu_availability;
create trigger staff_task_from_availability after insert or update of available on public.menu_availability
  for each row when (new.item_id = 'fried-onion') execute function public.staff_task_from_availability();
