-- Submissions: the owner hears about each one; employees who have not
-- submitted for next week are reminded until they do (from Tuesday twice a
-- day, from Thursday every 4 hours, 10:00-22:00), unless the week is published.
create or replace function public.staff_submission_notice()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_member public.staff_members; v_n int; v_weekend boolean; v_warn text;
begin
  if tg_op = 'UPDATE' and new.submitted_at is not distinct from old.submitted_at then return new; end if;
  select * into v_member from public.staff_members where id = new.staff_id;
  if v_member.is_owner then return new; end if;
  select count(*), bool_or(extract(dow from r.shift_date) in (4, 6)) into v_n, v_weekend
    from public.staff_shift_requests r where r.staff_id = new.staff_id and r.shift_date between new.week_start and new.week_start + 6;
  v_warn := concat_ws(' · ', case when v_n < 3 then 'פחות מ-3 משמרות' end, case when not coalesce(v_weekend, false) then 'בלי חמישי או מוצ״ש' end);
  perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'submitted-' || new.staff_id || '-' || new.week_start,
    'title', split_part(v_member.display_name, ' ', 1) || ' הגיש/ה משמרות - ' || v_n,
    'body', coalesce(nullif(v_warn, ''), 'לפי הכללים ✓') || ' · לבניית הסידור', 'url', '/staff/')), '[]'::jsonb)
    from public.staff_members o where o.is_owner and o.active));
  return new;
end $$;
drop trigger if exists staff_submission_notice on public.staff_week_submissions;
create trigger staff_submission_notice after insert or update of submitted_at on public.staff_week_submissions
  for each row execute function public.staff_submission_notice();

create or replace function public.staff_submission_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_il timestamp := now() at time zone 'Asia/Jerusalem';
  v_dow int := extract(dow from v_il)::int;
  v_hour int := extract(hour from v_il)::int;
  v_next date := v_il::date - extract(dow from v_il)::int + 7;
  v_slot int;
  v_ids uuid[];
begin
  if exists (select 1 from public.staff_schedule_weeks w where w.week_start = v_next and w.published_at is not null) then return; end if;
  if v_dow between 2 and 3 then
    v_slot := case when v_hour >= 20 then 20 when v_hour >= 12 then 12 end;
  elsif v_dow >= 4 then
    v_slot := case when v_hour >= 22 then 22 when v_hour >= 18 then 18 when v_hour >= 14 then 14 when v_hour >= 10 then 10 end;
  end if;
  if v_slot is null or v_hour > 22 then return; end if;
  select array_agg(m.id) into v_ids from public.staff_members m
   where m.active and not m.is_owner
     and not exists (select 1 from public.staff_week_submissions q where q.staff_id = m.id and q.week_start = v_next);
  if v_ids is null then return; end if;
  perform public.staff_notify_once('submit-nag', v_next::text || '-' || v_il::date::text || '-' || v_slot, v_ids,
    'עוד לא הגשת משמרות לשבוע הבא',
    'נכנסים לאפליקציה ← משמרות ← מסמנים ימים ← הגשה.', '/staff/');
end $$;
revoke all on function public.staff_submission_reminders() from public, anon, authenticated;

select cron.unschedule('staff-tasks-tick') where exists (select 1 from cron.job where jobname = 'staff-tasks-tick');
select cron.schedule('staff-tasks-tick', '* * * * *', $cron$ select public.staff_give_idle_task(); select public.staff_clockout_reminders(); select public.staff_closing_nudge(); select public.staff_supplier_reminders(); select public.staff_owner_order_reminders(); select public.staff_shift_summaries(); select public.staff_submission_reminders(); $cron$);
