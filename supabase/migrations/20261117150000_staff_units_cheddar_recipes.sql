-- Units for paper goods, vegan cheddar counted in packs of 10 slices with an
-- alert at 3 packs, and missing order -> inventory links (drinks in meals and
-- deals, cheddar, egg, vegan patty).
update public.staff_stock_items set unit = 'גלילים' where name in ('נייר ניגוב ידיים לבחוץ', 'גליל נייר ענק');
update public.staff_stock_items set unit = 'חבילות' where name = 'שקיות ניילון';
update public.staff_stock_items set low_only = true where name = 'שקיות לפח';
update public.staff_stock_items set unit = 'דליים' where name = 'מגבונים';

-- New inventory items (counted in the site's units: slices / eggs / patties).
insert into public.inventory_items(name, category, unit, quantity)
select v.n, (select category from public.inventory_items where name like 'קציצה%' limit 1), 'unit', 0
from (values ('צ׳דר טבעוני'), ('ביצים'), ('המבורגר טבעוני')) v(n)
where not exists (select 1 from public.inventory_items i where i.name = v.n);

alter table public.staff_stock_items add column if not exists alert_below numeric;
update public.staff_stock_items s set unit = 'חבילות', inventory_item_id = i.id, inventory_factor = 10, alert_below = 3
  from public.inventory_items i where s.name = 'צ׳דר טבעוני' and i.name = 'צ׳דר טבעוני';
update public.staff_stock_items s set inventory_item_id = i.id
  from public.inventory_items i where s.name in ('ביצים', 'המבורגר טבעוני') and i.name = s.name;

-- Order item / topping / meal drink / deal drink -> inventory.
insert into public.inventory_recipes(menu_item_id, inventory_item_id, amount_per_unit)
select v.m, i.id, v.a
from (values
  ('smash-double-cheese', 'צ׳דר טבעוני', 2), ('meal-smash-double-cheese', 'צ׳דר טבעוני', 2),
  ('vegan-cheddar', 'צ׳דר טבעוני', 1), ('צ׳דר טבעוני', 'צ׳דר טבעוני', 1),
  ('egg', 'ביצים', 1), ('ביצת עין', 'ביצים', 1), ('avishai', 'ביצים', 1), ('meal-avishai', 'ביצים', 1),
  ('haf-mifsha', 'המבורגר טבעוני', 1), ('meal-haf-mifsha', 'המבורגר טבעוני', 1), ('extra-vegan-patty', 'המבורגר טבעוני', 1),
  ('deal-cola', 'פחית קולה', 1), ('fam-cola', 'פחית קולה', 1),
  ('deal-zero', 'פחית זירו', 1), ('fam-zero', 'פחית זירו', 1),
  ('deal-fanta', 'פחית פאנטה', 1), ('fam-fanta', 'פחית פאנטה', 1),
  ('can-fanta-grape', 'פחית פאנטה ענבים', 1), ('drink-fanta-grape', 'פחית פאנטה ענבים', 1), ('deal-fanta-grape', 'פחית פאנטה ענבים', 1),
  ('can-fanta-exotic', 'פחית פאנטה אקזוטי', 1), ('drink-fanta-exotic', 'פחית פאנטה אקזוטי', 1), ('deal-fanta-exotic', 'פחית פאנטה אקזוטי', 1),
  ('can-fanta-wildberry', 'פחית פאנטה פירות יער', 1), ('drink-fanta-wildberry', 'פחית פאנטה פירות יער', 1),
  ('deal-fanta-wildberry', 'פחית פאנטה פירות יער', 1), ('fam-fanta-wildberry', 'פחית פאנטה פירות יער', 1),
  ('deal-sprite', 'פחית ספרייט', 1), ('fam-sprite', 'פחית ספרייט', 1),
  ('can-sprite-zero', 'פחית ספרייט זירו', 1), ('drink-sprite-zero', 'פחית ספרייט זירו', 1), ('deal-sprite-zero', 'פחית ספרייט זירו', 1),
  ('deal-blu', 'פחית בלו', 1), ('fam-blu', 'פחית בלו', 1),
  ('deal-blu-mojito', 'פחית בלו מוחיטו', 1), ('deal-blu-day', 'פחית בלו דיי', 1), ('deal-blu-watermelon', 'פחית בלו אבטיח', 1),
  ('can-melon-apple', 'פחית בלו מלון תפוח', 1), ('drink-blu-melon-apple', 'פחית בלו מלון תפוח', 1),
  ('deal-blu-melon-apple', 'פחית בלו מלון תפוח', 1), ('fam-blu-melon-apple', 'פחית בלו מלון תפוח', 1),
  ('deal-grapes', 'בקבוק ענבים', 1), ('fam-grapes', 'בקבוק ענבים', 1),
  ('deal-oranges', 'בקבוק תפוזים', 1), ('fam-apples', 'בקבוק תפוזים', 1),
  ('water', 'מים', 1), ('drink-water', 'מים', 1), ('deal-water', 'מים', 1), ('fam-water', 'מים', 1),
  ('soda', 'פחית סודה', 1), ('drink-soda', 'פחית סודה', 1), ('deal-soda', 'פחית סודה', 1), ('fam-soda', 'פחית סודה', 1),
  ('drink-flavored-water-apple', 'מים בטעם תפוח', 1), ('deal-flavored-water-apple', 'מים בטעם תפוח', 1), ('fam-flavored-water-apple', 'מים בטעם תפוח', 1),
  ('drink-flavored-water-grape', 'מים בטעם ענבים', 1), ('deal-flavored-water-grape', 'מים בטעם ענבים', 1), ('fam-flavored-water-grape', 'מים בטעם ענבים', 1),
  ('deal-goldstar', 'בירה גולדסטאר', 1), ('fam-goldstar', 'בירה גולדסטאר', 1),
  ('deal-heineken', 'בירה הייניקן', 1), ('fam-heineken', 'בירה הייניקן', 1),
  ('deal-corona', 'בירה קורונה', 1), ('fam-corona', 'בירה קורונה', 1),
  ('deal-carlsberg', 'בירה קרלסברג', 1), ('fam-carlsberg', 'בירה קרלסברג', 1),
  ('deal-laffe', 'בירה לאף', 1), ('fam-laffe', 'בירה לאף', 1),
  ('deal-unfiltered', 'בירה גולדסטאר אנפילטר', 1), ('fam-unfiltered', 'בירה גולדסטאר אנפילטר', 1),
  ('beer-stella', 'בירה סטלה', 1), ('drink-stella', 'בירה סטלה', 1)
) v(m, n, a)
join public.inventory_items i on i.name = v.n
on conflict (menu_item_id, inventory_item_id) do nothing;
-- Sprite Zero in a meal was taking a Coke Zero.
delete from public.inventory_recipes r using public.inventory_items i
 where r.inventory_item_id = i.id and r.menu_item_id = 'drink-sprite-zero' and i.name = 'פחית זירו';

-- Alert the owner when a watched product drops to its alert level (e.g. 3 cheddar packs).
create or replace function public.staff_inventory_alert()
returns trigger language plpgsql security definer set search_path = public as $$
declare s public.staff_stock_items; v_old numeric; v_new numeric;
begin
  if new.quantity >= old.quantity then return new; end if;
  for s in select * from public.staff_stock_items where inventory_item_id = new.id and active and alert_below is not null loop
    v_old := old.quantity / coalesce(s.inventory_factor, 1);
    v_new := new.quantity / coalesce(s.inventory_factor, 1);
    continue when not (v_new <= s.alert_below and v_old > s.alert_below);
    insert into public.staff_stock_reports(item_id, level, quantity, staff_id)
    values (s.id, 'low', null, null) on conflict (item_id) where resolved_at is null do nothing;
    perform public.staff_send_messages((select coalesce(jsonb_agg(jsonb_build_object('staff_id', o.id, 'tag', 'stock-' || s.id,
      'title', 'נשאר מעט ' || s.name,
      'body', 'לפי ההזמנות נשארו בערך ' || greatest(0, floor(v_new))::text || ' ' || s.unit || '. נוסף לרשימת הקניות.',
      'url', '/admin/shifts')), '[]'::jsonb) from public.staff_members o where o.is_owner and o.active));
  end loop;
  return new;
end $$;
drop trigger if exists staff_inventory_alert on public.inventory_items;
create trigger staff_inventory_alert after update of quantity on public.inventory_items
  for each row execute function public.staff_inventory_alert();
