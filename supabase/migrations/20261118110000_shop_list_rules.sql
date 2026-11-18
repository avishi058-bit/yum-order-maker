-- Supermarket list rules: vegan cheddar to buy at 2 packs or fewer, eggs at
-- one tray (12) or fewer. Stock pushes open the supermarket page, and the
-- morning brief counts only what really needs buying (no supplier products,
-- counted products only at or under their alert amount).
update public.staff_stock_items set alert_below = 2 where name = 'צ׳דר טבעוני' and active;
update public.staff_stock_items set alert_below = 12 where name = 'ביצים' and active;
-- staff_portal_stock_set / staff_inventory_alert: url '/admin/shifts' -> '/admin/shifts#shop' (patched live).
-- staff_day_brief 'shopping': count only reports where supplier is null and
-- (level <> 'count' or quantity <= alert_below) (patched live).
