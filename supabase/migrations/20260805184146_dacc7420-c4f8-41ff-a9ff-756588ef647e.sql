alter table public.orders add column if not exists dine_in boolean;

-- Backfill existing orders: assume kiosk/station orders were dine-in and website orders were takeaway.
update public.orders
set dine_in = (order_source in ('kiosk', 'station'))
where dine_in is null;

comment on column public.orders.dine_in is 'Customer dining choice: true = dine-in, false = takeaway';