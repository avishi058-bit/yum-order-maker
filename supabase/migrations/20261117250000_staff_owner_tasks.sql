-- The owner edits the task lists from his own staff app.
create or replace function public.staff_owner_tasks(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.staff_owner_by_token(p_token);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'kind', t.kind, 'section', t.section,
      'weekday', t.weekday, 'per_week', t.per_week, 'at_opening', t.at_opening, 'sort_order', t.sort_order)
      order by t.kind, t.section, t.sort_order, t.title), '[]'::jsonb)
    from public.staff_tasks t where t.active and t.kind <> 'count');
end $$;

create or replace function public.staff_owner_task_save(p_token text, p_id uuid, p_title text, p_kind text,
  p_section text default null, p_weekday int default null, p_per_week int default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_title text := btrim(coalesce(p_title, ''));
begin
  perform public.staff_owner_by_token(p_token);
  if length(v_title) not between 1 and 120 then raise exception 'not_found'; end if;
  if p_id is not null then
    update public.staff_tasks set title = v_title,
      weekday = case when kind = 'weekly' then coalesce(p_weekday, weekday) else weekday end,
      per_week = case when kind = 'rotating' then coalesce(p_per_week, per_week) else per_week end
     where id = p_id and active returning id into v_id;
    if v_id is null then raise exception 'not_found'; end if;
    -- Tonight's open copies get the new name too.
    update public.staff_task_runs set title = v_title where task_id = v_id and done_at is null
      and shift_date >= (now() at time zone 'Asia/Jerusalem')::date - 1;
    return v_id;
  end if;
  if p_kind not in ('closing', 'rotating', 'weekly', 'idle') then raise exception 'not_found'; end if;
  if p_kind = 'closing' and coalesce(p_section, '') not in ('קידום סגירה', 'סדר סגירה') then raise exception 'not_found'; end if;
  if p_kind = 'weekly' and (p_weekday is null or p_weekday not between 0 and 6) then raise exception 'not_found'; end if;
  insert into public.staff_tasks(title, kind, section, weekday, per_week, sort_order)
  values (v_title, p_kind,
          case p_kind when 'closing' then p_section when 'rotating' then 'משימות יומיות' when 'weekly' then 'משימות יומיות' end,
          case when p_kind = 'weekly' then p_weekday end,
          case when p_kind = 'rotating' then greatest(1, least(7, coalesce(p_per_week, 1))) end,
          coalesce((select max(sort_order) + 1 from public.staff_tasks where active and kind = p_kind and section is not distinct from
            case p_kind when 'closing' then p_section when 'rotating' then 'משימות יומיות' when 'weekly' then 'משימות יומיות' end), 100))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.staff_owner_task_remove(p_token text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.staff_owner_by_token(p_token);
  update public.staff_tasks set active = false where id = p_id;
  delete from public.staff_task_runs where task_id = p_id and done_at is null and shift_date >= (now() at time zone 'Asia/Jerusalem')::date;
end $$;

-- Move a task up or down within its list (closing order).
create or replace function public.staff_owner_task_move(p_token text, p_id uuid, p_up boolean)
returns void language plpgsql security definer set search_path = public as $$
declare t public.staff_tasks; o public.staff_tasks;
begin
  perform public.staff_owner_by_token(p_token);
  select * into t from public.staff_tasks where id = p_id and active;
  if t.id is null then return; end if;
  select * into o from public.staff_tasks x
   where x.active and x.kind = t.kind and x.section is not distinct from t.section and x.id <> t.id
     and case when p_up then x.sort_order < t.sort_order or (x.sort_order = t.sort_order and x.title < t.title)
              else x.sort_order > t.sort_order or (x.sort_order = t.sort_order and x.title > t.title) end
   order by case when p_up then -x.sort_order else x.sort_order end, x.title limit 1;
  if o.id is null then return; end if;
  update public.staff_tasks set sort_order = case when id = t.id then o.sort_order else t.sort_order end where id in (t.id, o.id);
  if o.sort_order = t.sort_order then
    update public.staff_tasks set sort_order = sort_order + case when p_up then 1 else -1 end where id = o.id;
  end if;
  update public.staff_task_runs r set sort_order = x.sort_order from public.staff_tasks x
   where r.task_id = x.id and x.id in (t.id, o.id) and r.done_at is null and r.shift_date >= (now() at time zone 'Asia/Jerusalem')::date;
end $$;
revoke all on function public.staff_owner_tasks(text), public.staff_owner_task_save(text, uuid, text, text, text, int, int),
  public.staff_owner_task_remove(text, uuid), public.staff_owner_task_move(text, uuid, boolean) from public;
grant execute on function public.staff_owner_tasks(text), public.staff_owner_task_save(text, uuid, text, text, text, int, int),
  public.staff_owner_task_remove(text, uuid), public.staff_owner_task_move(text, uuid, boolean) to anon, authenticated;
