import { menuItems, toppings, mealSideOptions, mealDrinkOptions } from "@/data/menu";
import type { CartItem } from "@/components/CartDrawer";

export const MEAL_UPGRADE_PRICE = 23;

/**
 * Returns true if the +23 meal upgrade should be charged on top of the item's
 * base price. Items that are themselves a "meal" (category === "meal") already
 * include the upgrade in their price — charging again would double-bill.
 */
export const shouldChargeMealUpgrade = (item: CartItem): boolean => {
  if (!item.withMeal) return false;
  const lookupId = item.menuItemId || item.id;
  const menuItem =
    menuItems.find((m) => m.id === lookupId) ||
    menuItems.find((m) => m.name === item.name) ||
    menuItems.find((m) => lookupId.startsWith(m.id));
  // Only burgers can be upgraded. Meals already priced as a meal => no extra.
  return menuItem?.category === "burger";
};

/** Single source of truth for per-line cart pricing (matches server logic). */
export const computeCartItemUnitPrice = (item: CartItem): number => {
  if (item.dealBurgers) return item.price; // deal price already final
  const toppingsCost = item.toppings.reduce((sum, tId) => {
    const t = toppings.find((tp) => tp.id === tId);
    return sum + (t?.price || 0);
  }, 0);
  const mealCost = shouldChargeMealUpgrade(item) ? MEAL_UPGRADE_PRICE : 0;
  const sideCost = item.mealSideId
    ? mealSideOptions.find((s) => s.id === item.mealSideId)?.price || 0
    : 0;
  const drinkCost = item.mealDrinkId
    ? mealDrinkOptions.find((d) => d.id === item.mealDrinkId)?.price || 0
    : 0;
  return item.price + toppingsCost + mealCost + sideCost + drinkCost;
};

export const computeCartItemTotal = (item: CartItem): number =>
  computeCartItemUnitPrice(item) * item.quantity;
