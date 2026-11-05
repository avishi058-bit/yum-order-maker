-- Names the staff block from the kitchen screen ("⋯" > "חסום שם" > "כן, לחסום").
-- create-order reads this list with the service role and rejects matching customer names.
create table if not exists public.blocked_customer_names (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

alter table public.blocked_customer_names enable row level security;

create policy "Staff can view blocked names" on public.blocked_customer_names
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'kitchen'));

create policy "Staff can block names" on public.blocked_customer_names
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'kitchen'));

create policy "Admins can unblock names" on public.blocked_customer_names
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

grant select, insert, delete on public.blocked_customer_names to authenticated;
