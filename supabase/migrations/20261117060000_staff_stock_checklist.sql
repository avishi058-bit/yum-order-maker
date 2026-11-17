-- Stock reports become a shopping checklist: products grouped as the owner
-- buys them (supermarket, takeaway supplies, sauces, rolls, frozen, burger,
-- drinks), and an employee can report units left as well as "a little" or
-- "ran out". Applied on the live database on 17.11.2026; the product list is
-- data and is managed from /admin/shifts.
alter table public.staff_stock_items drop constraint if exists staff_stock_items_category_check;
alter table public.staff_stock_items add constraint staff_stock_items_category_check
  check (category in ('סופר', 'טייק אווי', 'רטבים', 'לחמניות', 'קפואים', 'המבורגר', 'שתייה', 'ארכיון'));
alter table public.staff_stock_reports drop constraint if exists staff_stock_reports_level_check;
alter table public.staff_stock_reports add constraint staff_stock_reports_level_check check (level in ('out', 'low', 'count'));
alter table public.staff_stock_reports add column if not exists quantity int check (quantity is null or quantity between 0 and 999);

create or replace function public.staff_stock_json()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'category', i.category,
           'level', r.level, 'quantity', r.quantity) order by i.sort_order, i.name), '[]'::jsonb)
  from public.staff_stock_items i
  left join public.staff_stock_reports r on r.item_id = i.id and r.resolved_at is null
  where i.active
$$;

drop function if exists public.staff_portal_stock_set(text, uuid, text);
create or replace function public.staff_portal_stock_set(p_token text, p_item_id uuid, p_level text, p_qty int default null)
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
  if p_level = 'count' and (p_qty is null or p_qty < 0 or p_qty > 999) then raise exception 'not_found'; end if;
  if p_level = 'count' and p_qty = 0 then p_level := 'out'; end if;
  insert into public.staff_stock_reports(item_id, level, quantity, staff_id)
  values (p_item_id, p_level, case when p_level = 'count' then p_qty end, me.id)
  on conflict (item_id) where resolved_at is null
  do update set level = excluded.level, quantity = excluded.quantity, staff_id = excluded.staff_id, created_at = now();
  v_what := case p_level when 'out' then 'נגמר' when 'low' then 'נשאר קצת' else 'נשארו ' || p_qty end;
  perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'stock-' || p_item_id,
    'title', v_what || ': ' || v_item.name,
    'body', 'דיווח של ' || me.display_name || ' · ' || v_item.category,
    'url', '/admin/shifts')), '[]'::jsonb) from public.staff_members o where o.is_owner and o.active and o.id <> me.id));
end $$;
revoke all on function public.staff_stock_json() from public, anon, authenticated;
revoke all on function public.staff_portal_stock_set(text, uuid, text, int) from public;
grant execute on function public.staff_portal_stock_set(text, uuid, text, int) to anon, authenticated;
