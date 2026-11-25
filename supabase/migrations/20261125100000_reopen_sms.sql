-- "עדכנו אותי כשנפתח" by SMS.
-- The customer taps the button; the phone must have passed the SMS code
-- (verified_phones). When the site opens (website_open false -> true, by
-- hand or by the schedule) every waiting request gets ONE SMS through the
-- staff worker (/sms/reopen) and is closed - it does not repeat on later days.
-- Same switch as the "ready" SMS: internal_config.sms_ready_mode off | test | on.

create table if not exists public.reopen_sms (
  phone text primary key,
  name text,
  requested_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.reopen_sms enable row level security;

create or replace function public.reopen_sms_request(p_phone text, p_name text)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare v_phone text := public.otp_norm_phone(p_phone);
begin
  if v_phone !~ '^05\d{8}$' or not exists (select 1 from public.verified_phones where phone = v_phone) then
    return jsonb_build_object('ok', false, 'error', 'phone_not_verified');
  end if;
  insert into public.reopen_sms (phone, name, requested_at, sent_at)
  values (v_phone, left(nullif(trim(coalesce(p_name, '')), ''), 40), now(), null)
  on conflict (phone) do update set name = coalesce(excluded.name, public.reopen_sms.name), requested_at = now(), sent_at = null;
  return jsonb_build_object('ok', true);
end $f$;

create or replace function public.reopen_sms_send_all()
returns integer language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare v_mode text; v_url text; v_tests text; r record; n int := 0;
begin
  select value into v_mode from public.internal_config where key = 'sms_ready_mode';
  if coalesce(v_mode, 'off') = 'off' then return 0; end if;
  v_url := public.staff_config('staff_worker_url');
  if v_url is null then return 0; end if;
  select coalesce(value, '') into v_tests from public.internal_config where key = 'sms_test_phones';
  for r in
    update public.reopen_sms set sent_at = now()
     where sent_at is null and requested_at > now() - interval '14 days'
       and (v_mode <> 'test' or position(phone in coalesce(v_tests, '')) > 0)
    returning phone, name
  loop
    begin
      perform net.http_post(url := v_url || '/sms/reopen',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('phone', r.phone, 'name', r.name,
                  'vapid_private', public.staff_config('staff_vapid_private')));
      n := n + 1;
    exception when others then null;
    end;
  end loop;
  return n;
end $f$;

create or replace function public.reopen_sms_on_open()
returns trigger language plpgsql security definer set search_path to 'public' as $f$
begin
  if new.website_open and not coalesce(old.website_open, false) then
    begin perform public.reopen_sms_send_all(); exception when others then null; end;
  end if;
  return null;
end $f$;

drop trigger if exists reopen_sms_on_open on public.restaurant_status;
create trigger reopen_sms_on_open after update of website_open on public.restaurant_status
  for each row execute function public.reopen_sms_on_open();

revoke execute on function public.reopen_sms_send_all() from public, anon, authenticated;
revoke execute on function public.reopen_sms_on_open() from public, anon, authenticated;
grant execute on function public.reopen_sms_request(text, text) to anon, authenticated;
