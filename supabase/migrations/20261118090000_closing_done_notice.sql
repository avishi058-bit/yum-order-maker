-- The owner gets one self-updating notification per night as closing tasks
-- are ticked ("<name> · סגירה n/total"), on top of the quiet-time task notices.
CREATE OR REPLACE FUNCTION public.staff_idle_done_notice()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_who text; v_closing boolean; v_done int; v_total int;
begin
  if new.done_at is null or old.done_at is not null then return new; end if;
  v_closing := new.section in ('קידום סגירה', 'סדר סגירה');
  if new.source <> 'idle' and not v_closing then return new; end if;
  select split_part(m.display_name, ' ', 1) into v_who from public.staff_members m where m.id = new.done_by;
  if v_closing then
    select count(*) filter (where r.done_at is not null), count(*) into v_done, v_total
      from public.staff_task_runs r where r.shift_date = new.shift_date and r.section in ('קידום סגירה', 'סדר סגירה') and r.skipped_at is null;
    perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'closing-done-' || new.shift_date,
      'title', coalesce(v_who, 'העובד') || ' · סגירה ' || v_done || '/' || v_total || case when v_done >= v_total then ' - הכל בוצע ✓' else '' end,
      'body', '✓ ' || new.title, 'url', '/staff/')), '[]'::jsonb)
      from public.staff_members o where o.is_owner and o.active and o.id is distinct from new.done_by));
    return new;
  end if;
  perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'idle-done-' || new.id,
    'title', coalesce(v_who, 'העובד') || ' ביצע/ה ✓', 'body', new.title, 'url', '/staff/')), '[]'::jsonb)
    from public.staff_members o where o.is_owner and o.active and o.id is distinct from new.done_by));
  return new;
end $function$;
