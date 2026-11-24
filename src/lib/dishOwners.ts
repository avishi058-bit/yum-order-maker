// "Whose burger is this?" - an optional name field inside the burger sheet
// (take-away only, see ItemCustomizer). It never takes a step of its own:
// - 1st and 2nd burger: a small "רוצה להוסיף שם?" button, closed.
// - from the 3rd burger: the field is already open.
// - if the customer passed the open field empty and no burger has a name yet,
//   it goes back to the closed button for the rest of the order.
import { menuItems } from "@/data/menu";
import type { CartItem } from "@/components/CartDrawer";

const categoryOf = new Map(menuItems.map((m) => [m.id, m.category as string]));

/** Burger or meal lines - the ones that can carry a name. */
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

export const dishNameMode = (cart: CartItem[], skipped: boolean): "button" | "open" => {
  if (burgerCount(cart) < 2) return "button";
  const named = cart.some((it) => !!it.ownerName?.trim());
  return skipped && !named ? "button" : "open";
};
