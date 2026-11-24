// "Whose burger is this?" - asked once, at checkout, and only when a take-away
// order has two burgers or more. One burger needs no name: the order's name
// is already on the bon. The chosen name rides on the cart line's ownerName
// (printed on the receipt as before).
import { menuItems } from "@/data/menu";
import type { CartItem } from "@/components/CartDrawer";

const categoryOf = new Map(menuItems.map((m) => [m.id, m.category as string]));

/** Burger or meal lines - the ones that get a name. */
export const isNameableDish = (it: CartItem): boolean => {
  const cat = categoryOf.get(it.menuItemId ?? it.id);
  return cat === "burger" || cat === "meal";
};

/** All burgers in the cart, including the ones inside deals. */
export const burgerCount = (items: CartItem[]): number =>
  items.reduce((n, it) => {
    const qty = Math.max(1, Math.floor(it.quantity || 1));
    const inDeal = it.dealBurgers?.length ?? 0;
    return n + qty * (isNameableDish(it) ? 1 : inDeal);
  }, 0);

export const needsDishOwners = (items: CartItem[], dineIn: boolean | null | undefined): boolean =>
  dineIn === false && burgerCount(items) >= 2 && items.some(isNameableDish);
