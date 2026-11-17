-- "משימות יומיות", "להשלים ל-40", checkout task after the lights, and after
-- 22:00 on a quiet night the closing list replaces quiet-time tasks.
update public.staff_tasks set section = 'משימות יומיות' where section = 'משימות השבוע';
update public.staff_task_runs set section = 'משימות יומיות' where section = 'משימות השבוע';

update public.staff_tasks set sort_order = sort_order + 1 where active and kind = 'closing' and sort_order in (214, 215);
update public.staff_task_runs set sort_order = sort_order + 1 where kind = 'closing' and sort_order in (214, 215) and done_at is null;
insert into public.staff_tasks(title, kind, section, sort_order)
select 'לעשות יציאה בקופה ובטאבלט', 'closing', 'סדר סגירה', 214
where not exists (select 1 from public.staff_tasks where active and title = 'לעשות יציאה בקופה ובטאבלט');

do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.staff_thaw_text(date, text)'::regprocedure);
  n := replace(replace(d, ''' להפשרה - עד ''', ''' להפשרה - להשלים ל-'''), ''' להפשרה - לבדוק עם אבישי כמה''', ''' להפשרה - לבדוק עם אבישי כמה''');
  if n = d then raise exception 'staff_thaw_text patch failed'; end if;
  execute n;
  d := pg_get_functiondef('public.staff_give_idle_task()'::regprocedure);
  n := replace(d, '  if v_name is null then return; end if;',
    '  if v_name is null then return; end if;
  if exists (select 1 from public.staff_notification_log l where l.kind = ''closing'' and l.key = v_shift.id::text) then return; end if;');
  if n = d then raise exception 'staff_give_idle_task patch failed'; end if;
  execute n;
end $$;

update public.staff_task_runs set title = public.staff_thaw_text(shift_date, case kind when 'patties' then 'קציצות' else 'לחמניות' end)
 where kind in ('patties', 'buns') and done_at is null and shift_date >= (now() at time zone 'Asia/Jerusalem')::date;
