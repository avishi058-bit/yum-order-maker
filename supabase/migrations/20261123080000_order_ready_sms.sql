-- "Your order is ready" SMS.
-- Website pickup and delivery orders always get it (the phone is part of the
-- order). Dine-in website orders and kiosk orders get it only when the customer
-- tapped "הולכים לסיבוב וחוזרים?" and gave a phone (order_sms_optin).
-- When the kitchen marks an order ready, the trigger claims the order (once per
-- order, so it never sends twice) and calls the staff worker with the phone and
-- the staff VAPID private key, which the worker checks against its public key
-- exactly like /notify, so nobody else can make it send.
-- internal_config.sms_ready_mode: 'off' | 'test' (only sms_test_phones) | 'on'.

create table if not exists public.order_ready_sms (
  order_id uuid primary key references public.orders(id) on delete cascade,
  phone text not null,
  kind text,
  opted_at timestamptz,
  sent_at timestamptz,
  status int
);
alter table public.order_ready_sms enable row level security;

insert into public.internal_config (key, value) values ('sms_ready_mode', 'off'), ('sms_test_phones', '')
on conflict (key) do nothing;

create or replace function public.order_sms_optin(p_order uuid, p_phone text)
returns boolean language plpgsql security definer set search_path to 'public' as $function$
declare o public.orders; ph text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if ph like '972%' then ph := '0' || substr(ph, 4); end if;
  if ph !~ '^05\d{8}$' then return false; end if;
  select * into o from public.orders where id = p_order;
  if o.id is null or o.created_at < now() - interval '6 hours'
     or o.status not in ('pending_payment', 'new', 'preparing') then return false; end if;
  insert into public.order_ready_sms (order_id, phone, opted_at) values (p_order, ph, now())
  on conflict (order_id) do update set phone = excluded.phone, opted_at = now()
    where public.order_ready_sms.sent_at is null;
  return true;
end $function$;

create or replace function public.order_ready_sms_claim(p_order uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare o public.orders; r public.order_ready_sms; v_kind text; v_phone text; v_mode text;
begin
  select value into v_mode from public.internal_config where key = 'sms_ready_mode';
  if coalesce(v_mode, 'off') = 'off' then return null; end if;
  select * into o from public.orders where id = p_order;
  if o.id is null or o.status <> 'ready' or o.created_at < now() - interval '12 hours' then return null; end if;
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

create or replace function public.order_ready_sms_notify()
returns trigger language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare v_url text; v_claim jsonb;
begin
  if new.status = 'ready' and old.status is distinct from 'ready'
     and new.order_source in ('website', 'kiosk')
     and coalesce((select value from public.internal_config where key = 'sms_ready_mode'), 'off') <> 'off' then
    begin
      v_url := public.staff_config('staff_worker_url');
      v_claim := public.order_ready_sms_claim(new.id);
      if v_url is not null and v_claim is not null then
        perform net.http_post(url := v_url || '/sms/ready',
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := v_claim || jsonb_build_object('order_id', new.id::text,
                    'vapid_private', public.staff_config('staff_vapid_private')));
      end if;
    exception when others then
      null; -- never block the kitchen because of an SMS
    end;
  end if;
  return null;
end $function$;

drop trigger if exists order_ready_sms_notify on public.orders;
create trigger order_ready_sms_notify after update of status on public.orders
  for each row execute function public.order_ready_sms_notify();

revoke execute on function public.order_ready_sms_notify() from public, anon, authenticated;
grant execute on function public.order_sms_optin(uuid, text) to anon, authenticated;
revoke execute on function public.order_ready_sms_claim(uuid) from public, anon, authenticated;
