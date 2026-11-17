-- Payment requests: the owner sets an amount in his staff app and sends the
-- link; the customer enters a name and email and pays through the site's
-- usual Z-Credit checkout (create-payment / payment-callback, with the tax
-- invoice Z-Credit issues). Each request is an order that never reaches the
-- kitchen (closed as soon as it is paid), so it counts in the business's sales.
alter table public.orders add column if not exists payment_request boolean not null default false;

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(10,2) not null check (amount between 1 and 50000),
  description text check (description is null or length(description) <= 120),
  customer_email text check (customer_email is null or length(customer_email) <= 255),
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
alter table public.payment_requests enable row level security;
revoke all on public.payment_requests from anon;
grant select on public.payment_requests to authenticated;
drop policy if exists "Admin reads payment_requests" on public.payment_requests;
create policy "Admin reads payment_requests" on public.payment_requests for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

-- Paid requests close at once (never shown in the kitchen), like donation-only orders.
create or replace function public.close_paid_donation_only()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if (new.donation_only or new.payment_request) and new.status = 'new' then
    new.status := 'completed';
  end if;
  return new;
end $$;

do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.assign_bon_queue_number()'::regprocedure);
  n := replace(d, 'IF NEW.status = ''pending_payment'' OR COALESCE(NEW.donation_only, false) THEN',
                  'IF NEW.status = ''pending_payment'' OR COALESCE(NEW.donation_only, false) OR COALESCE(NEW.payment_request, false) THEN');
  if n = d then raise exception 'assign_bon_queue_number patch failed'; end if;
  execute n;
end $$;

create or replace function public.staff_owner_payreq_create(p_token text, p_amount numeric, p_description text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me public.staff_members; v_order uuid; v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  me := public.staff_owner_by_token(p_token);
  if p_amount is null or p_amount < 1 or p_amount > 50000 then raise exception 'invalid_amount'; end if;
  insert into public.orders(customer_name, customer_phone, total, status, payment_method, payment_request, order_source, notes)
  values ('דרישת תשלום', '-', round(p_amount, 2), 'pending_payment', 'credit', true, 'payment_request', nullif(btrim(left(coalesce(p_description, ''), 120)), ''))
  returning id into v_order;
  insert into public.payment_requests(token, order_id, amount, description)
  values (v_token, v_order, round(p_amount, 2), nullif(btrim(left(coalesce(p_description, ''), 120)), ''));
  return jsonb_build_object('token', v_token);
end $$;

create or replace function public.staff_owner_payreqs(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.staff_owner_by_token(p_token);
  return (select coalesce(jsonb_agg(jsonb_build_object('token', r.token, 'amount', r.amount, 'description', r.description,
      'created_at', r.created_at, 'name', case when o.customer_name = 'דרישת תשלום' then null else o.customer_name end,
      'paid_at', o.paid_at, 'status', o.status) order by r.created_at desc), '[]'::jsonb)
    from (select * from public.payment_requests order by created_at desc limit 15) r join public.orders o on o.id = r.order_id);
end $$;

-- The customer's page.
create or replace function public.payreq_get(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r public.payment_requests; o public.orders;
begin
  select * into r from public.payment_requests where token = p_token;
  if r.id is null then return null; end if;
  select * into o from public.orders where id = r.order_id;
  return jsonb_build_object('amount', r.amount, 'description', r.description,
    'paid', o.paid_at is not null or o.status in ('new', 'completed'), 'failed', o.status = 'payment_failed');
end $$;

create or replace function public.payreq_start(p_token text, p_name text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.payment_requests; o public.orders; v_name text := btrim(coalesce(p_name, '')); v_email text := lower(btrim(coalesce(p_email, '')));
begin
  select * into r from public.payment_requests where token = p_token;
  if r.id is null then raise exception 'not_found'; end if;
  if length(v_name) not between 2 and 80 then raise exception 'invalid_name'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 255 then raise exception 'invalid_email'; end if;
  select * into o from public.orders where id = r.order_id;
  -- A failed attempt can be tried again.
  if o.status = 'payment_failed' then
    update public.orders set status = 'pending_payment', payment_session_id = null where id = o.id;
  elsif o.status <> 'pending_payment' then
    raise exception 'already_paid';
  end if;
  update public.orders set customer_name = v_name where id = o.id;
  update public.payment_requests set customer_email = v_email where id = r.id;
  return jsonb_build_object('order_id', o.id, 'total', o.total, 'name', v_name, 'email', v_email);
end $$;
revoke all on function public.staff_owner_payreq_create(text, numeric, text), public.staff_owner_payreqs(text),
  public.payreq_get(text), public.payreq_start(text, text, text) from public;
grant execute on function public.staff_owner_payreq_create(text, numeric, text), public.staff_owner_payreqs(text),
  public.payreq_get(text), public.payreq_start(text, text, text) to anon, authenticated;

-- The owner hears as soon as a request is paid.
create or replace function public.payreq_paid_notice()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.payment_requests;
begin
  if not new.payment_request or new.paid_at is null or old.paid_at is not null then return new; end if;
  update public.payment_requests set notified_at = now() where order_id = new.id and notified_at is null returning * into r;
  if r.id is null then return new; end if;
  perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', m.id, 'tag', 'payreq-' || r.id,
    'title', 'התקבל תשלום: ' || to_char(r.amount, 'FM999G990D00') || ' ₪',
    'body', coalesce(new.customer_name, '') || coalesce(' · ' || r.description, '') || coalesce(' · ' || r.customer_email, ''),
    'url', '/staff/')), '[]'::jsonb) from public.staff_members m where m.is_owner and m.active));
  return new;
end $$;
drop trigger if exists payreq_paid_notice on public.orders;
create trigger payreq_paid_notice after update of paid_at on public.orders
  for each row when (new.payment_request) execute function public.payreq_paid_notice();
