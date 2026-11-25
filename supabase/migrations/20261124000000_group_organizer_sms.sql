-- Group orders: only the organizer verifies a phone (SMS code) and only the
-- organizer gets the "ready" SMS - once for the whole group. Participants'
-- own orders never trigger a ready SMS.

alter table public.order_groups add column if not exists notify_phone text;
alter table public.order_groups add column if not exists ready_sms_at timestamptz;

drop function if exists public.group_create(text, boolean);
create or replace function public.group_create(p_name text, p_dine_in boolean, p_phone text)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare v_code text; v_secret text := public.group_token(); n int := 0; v_phone text := public.otp_norm_phone(p_phone);
begin
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'name_required'; end if;
  -- The organizer's phone must have passed the SMS code (otp_verify).
  if v_phone !~ '^05\d{8}$' or not exists (select 1 from public.verified_phones where phone = v_phone) then
    raise exception 'phone_not_verified';
  end if;
  loop
    v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6));
    exit when not exists (select 1 from public.order_groups where code = v_code);
    n := n + 1; if n > 10 then raise exception 'code_failed'; end if;
  end loop;
  insert into public.order_groups (code, organizer_name, secret_hash, dine_in, notify_phone)
  values (v_code, left(trim(p_name), 40), public.group_hash(v_secret), coalesce(p_dine_in, false), v_phone);
  return jsonb_build_object('code', v_code, 'secret', v_secret);
end $f$;
grant execute on function public.group_create(text, boolean, text) to anon, authenticated;

create or replace function public.order_ready_sms_claim(p_order uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare o public.orders; r public.order_ready_sms; v_kind text; v_phone text; v_mode text; g public.order_groups;
begin
  select value into v_mode from public.internal_config where key = 'sms_ready_mode';
  if coalesce(v_mode, 'off') = 'off' then return null; end if;
  select * into o from public.orders where id = p_order;
  if o.id is null or o.status <> 'ready' or o.created_at < now() - interval '12 hours' then return null; end if;

  -- Group order: one SMS to the organizer for the whole group, nothing to participants.
  if o.group_id is not null then
    select * into g from public.order_groups where id = o.group_id;
    v_phone := g.notify_phone;
    if v_phone is null or v_phone !~ '^05\d{8}$' then return null; end if;
    if v_mode = 'test' and position(v_phone in coalesce((select value from public.internal_config where key = 'sms_test_phones'), '')) = 0 then
      return null;
    end if;
    update public.order_groups set ready_sms_at = now() where id = g.id and ready_sms_at is null;
    if not found then return null; end if;
    v_kind := case when g.dine_in then 'counter' else 'pickup' end;
    return jsonb_build_object('phone', v_phone, 'kind', v_kind, 'name', g.organizer_name);
  end if;

  select * into r from public.order_ready_sms where order_id = p_order;
  if r.sent_at is not null then return null; end if;
  if o.order_source = 'website' and coalesce(o.delivery_address, '') <> '' then
    v_kind := 'delivery'; v_phone := coalesce(r.phone, o.customer_phone);
  elsif o.order_source = 'website' and not coalesce(o.dine_in, false) then
    v_kind := 'pickup'; v_phone := coalesce(r.phone, o.customer_phone);
  elsif o.order_source in ('website', 'kiosk') and r.phone is not null then
    v_kind := 'counter'; v_phone := r.phone;
  else
    return null;
  end if;
  v_phone := regexp_replace(coalesce(v_phone, ''), '\D', '', 'g');
  if v_phone like '972%' then v_phone := '0' || substr(v_phone, 4); end if;
  if v_phone !~ '^05\d{8}$' then return null; end if;
  if v_mode = 'test' and position(v_phone in coalesce((select value from public.internal_config where key = 'sms_test_phones'), '')) = 0 then
    return null;
  end if;
  insert into public.order_ready_sms (order_id, phone, kind, sent_at) values (p_order, v_phone, v_kind, now())
  on conflict (order_id) do update set phone = excluded.phone, kind = excluded.kind, sent_at = now()
    where public.order_ready_sms.sent_at is null
  returning * into r;
  if r.order_id is null then return null; end if;
  return jsonb_build_object('phone', v_phone, 'kind', v_kind, 'name', o.customer_name);
end $function$;
revoke execute on function public.order_ready_sms_claim(uuid) from public, anon, authenticated;
