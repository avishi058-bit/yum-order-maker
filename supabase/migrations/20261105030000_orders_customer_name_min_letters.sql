-- Reject order names with fewer than 2 letters (e.g. "י"), for customers and staff alike.
-- Fires only when customer_name is set or changed, so existing rows and status updates are untouched.
create or replace function public.orders_customer_name_min_letters()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.customer_name is not null
     and (tg_op = 'INSERT' or new.customer_name is distinct from old.customer_name)
     and length(regexp_replace(new.customer_name, '[^[:alpha:]]', '', 'g')) < 2 then
    raise exception 'יש לכתוב לפחות 2 אותיות' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_customer_name_min_letters on public.orders;
create trigger orders_customer_name_min_letters
before insert or update of customer_name on public.orders
for each row execute function public.orders_customer_name_min_letters();
