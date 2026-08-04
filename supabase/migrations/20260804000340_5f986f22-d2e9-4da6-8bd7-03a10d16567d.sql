update public.inventory_recipes r
set amount_per_unit = 2, updated_at = now()
from public.inventory_items i
where i.id = r.inventory_item_id
  and i.name = 'חזה עוף קריספי'
  and r.menu_item_id in ('crispy-chicken','meal-crispy-chicken');