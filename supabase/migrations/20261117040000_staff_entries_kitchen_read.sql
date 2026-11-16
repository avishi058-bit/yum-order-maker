-- The kitchen account's dashboard counts worked hours from the name-strip clock,
-- so it may read clock entries and staff names (never link tokens).
drop policy if exists "Kitchen reads staff_time_entries" on public.staff_time_entries;
create policy "Kitchen reads staff_time_entries" on public.staff_time_entries for select to authenticated
  using (public.has_role(auth.uid(), 'kitchen'::app_role));
drop policy if exists "Kitchen reads staff_members" on public.staff_members;
create policy "Kitchen reads staff_members" on public.staff_members for select to authenticated
  using (public.has_role(auth.uid(), 'kitchen'::app_role));
