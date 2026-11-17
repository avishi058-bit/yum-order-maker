-- The owner's closing checklist: "קידום סגירה" (when there are no customers)
-- and "סדר סגירה" (in order). Duplicates merged; quiet-time and weekly tasks
-- that are now daily closing tasks are retired. Patties for tomorrow: 45.
alter table public.staff_tasks add column if not exists section text;
alter table public.staff_task_runs add column if not exists section text;
alter table public.staff_task_runs add column if not exists sort_order int;

update public.staff_tasks set active = false
 where active and ((kind = 'idle' and title in ('לנקות את הדק', 'לנקות שולחנות', 'למלא רטבים', 'לטאטא בחוץ', 'למלא פחיות במקרר', 'לנקות חלונות', 'לסדר בחוץ'))
   or (kind = 'weekly' and title in ('לנקות חלונות', 'לטאטא את הדק בחוץ')));

insert into public.staff_tasks(title, kind, section, sort_order)
select v.t, 'closing', v.s, v.o from (values
  ('לנקות שולחנות בחוץ ולוודא שהכל בחוץ מסודר ומוכן ללקוחות', 'קידום סגירה', 101),
  ('לטאטא בחוץ את הדק', 'קידום סגירה', 102),
  ('לנקות חלונות - שפריצר ונייר', 'קידום סגירה', 103),
  ('לנקות את מקרר השתייה - שפריצר כחול', 'קידום סגירה', 104),
  ('לעבור עם מגבון על כל הסקוויזרים - להוריד שומניות', 'קידום סגירה', 105),
  ('לנקות את קיר הנירוסטה מאחורי הפלנצ׳ה - שפכטל, מגבונים ואז נייר עד שמבריק', 'קידום סגירה', 106),
  ('לנקות את הקירות הקטנים של הפלנצ׳ה', 'קידום סגירה', 107),
  ('למלא ציוד טייק אווי - קופסאות לצ׳יפס, שקיות, מגשים (אם חסר)', 'קידום סגירה', 108),
  ('למלא רטבים בסקוויזרים', 'קידום סגירה', 109),
  ('למלא קוקוטים - שזיפים וצ׳ילי חריף', 'קידום סגירה', 110),
  ('למלא קופסאות מיונז וקטשופ', 'קידום סגירה', 111),
  ('לוודא שיש מינימום: 10 עגבניות, 5 בצל, 2 חבילות חסה', 'קידום סגירה', 112),
  ('למלא שתייה במקרר', 'סדר סגירה', 201),
  ('לשטוף כלים (אפשר להתחיל קודם - להשאיר מלקחיים, קערה לצ׳יפס ושפכטל עד הסגירה)', 'סדר סגירה', 202),
  ('לטאטא את הבקתה בפנים', 'סדר סגירה', 203),
  ('להכניס ירקות, ריבת בצל, קונפי שום וכו׳', 'סדר סגירה', 204),
  ('לנקות את שולחנות הנירוסטה בבקתה', 'סדר סגירה', 205),
  ('להכניס את הכלים לייבוש', 'סדר סגירה', 206),
  ('להוציא לחמניות להפשרה למחר - להשלים ל-40 (פיפו: ישן למעלה, חדש למטה ומאחורה)', 'סדר סגירה', 207),
  ('לעדכן חוסרים בלשונית מלאי - שתייה, לחמניות, קציצות', 'סדר סגירה', 209),
  ('לדווח במלאי כשנשאר מעט: צ׳דר (פחות מ-5 חבילות), חמוצים (פחית אחרונה), מיונז (2 דליים), שזיפים (ג׳ריקן)', 'סדר סגירה', 209),
  ('לוודא שהצ׳יפסר והפלנצ׳ה כבויים עד הסוף', 'סדר סגירה', 210),
  ('לוודא שהמקפיא במחסן סגור', 'סדר סגירה', 211),
  ('לוודא שהלחמניות סגורות היטב', 'סדר סגירה', 212),
  ('לפנות פחים ולשים שקיות חדשות', 'סדר סגירה', 213),
  ('דוח Z (סגירת קופה)', 'סדר סגירה', 214),
  ('מזומן של היום בשקית עם סכום, תאריך ושם העובד (סגירה אחרי 12 בלילה = התאריך של אתמול)', 'סדר סגירה', 215),
  ('לעדכן את אבישי על חוסרים או עודפים בכסף, אם יש', 'סדר סגירה', 216),
  ('הצהרת פתיחת קופה למחר', 'סדר סגירה', 217),
  ('להטעין בוקסה וטאבלט', 'סדר סגירה', 218),
  ('לכבות אורות - בקתה, בפנים, בחוץ, שירותים, מחסנים, בית מלאכה', 'סדר סגירה', 219),
  ('לכבות קופה ומסך (אחרי לחיצה על יציאה)', 'סדר סגירה', 220),
  ('לנעול', 'סדר סגירה', 221)
) v(t, s, o)
where not exists (select 1 from public.staff_tasks x where x.active and x.title = v.t);

create or replace function public.staff_patty_text(p_date date)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_hours jsonb; d int; v_day date; v_sp public.staff_special_days; v_open boolean;
begin
  select business_hours into v_hours from public.site_settings order by created_at limit 1;
  for d in 1..7 loop
    v_day := p_date + d;
    select * into v_sp from public.staff_special_days where day = v_day;
    v_open := coalesce((v_hours -> (extract(dow from v_day)::int)::text ->> 'open')::boolean, false) and v_sp.closed is not true;
    if v_open then
      if d > 2 then return 'לוודא עם אבישי כמה קציצות להוציא למחר'; end if;
      return 'להוציא קציצות להפשרה ל' || case when d = 1 then 'מחר' else public.staff_day_label(v_day) end || ' - להשלים ל-' ||
             case when extract(dow from p_date) = 4 then 70 else 45 end || ' יחידות';
    end if;
  end loop;
  return 'לוודא עם אבישי כמה קציצות להוציא למחר';
end $$;

create or replace function public.staff_tasks_ensure(p_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.staff_task_runs(shift_date, task_id, title, kind, source, at_opening, section, sort_order)
  select p_date, t.id, t.title, t.kind, 'today', t.at_opening, t.section, t.sort_order from public.staff_tasks t
  where t.active and (t.kind in ('closing', 'count') or t.weekday = extract(dow from p_date)::int)
  on conflict (shift_date, task_id) where task_id is not null do nothing;

  if not exists (select 1 from public.staff_task_runs where shift_date = p_date and kind = 'patties') then
    insert into public.staff_task_runs(shift_date, task_id, title, kind, source, section, sort_order)
    values (p_date, null, public.staff_patty_text(p_date), 'patties', 'today', 'סדר סגירה', 208);
  end if;

  insert into public.staff_task_runs(shift_date, task_id, title, kind, source, supplier)
  select p_date, null, 'ספירת ' || s.name || ' לספק' ||
         coalesce(' - אספקה ביום ' || public.staff_weekday_name(s.delivery_weekday), '') ||
         case when s.count_required then ' (חובה לפני יציאה)' else '' end,
         'supplier_count', 'today', s.id
  from public.staff_suppliers s
  where s.count_weekday = extract(dow from p_date)::int
    and not exists (select 1 from public.staff_task_runs x where x.shift_date = p_date and x.kind = 'supplier_count' and x.supplier = s.id)
    and public.staff_supplier_needs_count(s.id);

  -- Weekly tasks left undone move to the next shift (daily closing tasks come back anyway).
  with old as (
    update public.staff_task_runs r set carried = true
    where r.shift_date < p_date and r.done_at is null and not r.carried and r.kind not in ('count', 'idle', 'patties', 'supplier_count', 'closing')
      and not exists (select 1 from public.staff_task_runs x where x.shift_date = p_date and x.task_id = r.task_id)
    returning r.task_id, r.title, r.kind, r.at_opening
  )
  insert into public.staff_task_runs(shift_date, task_id, title, kind, source, at_opening)
  select p_date, task_id, title, kind, 'carry', at_opening from old
  on conflict (shift_date, task_id) where task_id is not null do nothing;
end $$;

-- Tasks in checklist order, with their section.
create or replace function public.staff_tasks_json(p_date date)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'kind', r.kind, 'source', r.source,
      'at_opening', r.at_opening, 'done', r.done_at is not null, 'section', r.section,
      'items', case r.kind
        when 'supplier_count' then (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'unit', i.unit, 'step', i.step,
              'pack_name', i.pack_name, 'pack_size', i.pack_size) order by i.sort_order, i.name), '[]'::jsonb)
            from public.staff_stock_items i where i.active and not i.low_only and i.supplier = r.supplier)
        when 'count' then (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'unit', i.unit, 'step', i.step,
              'pack_name', i.pack_name, 'pack_size', i.pack_size)), '[]'::jsonb)
            from (select * from public.staff_stock_items where active and not low_only and category in ('קפואים', 'לחמניות')
                  order by md5(id::text || p_date::text) limit 4) i)
        end)
    order by (r.section is not null), (r.kind = 'supplier_count') desc, r.at_opening desc, (r.source = 'idle') desc,
             coalesce(r.sort_order, 0), r.created_at), '[]'::jsonb)
  from public.staff_task_runs r where r.shift_date = p_date
$$;

-- Today's runs created before this change: give the patty task its place.
update public.staff_task_runs set section = 'סדר סגירה', sort_order = 208,
  title = public.staff_patty_text(shift_date)
 where kind = 'patties' and done_at is null and shift_date >= (now() at time zone 'Asia/Jerusalem')::date - 1;
