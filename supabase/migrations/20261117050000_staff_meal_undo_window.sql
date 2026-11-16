-- A meal report can be taken back only in its first 30 seconds; the add call
-- returns the new row id so the page can offer the undo right away.
drop function if exists public.staff_portal_meal_add(text, uuid);
create or replace function public.staff_portal_meal_add(p_token text, p_item_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare me public.staff_members; v_item public.staff_meal_items; v_id uuid;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  select * into v_item from public.staff_meal_items where id = p_item_id and active;
  if v_item.id is null then raise exception 'not_found'; end if;
  if (select count(*) from public.staff_meal_logs where staff_id = me.id and created_at > now() - interval '12 hours') >= 30 then
    raise exception 'too_many';
  end if;
  insert into public.staff_meal_logs(staff_id, item_name, price) values (me.id, v_item.name, v_item.price) returning id into v_id;
  return v_id;
end $$;
create or replace function public.staff_portal_meal_remove(p_token text, p_log_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me public.staff_members;
begin
  me := public.staff_member_by_token(p_token);
  if me.id is null then raise exception 'invalid_link'; end if;
  delete from public.staff_meal_logs where id = p_log_id and staff_id = me.id and created_at > now() - interval '30 seconds';
  if not found then raise exception 'not_found'; end if;
end $$;
revoke all on function public.staff_portal_meal_add(text, uuid) from public;
grant execute on function public.staff_portal_meal_add(text, uuid) to anon, authenticated;
revoke all on function public.staff_portal_meal_remove(text, uuid) from public;
grant execute on function public.staff_portal_meal_remove(text, uuid) to anon, authenticated;
