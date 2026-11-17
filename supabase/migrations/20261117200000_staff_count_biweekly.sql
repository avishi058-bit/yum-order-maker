-- The short stock count: every two weeks, given in quiet time (not daily).
-- Buns counted by packs of 4 plus units.
update public.staff_stock_items set pack_name = 'חבילה', pack_size = 4 where name = 'לחמניה רגילה';

create or replace function public.staff_stock_amount_text(p_item public.staff_stock_items, p_qty numeric)
returns text language plpgsql immutable as $$
declare v_one text; v_n text; v_packs int; v_rem numeric; v_fem boolean := p_item.pack_name in ('תבנית', 'חבילה');
begin
  if p_item.pack_size is not null and p_qty >= p_item.pack_size then
    v_packs := floor(p_qty / p_item.pack_size); v_rem := p_qty - v_packs * p_item.pack_size;
    return case when v_packs = 1 and v_rem = 0 then case when v_fem then 'נשארה ' else 'נשאר ' end else 'נשארו ' end
      || case when v_packs = 1 then p_item.pack_name || case when v_fem then ' אחת' else ' אחד' end
              else v_packs || ' ' || case p_item.pack_name when 'ארגז' then 'ארגזים' when 'תבנית' then 'תבניות' when 'חבילה' then 'חבילות' else p_item.pack_name end end
      || case when v_rem > 0 then ' ו-' || case when v_rem = trunc(v_rem) then trunc(v_rem)::text when v_rem < 1 then '½' else trunc(v_rem)::text || '½' end || ' ' || p_item.unit else '' end;
  end if;
  v_one := case p_item.unit when 'חבילות' then 'חבילה' when 'פחיות' then 'פחית' when 'גלילים' then 'גליל' when 'דליים' then 'דלי' else 'יחידה' end;
  v_n := case when p_qty = trunc(p_qty) then trunc(p_qty)::text else trunc(p_qty)::text || '½' end;
  return case when p_qty = 0.5 then case when p_item.unit in ('גלילים', 'דליים') then 'נשאר חצי ' else 'נשארה חצי ' end || v_one
              when p_qty = 1 then case when p_item.unit in ('גלילים', 'דליים') then 'נשאר ' || v_one || ' אחד' else 'נשארה ' || v_one || ' אחת' end
              else 'נשארו ' || v_n || ' ' || p_item.unit end;
end $$;

do $$
declare d text; n text;
begin
  -- Not every shift any more.
  d := pg_get_functiondef('public.staff_tasks_ensure(date)'::regprocedure);
  n := replace(d, '(t.kind in (''closing'', ''count'') or', '(t.kind = ''closing'' or');
  if n = d then raise exception 'staff_tasks_ensure patch failed'; end if;
  execute n;
  -- Quiet time: the count when two weeks have passed, as a count task.
  d := pg_get_functiondef('public.staff_give_idle_task()'::regprocedure);
  n := replace(d, 'select t.*, case when t.kind = ''rotating'' then',
    'select t.*, case when t.kind = ''count'' then
             (v_shift.shift_date - coalesce((select max(r.shift_date) from public.staff_task_runs r
               where r.task_id = t.id and r.done_at is not null), v_shift.shift_date - 30))::numeric / 14.0
           when t.kind = ''rotating'' then');
  n := replace(n, 'where t.active and t.kind in (''rotating'', ''idle'')', 'where t.active and t.kind in (''rotating'', ''idle'', ''count'')');
  n := replace(n, 'where c.kind = ''idle'' or c.score >= 0.5', 'where c.kind = ''idle'' or (c.kind = ''rotating'' and c.score >= 0.5) or (c.kind = ''count'' and c.score >= 1)');
  n := replace(n, 'values (v_shift.shift_date, v_task.id, v_task.title, ''idle'', ''idle'', false)',
    'values (v_shift.shift_date, v_task.id, v_task.title, case when v_task.kind = ''count'' then ''count'' else ''idle'' end, ''idle'', false)');
  if n = d or position('/ 14.0' in n) = 0 or position('''count'' then ''count''' in n) = 0 then raise exception 'staff_give_idle_task patch failed'; end if;
  execute n;
end $$;

delete from public.staff_task_runs where kind = 'count' and source = 'today' and done_at is null
  and shift_date >= (now() at time zone 'Asia/Jerusalem')::date;
