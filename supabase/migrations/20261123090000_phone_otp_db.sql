-- Phone check by SMS code, kept in the database (strongly consistent, so taps
-- in a row can never send more than one code).
-- otp_request: creates the code and asks the staff worker to send it (pg_net,
--   with the staff VAPID private key the worker checks, like /notify).
-- otp_request_status: whether that SMS went out (so the site can skip the check
--   when SMS is down instead of blocking the order).
-- otp_verify: checks the code; on success remembers the phone as verified and
--   returns the name from this phone's last order, so a customer who logs back
--   in gets his details filled in. Only after proving the phone is his.

create table if not exists public.otp_codes (
  phone text primary key,
  code_hash text not null,
  sent_at timestamptz not null default now(),
  tries int not null default 0,
  req_id bigint
);
create table if not exists public.otp_sends (
  id bigserial primary key,
  phone text not null,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists otp_sends_created on public.otp_sends (created_at);
create table if not exists public.verified_phones (
  phone text primary key,
  verified_at timestamptz not null default now()
);
alter table public.otp_codes enable row level security;
alter table public.otp_sends enable row level security;
alter table public.verified_phones enable row level security;

create or replace function public.otp_norm_phone(p text)
returns text language sql immutable as $function$
  select case when d like '972%' then '0' || substr(d, 4) else d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') d) x;
$function$;

create or replace function public.otp_request(p_phone text)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare
  ph text := public.otp_norm_phone(p_phone);
  v_ip text;
  cur public.otp_codes;
  code text;
  req bigint;
  v_url text := public.staff_config('staff_worker_url');
begin
  if ph !~ '^05\d{8}$' then return jsonb_build_object('error', 'מספר טלפון לא תקין'); end if;
  perform pg_advisory_xact_lock(hashtext('otp:' || ph));
  select * into cur from public.otp_codes where phone = ph;
  -- A code went out less than a minute ago: it is still valid, send nothing.
  if cur.phone is not null and cur.sent_at > now() - interval '60 seconds' then
    return jsonb_build_object('ok', true, 'cooldown', true, 'req', cur.req_id);
  end if;
  begin
    v_ip := coalesce(current_setting('request.headers', true)::json->>'cf-connecting-ip',
                   split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1));
  exception when others then v_ip := null; end;
  -- Limits; over one, the customer continues without the check (never blocked).
  if (select count(*) from public.otp_sends s where s.phone = ph and created_at > now() - interval '24 hours') >= 5
     or (v_ip is not null and (select count(*) from public.otp_sends s where s.ip = v_ip and created_at > now() - interval '1 hour') >= 6)
     or (select count(*) from public.otp_sends s where s.created_at > now() - interval '24 hours') >= 150
     or v_url is null then
    return jsonb_build_object('ok', false, 'skip', true);
  end if;
  code := lpad((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');
  req := net.http_post(url := v_url || '/sms/otp',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('phone', ph, 'code', code, 'vapid_private', public.staff_config('staff_vapid_private')));
  insert into public.otp_codes (phone, code_hash, sent_at, tries, req_id)
  values (ph, encode(digest(ph || ':' || code, 'sha256'), 'hex'), now(), 0, req)
  on conflict (phone) do update set code_hash = excluded.code_hash, sent_at = now(), tries = 0, req_id = excluded.req_id;
  insert into public.otp_sends (phone, ip) values (ph, v_ip);
  delete from public.otp_sends where created_at < now() - interval '3 days';
  return jsonb_build_object('ok', true, 'req', req);
end $function$;

create or replace function public.otp_request_status(p_req bigint)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare r record; s int;
begin
  select status_code, content into r from net._http_response where id = p_req;
  if not found then return 'pending'; end if;
  begin s := (r.content::json->>'status')::int; exception when others then s := null; end;
  return case when r.status_code = 200 and coalesce(s, 0) > 0 then 'sent' else 'failed' end;
end $function$;

create or replace function public.otp_verify(p_phone text, p_code text)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare
  ph text := public.otp_norm_phone(p_phone);
  c text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  cur public.otp_codes;
  v_name text;
begin
  if ph !~ '^05\d{8}$' or length(c) <> 6 then return jsonb_build_object('error', 'קוד שגוי'); end if;
  perform pg_advisory_xact_lock(hashtext('otp:' || ph));
  select * into cur from public.otp_codes where phone = ph;
  if cur.phone is null or cur.sent_at < now() - interval '10 minutes' then
    return jsonb_build_object('error', 'הקוד פג, שלחו קוד חדש');
  end if;
  if cur.code_hash <> encode(digest(ph || ':' || c, 'sha256'), 'hex') then
    if cur.tries + 1 >= 5 then
      delete from public.otp_codes where phone = ph;
      return jsonb_build_object('error', 'יותר מדי ניסיונות, שלחו קוד חדש');
    end if;
    update public.otp_codes set tries = tries + 1 where phone = ph;
    return jsonb_build_object('error', 'קוד שגוי');
  end if;
  delete from public.otp_codes where phone = ph;
  insert into public.verified_phones (phone) values (ph) on conflict (phone) do update set verified_at = now();
  select o.customer_name into v_name from public.orders o
   where o.customer_phone = ph and o.status not in ('cancelled', 'payment_failed') and coalesce(o.customer_name, '') <> ''
   order by o.created_at desc limit 1;
  return jsonb_build_object('ok', true, 'name', v_name);
end $function$;

revoke execute on function public.otp_request(text) from public;
revoke execute on function public.otp_request_status(bigint) from public;
revoke execute on function public.otp_verify(text, text) from public;
grant execute on function public.otp_request(text) to anon, authenticated;
grant execute on function public.otp_request_status(bigint) to anon, authenticated;
grant execute on function public.otp_verify(text, text) to anon, authenticated;
