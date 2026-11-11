-- Kitchen switch for the patty weight shown to customers (220 g or 200 g).
-- Applied on 2026-11-12; kept idempotent so re-running is harmless.
alter table public.restaurant_status
  add column if not exists patty_grams smallint not null default 220
  check (patty_grams in (200, 220));
