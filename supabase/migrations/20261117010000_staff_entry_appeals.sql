-- An employee who clocked in late by mistake can ask to correct the arrival
-- time of a shift. The admin approves or rejects; approval rewrites clock_in.

create table if not exists public.staff_entry_appeals (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.staff_time_entries(id) on delete cascade,
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  claimed_in timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index if not exists staff_entry_appeals_one_pending on public.staff_entry_appeals(entry_id) where status = 'pending';
alter table public.staff_entry_appeals enable row level security;
revoke all on public.staff_entry_appeals from anon;
grant select on public.staff_entry_appeals to authenticated;
drop policy if exists "Admin reads staff_entry_appeals" on public.staff_entry_appeals;
create policy "Admin reads staff_entry_appeals" on public.staff_entry_appeals for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

-- p_time is the real arrival time ("HH:MM", Israel time) on the day of the entry.
create or replace function public.staff_portal_appeal(p_token text, p_entry_id uuid, p_time text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me public.staff_members;
  v_entry public.staff_time_entries;
  v_claimed timestamptz;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  select * into v_entry from public.staff_time_entries where id = p_entry_id and staff_id = me.id;
  if v_entry.id is null then raise exception 'not_found'; end if;
  if p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'invalid_time'; end if;
  v_claimed := ((v_entry.clock_in at time zone 'Asia/Jerusalem')::date + p_time::time) at time zone 'Asia/Jerusalem';
  if v_claimed >= v_entry.clock_in or v_entry.clock_in - v_claimed > interval '6 hours' then raise exception 'invalid_time'; end if;
  if exists (select 1 from public.staff_entry_appeals where entry_id = p_entry_id and status = 'pending') then
    raise exception 'appeal_pending';
  end if;
  insert into public.staff_entry_appeals(entry_id, staff_id, claimed_in) values (p_entry_id, me.id, v_claimed);
  perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'appeal-' || p_entry_id,
    'title', 'ערעור על שעת כניסה',
    'body', me.display_name || ' מבקש/ת לתקן כניסה ל-' || p_time || ' (נרשם ' || to_char(v_entry.clock_in at time zone 'Asia/Jerusalem', 'HH24:MI') || ').',
    'url', '/admin/shifts')), '[]'::jsonb) from public.staff_members o where o.is_owner and o.active));
end $$;

create or replace function public.staff_decide_appeal(p_appeal_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v public.staff_entry_appeals;
begin
  if not public.staff_caller_is_admin() then raise exception 'forbidden'; end if;
  select * into v from public.staff_entry_appeals where id = p_appeal_id and status = 'pending';
  if v.id is null then raise exception 'not_found'; end if;
  if p_approve then
    update public.staff_time_entries set clock_in = v.claimed_in where id = v.entry_id;
  end if;
  update public.staff_entry_appeals set status = case when p_approve then 'approved' else 'rejected' end, decided_at = now()
   where id = p_appeal_id;
  perform public.staff_send_messages(jsonb_build_array(jsonb_build_object('staff_id', v.staff_id, 'tag', 'appeal-' || v.id,
    'title', case when p_approve then 'הערעור אושר' else 'הערעור לא אושר' end,
    'body', case when p_approve then 'שעת הכניסה עודכנה ל-' || to_char(v.claimed_in at time zone 'Asia/Jerusalem', 'HH24:MI') || '.'
                 else 'שעת הכניסה נשארה כמו שנרשמה. אפשר לדבר עם אבישי.' end)));
end $$;

-- The employee page shows each entry's id and latest appeal.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.staff_portal_me(text)'::regprocedure);
  if position('''appeal''' in d) = 0 then
    n := replace(d, '''clock_in'', e.clock_in, ''clock_out'', e.clock_out,',
      '''id'', e.id, ''appeal'', (select jsonb_build_object(''status'', a.status, ''claimed_in'', a.claimed_in)
          from public.staff_entry_appeals a where a.entry_id = e.id order by a.created_at desc limit 1),
      ''clock_in'', e.clock_in, ''clock_out'', e.clock_out,');
    if n = d then raise exception 'portal_me patch failed'; end if;
    execute n;
  end if;
end $$;

revoke all on function public.staff_portal_appeal(text, uuid, text) from public;
grant execute on function public.staff_portal_appeal(text, uuid, text) to anon, authenticated;
revoke all on function public.staff_decide_appeal(uuid, boolean) from public, anon;
grant execute on function public.staff_decide_appeal(uuid, boolean) to authenticated;
