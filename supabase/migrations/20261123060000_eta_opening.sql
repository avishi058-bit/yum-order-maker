-- Estimate v2: one more factor found in the history - the first hour after the
-- kitchen opens is slower beyond the plancha warm-up (about +4.7 minutes).
-- Refitted on all ~1,450 orders:
--   12.08 + 2.66 x own burgers + 0.81 x burgers in prep + 0.59 x sides in prep
--   + 3.16 cold kitchen + 2.33 website + 4.68 first hour after opening
-- The time shown to a customer is rounded to the nearest 5 minutes.
-- (Applied live; see the previous migration for the tables and the learning.)
alter table public.eta_model add column if not exists k_open numeric not null default 0;
alter table public.eta_predictions add column if not exists shown_minutes int;
update public.eta_model set icpt = 12.08, k_own_b = 2.66, k_ahead_b = 0.81, k_ahead_s = 0.59, k_cold = 3.16, k_web = 2.33, k_open = 4.68, updated_at = now() where id = 1;
-- eta_features(order) / eta_raw(features) / eta_predict / eta_record / eta_accuracy rewritten to use them.
