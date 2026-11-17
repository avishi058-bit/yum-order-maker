-- Giant fries = 3 portions, friends mix = fries + waffle + onion rings,
-- tempura onion rings as portions, Weihenstephan (case 20) and Fuze Tea (case 24)
-- with a case added to the shopping list when fewer than 5 are left.
-- Vegetables: every count goes on the shopping list; the owner is alerted only
-- at 5 tomatoes / 5 onions / 1 lettuce or fewer.
-- The old kitchen clock's shifts move into the staff clock (one clock).
insert into public.inventory_items(name, category, unit, quantity)
select v.n, (select category from public.inventory_items where name like 'פחית קולה' limit 1), 'unit', 0
from (values ('בירה ויינשטפאן'), ('פיוז טי'), ('טבעות בצל בטמפורה')) v(n)
where not exists (select 1 from public.inventory_items i where i.name = v.n);

insert into public.inventory_recipes(menu_item_id, inventory_item_id, amount_per_unit)
select v.m, i.id, v.a from (values
  ('family-deal', 'צ׳יפס רגיל', 750), ('friends-deal', 'צ׳יפס רגיל', 750),
  ('friends-mix', 'צ׳יפס רגיל', 250), ('friends-mix', 'וופל צ׳יפס', 250), ('friends-mix', 'טבעות בצל', 250),
  ('tempura-onion', 'טבעות בצל בטמפורה', 1), ('side-tempura', 'טבעות בצל בטמפורה', 1),
  ('beer-weiss', 'בירה ויינשטפאן', 1), ('drink-weiss', 'בירה ויינשטפאן', 1),
  ('fuze-tea', 'פיוז טי', 1), ('drink-fuze-tea', 'פיוז טי', 1), ('deal-fuze-tea', 'פיוז טי', 1), ('fam-fuze-tea', 'פיוז טי', 1)
) v(m, n, a)
join public.inventory_items i on i.name = v.n
on conflict (menu_item_id, inventory_item_id) do nothing;

insert into public.staff_stock_items(name, category, shop_category, unit, step, low_only, sort_order, active,
  pack_name, pack_size, supplier, order_rule, order_below, order_target, alert_below, inventory_item_id)
select v.n, 'שתייה', 'שתייה', 'יחידות', 1, false, (select coalesce(max(sort_order), 0) + 1 from public.staff_stock_items), true,
  'ארגז', v.p, 'drinks', 'below', 4, 1, 4, (select id from public.inventory_items where name = v.n)
from (values ('בירה ויינשטפאן', 20), ('פיוז טי', 24)) v(n, p)
where not exists (select 1 from public.staff_stock_items s where s.name = v.n);

update public.staff_stock_items set alert_below = 5 where name in ('עגבניות', 'בצל סגול', 'בצל לבן');
update public.staff_stock_items set alert_below = 1 where name = 'חסה';

-- Push to the owner only when it matters: out, a little, or a count at the alert level.
create or replace function public.staff_portal_stock_set(p_token text, p_item_id uuid, p_level text, p_qty numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare me public.staff_members; v_item public.staff_stock_items; v_what text;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  select * into v_item from public.staff_stock_items where id = p_item_id and active;
  if v_item.id is null then raise exception 'not_found'; end if;
  if p_level is null then
    update public.staff_stock_reports set resolved_at = now() where item_id = p_item_id and resolved_at is null;
    return;
  end if;
  if p_level not in ('out', 'low', 'count') then raise exception 'not_found'; end if;
  if v_item.low_only and p_level <> 'low' then raise exception 'not_found'; end if;
  if p_level = 'count' and (p_qty is null or p_qty < 0 or p_qty > 9999 or mod(p_qty, v_item.step) <> 0) then raise exception 'not_found'; end if;
  if p_level = 'count' and p_qty = 0 then p_level := 'out'; end if;
  insert into public.staff_stock_reports(item_id, level, quantity, staff_id)
  values (p_item_id, p_level, case when p_level = 'count' then p_qty end, me.id)
  on conflict (item_id) where resolved_at is null
  do update set level = excluded.level, quantity = excluded.quantity, staff_id = excluded.staff_id, created_at = now();
  if p_level in ('count', 'out') then perform public.staff_stock_to_inventory(v_item, coalesce(p_qty, 0)); end if;
  if p_level = 'count' and v_item.alert_below is not null and p_qty > v_item.alert_below then return; end if;
  v_what := case p_level when 'out' then 'נגמר' when 'low' then 'נשאר קצת' else public.staff_stock_amount_text(v_item, p_qty) end;
  perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'stock-' || p_item_id,
    'title', v_what || ': ' || v_item.name,
    'body', 'דיווח של ' || me.display_name || ' · ' || v_item.category,
    'url', '/admin/shifts')), '[]'::jsonb) from public.staff_members o where o.is_owner and o.active and o.id <> me.id));
end $$;

-- One clock: the old kitchen clock's shifts become staff clock entries.
insert into public.staff_time_entries(staff_id, clock_in, clock_out)
select m.id, w.clock_in, w.clock_out from public.work_shifts w
join public.staff_members m on m.display_name = w.employee_name
where w.clock_out is not null
  and not exists (select 1 from public.staff_time_entries e where e.staff_id = m.id and abs(extract(epoch from e.clock_in - w.clock_in)) < 60);

-- Undone weekly tasks (also the owner's) move on to the next employee shift.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.staff_tasks_ensure(date)'::regprocedure);
  n := replace(d, 'and (r.kind <> ''rotating'' or v_emp)', 'and v_emp');
  if n = d then raise exception 'staff_tasks_ensure patch failed'; end if;
  execute n;
end $$;
