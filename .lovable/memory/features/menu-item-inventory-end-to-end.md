---
name: Menu item inventory end-to-end
description: Any new menu item must be added to menu, kitchen availability, inventory management, fridge refill, recipes, pricing, and order flow.
type: feature
---
When adding any menu item or selectable option, close it end-to-end automatically:
- Add/update menu pricing and UI metadata/images/icons.
- Add it to kitchen availability management (`menu_availability`) with the correct canonical availability id.
- Add it to inventory management (`inventory_items`) when it represents stock that staff track.
- Add inventory recipes for all relevant ids: standalone, meal/business option, deal/family-deal aliases, and any selector ids.
- Add fridge target/qty behavior when it belongs in the kitchen fridge refill screen.
- Add availability aliases/order arrays so it appears in the kitchen availability screen in the correct order.
- Verify prices, order creation, kitchen bon display, inventory deduction/restoration, and fridge pull/restore paths.

Do not treat adding a menu item as complete until the backend inventory and kitchen management surfaces are connected.