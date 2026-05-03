import { toppings as staticToppings, type Topping } from "@/data/menu";
import { getCustomToppings } from "@/lib/customToppingsStore";

export const getAllToppings = (): Topping[] => [...staticToppings, ...getCustomToppings()];

export const findTopping = (id: string): Topping | undefined =>
  staticToppings.find((t) => t.id === id) || getCustomToppings().find((t) => t.id === id);
