-- Gentle quiet-time tasks (applied live by patching the functions):
-- 15 quiet minutes counted from when the last order was finished (updated_at),
-- at most one quiet-time task every 45 minutes, no phone push to the employee
-- for quiet-time tasks, and the same 15 minutes before the closing banner.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.staff_give_idle_task()'::regprocedure);
  if position('o.updated_at > now()' in d) = 0 then
    n := replace(d, '  if not public.staff_really_quiet() then return; end if;',
      '  if not public.staff_really_quiet() then return; end if;
  if exists (select 1 from public.orders o where o.updated_at > now() - interval ''15 minutes''
             and o.status not in (''pending_payment'', ''payment_failed'', ''cancelled'')) then return; end if;');
    execute n;
  end if;
end $$;
