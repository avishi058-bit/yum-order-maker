-- Group orders: an organizer opens a group and shares a link; everyone picks
-- their own meal and pays for it (credit). Each person's order is a normal
-- order (its own payment and invoice), tied to the group and held away from
-- the kitchen (group_hold) until the organizer closed the group and every
-- order in it is paid. Then all are released together, with one bon number,
-- and the kitchen screen shows them as one order.

create table if not exists public.order_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  organizer_name text not null,
  secret_hash text not null,
  dine_in boolean not null default false,
  status text not null default 'open' check (status in ('open', 'locked', 'sent', 'cancelled')),
  created_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz
);
alter table public.order_groups enable row level security;

create table if not exists public.order_group_members (
  order_id uuid primary key references public.orders(id) on delete cascade,
  group_id uuid not null references public.order_groups(id) on delete cascade,
  name text not null,
  token_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists order_group_members_group on public.order_group_members (group_id);
alter table public.order_group_members enable row level security;

alter table public.orders add column if not exists group_id uuid references public.order_groups(id);
alter table public.orders add column if not exists group_hold boolean not null default false;

create or replace function public.group_token() returns text language sql volatile set search_path to 'public', 'extensions' as $f$
  select encode(gen_random_bytes(18), 'hex');
$f$;
create or replace function public.group_hash(t text) returns text language sql immutable set search_path to 'public', 'extensions' as $f$
  select encode(digest(coalesce(t, ''), 'sha256'), 'hex');
$f$;

-- Organizer opens a group. Returns the share code and the organizer's secret.
create or replace function public.group_create(p_name text, p_dine_in boolean)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare v_code text; v_secret text := public.group_token(); n int := 0;
begin
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'name_required'; end if;
  loop
    v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6));
    exit when not exists (select 1 from public.order_groups where code = v_code);
    n := n + 1; if n > 10 then raise exception 'code_failed'; end if;
  end loop;
  insert into public.order_groups (code, organizer_name, secret_hash, dine_in)
  values (v_code, left(trim(p_name), 40), public.group_hash(v_secret), coalesce(p_dine_in, false));
  return jsonb_build_object('code', v_code, 'secret', v_secret);
end $f$;

-- Everything the group page shows. Everyone with the link sees who paid.
create or replace function public.group_get(p_code text)
returns jsonb language sql stable security definer set search_path to 'public' as $f$
  select jsonb_build_object(
    'code', g.code, 'organizer', g.organizer_name, 'dine_in', g.dine_in, 'status', g.status,
    'created_at', g.created_at, 'sent_at', g.sent_at,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_id', o.id, 'name', m.name, 'total', o.total,
        'state', case when o.status = 'pending_payment' then 'unpaid'
                      when o.status in ('cancelled', 'payment_failed') then 'removed'
                      else 'paid' end,
        'items', (select jsonb_agg(jsonb_build_object('name', oi.item_name, 'qty', oi.quantity) order by oi.created_at)
                  from public.order_items oi where oi.order_id = o.id)
      ) order by m.created_at)
      from public.order_group_members m join public.orders o on o.id = m.order_id
      where m.group_id = g.id and o.status not in ('cancelled', 'payment_failed')), '[]'::jsonb)
  ) from public.order_groups g where g.code = upper(trim(p_code));
$f$;

-- A member's order joins the group (called right after create-order, before
-- the payment page). Returns a member token that lets this person remove
-- their own unpaid dish.
create or replace function public.group_attach(p_code text, p_order uuid, p_name text)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare g public.order_groups; o public.orders; v_token text := public.group_token();
begin
  select * into g from public.order_groups where code = upper(trim(p_code)) for update;
  if g.id is null then raise exception 'group_not_found'; end if;
  if g.status <> 'open' then raise exception 'group_closed'; end if;
  select * into o from public.orders where id = p_order;
  if o.id is null or o.status <> 'pending_payment' or o.created_at < now() - interval '30 minutes' or o.group_id is not null then
    raise exception 'order_not_attachable';
  end if;
  update public.orders set group_id = g.id, group_hold = true where id = p_order;
  insert into public.order_group_members (order_id, group_id, name, token_hash)
  values (p_order, g.id, left(trim(coalesce(nullif(p_name, ''), o.customer_name)), 40), public.group_hash(v_token));
  return jsonb_build_object('ok', true, 'member_token', v_token);
end $f$;

-- Release: when the group is closed and nothing in it waits for payment,
-- all its paid orders go to the kitchen together with one bon number.
create or replace function public.group_try_release(p_group uuid)
returns boolean language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare g public.order_groups; v_bon int; v_first uuid; r record;
begin
  select * into g from public.order_groups where id = p_group for update;
  if g.id is null or g.status <> 'locked' then return false; end if;
  if exists (select 1 from public.orders where group_id = g.id and status = 'pending_payment') then return false; end if;
  select min(bon_queue_number) into v_bon from public.orders where group_id = g.id and status not in ('cancelled', 'payment_failed');
  select id into v_first from public.orders where group_id = g.id and status = 'new' order by created_at limit 1;
  if v_first is null then
    update public.order_groups set status = 'cancelled' where id = g.id;
    return false;
  end if;
  update public.orders set group_hold = false, bon_queue_number = coalesce(v_bon, bon_queue_number)
   where group_id = g.id and status not in ('cancelled', 'payment_failed');
  update public.order_groups set status = 'sent', sent_at = now() where id = g.id;
  -- What a normal paid order gets on arrival: estimate, and one kitchen push.
  for r in select id from public.orders where group_id = g.id and status = 'new' order by created_at loop
    begin perform public.eta_record(r.id); exception when others then null; end;
  end loop;
  begin
    perform net.http_post(
      url := 'https://kdkcygokopwvutwvrgnp.supabase.co/functions/v1/notify-kitchen-new-order',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', public.get_webhook_secret()),
      body := jsonb_build_object('order_id', v_first::text));
  exception when others then null; end;
  return true;
end $f$;

-- Organizer: "everyone's in".
create or replace function public.group_lock(p_code text, p_secret text)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare g public.order_groups; v_sent boolean;
begin
  select * into g from public.order_groups where code = upper(trim(p_code)) for update;
  if g.id is null or g.secret_hash <> public.group_hash(p_secret) then raise exception 'not_organizer'; end if;
  if g.status = 'open' then
    if not exists (select 1 from public.orders where group_id = g.id and status not in ('cancelled', 'payment_failed')) then
      raise exception 'group_empty';
    end if;
    update public.order_groups set status = 'locked', locked_at = now() where id = g.id;
  end if;
  v_sent := public.group_try_release(g.id);
  return jsonb_build_object('ok', true, 'sent', v_sent);
end $f$;

-- Remove an unpaid dish: the organizer, or the person who ordered it.
create or replace function public.group_remove(p_code text, p_order uuid, p_secret text)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare g public.order_groups; m public.order_group_members;
begin
  select * into g from public.order_groups where code = upper(trim(p_code));
  select * into m from public.order_group_members where order_id = p_order and group_id = g.id;
  if g.id is null or m.order_id is null then raise exception 'not_found'; end if;
  if g.secret_hash <> public.group_hash(p_secret) and m.token_hash <> public.group_hash(p_secret) then
    raise exception 'not_allowed';
  end if;
  update public.orders set status = 'cancelled' where id = p_order and status = 'pending_payment';
  if not found then raise exception 'not_unpaid'; end if;
  perform public.group_try_release(g.id);
  return jsonb_build_object('ok', true);
end $f$;

-- Paying for someone else: what the payment page needs for that unpaid order.
create or replace function public.group_pay_info(p_code text, p_order uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $f$
  select jsonb_build_object('order_id', o.id, 'total', o.total, 'name', o.customer_name, 'phone', o.customer_phone)
  from public.orders o join public.order_groups g on g.id = o.group_id
  where g.code = upper(trim(p_code)) and o.id = p_order and o.status = 'pending_payment';
$f$;

-- Any status change of a group order (paid, removed) may complete the group.
create or replace function public.group_on_order_status()
returns trigger language plpgsql security definer set search_path to 'public' as $f$
begin
  if new.group_id is not null and new.status is distinct from old.status then
    begin perform public.group_try_release(new.group_id); exception when others then null; end;
  end if;
  return null;
end $f$;
drop trigger if exists group_on_order_status on public.orders;
create trigger group_on_order_status after update of status on public.orders
  for each row execute function public.group_on_order_status();

-- Held group orders stay out of the kitchen's push, re-ping, estimate and load.
create or replace function public.notify_kitchen_new_order()
returns trigger language plpgsql security definer set search_path to 'public', 'extensions' as $function$
BEGIN
  IF NEW.status IS DISTINCT FROM 'new' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'new' THEN
    RETURN NEW;
  END IF;
  -- Group orders are announced once, when the whole group is released.
  IF NEW.group_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://kdkcygokopwvutwvrgnp.supabase.co/functions/v1/notify-kitchen-new-order',
    headers := jsonb_build_object('Content-Type','application/json','x-internal-secret', public.get_webhook_secret()),
    body := jsonb_build_object('order_id', NEW.id::text)
  );
  RETURN NEW;
END;
$function$;

create or replace function public.reping_kitchen_for_pending_orders()
returns void language plpgsql security definer set search_path to 'public', 'extensions' as $function$
DECLARE
  rec RECORD;
  v_secret text := public.get_webhook_secret();
BEGIN
  FOR rec IN
    SELECT id FROM public.orders
    WHERE status = 'new' AND created_at > now() - interval '30 minutes' AND NOT group_hold
      -- one ping per released group, not one per person
      AND (group_id IS NULL OR id = (SELECT o2.id FROM public.orders o2
             WHERE o2.group_id = orders.group_id AND o2.status = 'new' ORDER BY o2.created_at LIMIT 1))
  LOOP
    PERFORM net.http_post(
      url := 'https://kdkcygokopwvutwvrgnp.supabase.co/functions/v1/notify-kitchen-new-order',
      headers := jsonb_build_object('Content-Type','application/json','x-internal-secret', v_secret),
      body := jsonb_build_object('order_id', rec.id::text, 'repeat', true)
    );
  END LOOP;
END;
$function$;

create or replace function public.kitchen_burgers_in_prep()
returns integer language sql stable security definer set search_path to 'public' as $function$
  select coalesce(sum(case
      when jsonb_typeof(oi.deal_burgers) = 'array' and jsonb_array_length(oi.deal_burgers) > 0
        then jsonb_array_length(oi.deal_burgers) * oi.quantity
      when oi.item_id like 'meal-%' or oi.item_id in ('classic','avishai','crazy-smash','napoleon','smash-double-cheese',
        'smash-moshavnikim','special-hadegel','double','haf-mifsha','crispy-chicken','arayes-special','arayes-special-4')
        then oi.quantity
      else 0 end), 0)::int
  from public.orders o join public.order_items oi on oi.order_id = o.id
  where o.status in ('new', 'preparing') and not o.group_hold
    and (o.scheduled_for is null or o.scheduled_for <= now() + interval '20 minutes');
$function$;

create or replace function public.eta_on_order_new()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  -- Held group orders get their estimate when the group is released.
  if new.status = 'new' and not new.group_hold and (tg_op = 'INSERT' or old.status is distinct from 'new') then
    begin
      perform public.eta_record(new.id);
    exception when others then
      null;
    end;
  end if;
  return null;
end $function$;

revoke execute on function public.group_try_release(uuid) from public, anon, authenticated;
revoke execute on function public.group_on_order_status() from public, anon, authenticated;
grant execute on function public.group_create(text, boolean) to anon, authenticated;
grant execute on function public.group_get(text) to anon, authenticated;
grant execute on function public.group_attach(text, uuid, text) to anon, authenticated;
grant execute on function public.group_lock(text, text) to anon, authenticated;
grant execute on function public.group_remove(text, uuid, text) to anon, authenticated;
grant execute on function public.group_pay_info(text, uuid) to anon, authenticated;
