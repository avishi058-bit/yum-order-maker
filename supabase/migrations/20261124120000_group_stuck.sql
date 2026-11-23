-- Stuck group orders: someone already paid but the kitchen still has nothing,
-- because the organizer did not send the group or someone did not pay.
-- - 15 minutes after the first payment: ONE SMS to the organizer with a link
--   to manage the group (pay for others, take people out, send without them).
--   The link carries a new manage token (only its hash is kept), which counts
--   as the organizer's secret, so it works from any phone.
-- - 30 minutes after the first payment: an alert card on the kitchen screen
--   with the organizer's name and phone. It rings like a new order until the
--   kitchen taps "הבנתי", and disappears by itself once the group is sent.
-- Normal (non-group) orders are not touched.

alter table public.order_groups add column if not exists manage_hash text;
alter table public.order_groups add column if not exists stuck_sms_at timestamptz;
alter table public.order_groups add column if not exists stuck_alert_at timestamptz;
alter table public.order_groups add column if not exists stuck_ack_at timestamptz;

-- The organizer: the secret from opening the group, or the token from the SMS link.
create or replace function public.group_is_organizer(g public.order_groups, p_secret text)
returns boolean language sql stable set search_path to 'public', 'extensions' as $f$
  select coalesce(p_secret, '') <> ''
     and coalesce(g.secret_hash = public.group_hash(p_secret) or g.manage_hash = public.group_hash(p_secret), false);
$f$;

-- Organizer: "everyone's in" (same as before, also accepts the SMS link token).
create or replace function public.group_lock(p_code text, p_secret text)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare g public.order_groups; v_sent boolean;
begin
  select * into g from public.order_groups where code = upper(trim(p_code)) for update;
  if g.id is null or not public.group_is_organizer(g, p_secret) then raise exception 'not_organizer'; end if;
  if g.status = 'open' then
    if not exists (select 1 from public.orders where group_id = g.id and status not in ('cancelled', 'payment_failed')) then
      raise exception 'group_empty';
    end if;
    update public.order_groups set status = 'locked', locked_at = now() where id = g.id;
  end if;
  v_sent := public.group_try_release(g.id);
  return jsonb_build_object('ok', true, 'sent', v_sent);
end $f$;

-- Remove an unpaid dish: the organizer (secret or SMS link), or the person who ordered it.
create or replace function public.group_remove(p_code text, p_order uuid, p_secret text)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare g public.order_groups; m public.order_group_members;
begin
  select * into g from public.order_groups where code = upper(trim(p_code));
  select * into m from public.order_group_members where order_id = p_order and group_id = g.id;
  if g.id is null or m.order_id is null then raise exception 'not_found'; end if;
  if not public.group_is_organizer(g, p_secret) and m.token_hash <> public.group_hash(p_secret) then
    raise exception 'not_allowed';
  end if;
  update public.orders set status = 'cancelled' where id = p_order and status = 'pending_payment';
  if not found then raise exception 'not_unpaid'; end if;
  perform public.group_try_release(g.id);
  return jsonb_build_object('ok', true);
end $f$;

-- Organizer: send to the kitchen now, without everyone who has not paid.
create or replace function public.group_send_without_unpaid(p_code text, p_secret text)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare g public.order_groups;
begin
  select * into g from public.order_groups where code = upper(trim(p_code)) for update;
  if g.id is null or not public.group_is_organizer(g, p_secret) then raise exception 'not_organizer'; end if;
  if g.status not in ('open', 'locked') then raise exception 'group_closed'; end if;
  if not exists (select 1 from public.orders where group_id = g.id
                 and status not in ('pending_payment', 'cancelled', 'payment_failed')) then
    raise exception 'nobody_paid';
  end if;
  update public.order_groups set status = 'locked', locked_at = coalesce(locked_at, now()) where id = g.id;
  -- Each cancel fires group_on_order_status, which releases the group once nothing waits.
  update public.orders set status = 'cancelled' where group_id = g.id and status = 'pending_payment';
  perform public.group_try_release(g.id);
  return jsonb_build_object('ok', true, 'sent', (select status = 'sent' from public.order_groups where id = g.id));
end $f$;

-- Every minute: SMS the organizer at 15 minutes, alert the kitchen at 30.
create or replace function public.group_stuck_tick()
returns void language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare r record; v_mode text; v_url text; v_token text; v_claimed boolean;
begin
  select value into v_mode from public.internal_config where key = 'sms_ready_mode';
  for r in
    select g.id, g.code, g.organizer_name, g.notify_phone, g.stuck_sms_at, g.stuck_alert_at,
      (select min(coalesce(o.paid_at, o.updated_at)) from public.orders o
        where o.group_id = g.id and o.status not in ('pending_payment', 'cancelled', 'payment_failed')) as first_paid
    from public.order_groups g
    where g.status in ('open', 'locked') and g.created_at > now() - interval '12 hours'
      and (g.stuck_sms_at is null or g.stuck_alert_at is null)
  loop
    continue when r.first_paid is null;

    if r.stuck_sms_at is null and r.first_paid < now() - interval '15 minutes' then
      update public.order_groups set stuck_sms_at = now() where id = r.id and stuck_sms_at is null;
      v_claimed := found;
      if v_claimed and coalesce(v_mode, 'off') <> 'off' and coalesce(r.notify_phone, '') ~ '^05\d{8}$'
         and (v_mode <> 'test' or position(r.notify_phone in coalesce(
               (select value from public.internal_config where key = 'sms_test_phones'), '')) > 0) then
        begin
          v_url := public.staff_config('staff_worker_url');
          if v_url is not null then
            v_token := public.group_token();
            update public.order_groups set manage_hash = public.group_hash(v_token) where id = r.id;
            perform net.http_post(url := v_url || '/sms/group-stuck',
              headers := jsonb_build_object('Content-Type', 'application/json'),
              body := jsonb_build_object('phone', r.notify_phone, 'name', r.organizer_name,
                        'code', r.code, 'token', v_token,
                        'vapid_private', public.staff_config('staff_vapid_private')));
          end if;
        exception when others then
          null; -- an SMS problem never stops the kitchen alert
        end;
      end if;
    end if;

    if r.stuck_alert_at is null and r.first_paid < now() - interval '30 minutes' then
      update public.order_groups set stuck_alert_at = now() where id = r.id and stuck_alert_at is null;
    end if;
  end loop;
end $f$;

-- Kitchen screen: stuck groups not yet acknowledged.
create or replace function public.kitchen_stuck_groups()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $f$
begin
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'kitchen')) then
    raise exception 'forbidden';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id, 'organizer', g.organizer_name, 'phone', g.notify_phone,
      'created_at', g.created_at, 'alert_at', g.stuck_alert_at,
      'paid', (select count(*) from public.orders o where o.group_id = g.id
                and o.status not in ('pending_payment', 'cancelled', 'payment_failed')),
      'unpaid', (select count(*) from public.orders o where o.group_id = g.id and o.status = 'pending_payment')
    ) order by g.stuck_alert_at)
    from public.order_groups g
    where g.status in ('open', 'locked') and g.stuck_alert_at is not null and g.stuck_ack_at is null
  ), '[]'::jsonb);
end $f$;

-- Kitchen tapped "הבנתי".
create or replace function public.kitchen_ack_stuck_group(p_group uuid)
returns boolean language plpgsql security definer set search_path to 'public' as $f$
begin
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'kitchen')) then
    raise exception 'forbidden';
  end if;
  update public.order_groups set stuck_ack_at = now() where id = p_group and stuck_ack_at is null;
  return found;
end $f$;

select cron.schedule('group-stuck-tick', '* * * * *', $cron$ select public.group_stuck_tick(); $cron$);

revoke execute on function public.group_is_organizer(public.order_groups, text) from public, anon, authenticated;
revoke execute on function public.group_stuck_tick() from public, anon, authenticated;
revoke execute on function public.kitchen_stuck_groups() from public, anon;
revoke execute on function public.kitchen_ack_stuck_group(uuid) from public, anon;
grant execute on function public.kitchen_stuck_groups() to authenticated;
grant execute on function public.kitchen_ack_stuck_group(uuid) to authenticated;
grant execute on function public.group_send_without_unpaid(text, text) to anon, authenticated;
grant execute on function public.group_lock(text, text) to anon, authenticated;
grant execute on function public.group_remove(text, uuid, text) to anon, authenticated;
