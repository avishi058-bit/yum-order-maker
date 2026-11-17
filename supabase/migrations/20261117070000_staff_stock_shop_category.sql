-- The owner's shopping list can group a product differently from the staff
-- page (pickles: "vegetables" for staff, bought with the sauces). Applied on
-- the live database on 17.11.2026 together with the product list changes.
alter table public.staff_stock_items add column if not exists shop_category text;
alter table public.staff_stock_items drop constraint if exists staff_stock_items_category_check;
alter table public.staff_stock_items add constraint staff_stock_items_category_check
  check (category in ('סופר', 'ירקות', 'מקרר', 'טייק אווי', 'רטבים', 'לחמניות', 'קפואים', 'קציצה', 'שתייה', 'ארכיון'));
alter table public.staff_stock_items drop constraint if exists staff_stock_items_shop_category_check;
alter table public.staff_stock_items add constraint staff_stock_items_shop_category_check
  check (shop_category is null or shop_category in ('סופר', 'ירקות', 'טייק אווי', 'רטבים', 'לחמניות', 'קפואים', 'קציצה', 'שתייה'));
