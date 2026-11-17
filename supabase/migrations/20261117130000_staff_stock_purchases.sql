-- Owner shopping: ticking a missing product asks how much was bought (or a
-- receipt photo is read). The purchase closes the report, adds to the known
-- stock (a new count when the amount left was known) and to the site's inventory.
create table if not exists public.staff_stock_purchases (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.staff_stock_items(id) on delete cascade,
  report_id uuid references public.staff_stock_reports(id) on delete set null,
  quantity numeric(8,1) not null check (quantity >= 0),
  source text not null default 'manual' check (source in ('manual', 'receipt')),
  created_at timestamptz not null default now()
);
alter table public.staff_stock_purchases enable row level security;
revoke all on public.staff_stock_purchases from anon;
grant select on public.staff_stock_purchases to authenticated;
drop policy if exists "Admin reads staff_stock_purchases" on public.staff_stock_purchases;
create policy "Admin reads staff_stock_purchases" on public.staff_stock_purchases for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

create or replace function public.staff_stock_purchase(p_report_id uuid, p_qty numeric, p_source text default 'manual')
returns void language plpgsql security definer set search_path = public as $$
declare r public.staff_stock_reports; v_item public.staff_stock_items; v_have numeric;
begin
  if not public.staff_caller_is_admin() then raise exception 'forbidden'; end if;
  select * into r from public.staff_stock_reports where id = p_report_id and resolved_at is null;
  if r.id is null then raise exception 'not_found'; end if;
  update public.staff_stock_reports set resolved_at = now() where id = r.id;
  if p_qty is null or p_qty <= 0 then return; end if;
  select * into v_item from public.staff_stock_items where id = r.item_id;
  insert into public.staff_stock_purchases(item_id, report_id, quantity, source)
  values (r.item_id, r.id, least(p_qty, 9999), case when p_source = 'receipt' then 'receipt' else 'manual' end);
  v_have := case r.level when 'out' then 0 when 'count' then r.quantity end;
  if v_have is not null then
    insert into public.staff_stock_counts(item_id, quantity, staff_id) values (r.item_id, v_have + p_qty, null);
    perform public.staff_stock_to_inventory(v_item, v_have + p_qty);
  elsif v_item.inventory_item_id is not null and (v_item.inventory_factor is not null or v_item.unit = 'יחידות') then
    update public.inventory_items set quantity = quantity + p_qty * coalesce(v_item.inventory_factor, 1) where id = v_item.inventory_item_id;
    insert into public.inventory_movements(inventory_item_id, delta, reason, note)
    values (v_item.inventory_item_id, p_qty * coalesce(v_item.inventory_factor, 1), 'staff_purchase', 'קנייה של אבישי');
  end if;
end $$;
revoke all on function public.staff_stock_purchase(uuid, numeric, text) from public, anon;
grant execute on function public.staff_stock_purchase(uuid, numeric, text) to authenticated;
