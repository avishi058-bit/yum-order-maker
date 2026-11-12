-- Split payments at the kiosk terminal: every card charge of an order is one
-- row. An order moves to the kitchen only once the rows cover its total.
-- Written only by the pinpad-charge edge function (service role).
create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  transaction_id text,
  reference text,
  invoice_number text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists order_payments_order_id_idx on public.order_payments(order_id);

alter table public.order_payments enable row level security;
revoke all on public.order_payments from anon, authenticated;
grant select on public.order_payments to authenticated;

drop policy if exists "Staff can read order payments" on public.order_payments;
create policy "Staff can read order payments" on public.order_payments
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'kitchen'::app_role));
