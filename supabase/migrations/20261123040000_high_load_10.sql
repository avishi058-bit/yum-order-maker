-- Busy mode: on from 10 burgers in prep, off again at 7 or fewer (history shows
-- most orders start running 30+ minutes from about 10 burgers). A manual tap in
-- the kitchen is respected for 20 minutes (on) or 30 minutes (off) before the
-- automatic mode acts again. The automatic switch marks itself with a
-- transaction-local setting so the trigger can tell it from a manual tap.
create or replace function public.restaurant_high_load_manual()
returns trigger language plpgsql as $function$
begin
  if new.high_load is distinct from old.high_load then
    if coalesce(current_setting('app.high_load_auto', true), '') = '1' then
      new.high_load_auto := new.high_load;
    else
      new.high_load_auto := false;
      new.high_load_snooze_until := now() + case when new.high_load then interval '20 minutes' else interval '30 minutes' end;
    end if;
  end if;
  return new;
end $function$;

create or replace function public.restaurant_auto_high_load()
returns void language plpgsql security definer set search_path to 'public' as $function$
declare r public.restaurant_status; n int;
begin
  select * into r from public.restaurant_status limit 1;
  if r.id is null then return; end if;
  if r.high_load_snooze_until is not null and r.high_load_snooze_until > now() then return; end if;
  n := public.kitchen_burgers_in_prep();
  perform set_config('app.high_load_auto', '1', true);
  if n >= 10 and not r.high_load then
    update public.restaurant_status set high_load = true where id = r.id;
  elsif n <= 7 and r.high_load then
    update public.restaurant_status set high_load = false where id = r.id;
  end if;
  perform set_config('app.high_load_auto', '', true);
end $function$;
