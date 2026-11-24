import { describe, expect, it } from "vitest";
import { menuItems } from "@/data/menu";
import type { CartItem } from "@/components/CartDrawer";
import { burgerCount, dishNameMode } from "./dishOwners";

const burger = menuItems.find((m) => m.category === "burger")!;
const drink = menuItems.find((m) => m.category !== "burger" && m.category !== "meal")!;
const line = (id: string, quantity = 1, ownerName?: string): CartItem => ({
  id: `${id}-${Math.random()}`, menuItemId: id, name: id, price: 50, quantity,
  toppings: [], removals: [], withMeal: false, ownerName,
});

describe("dish name mode", () => {
  it("counts burgers by quantity and ignores other items", () => {
    expect(burgerCount([line(burger.id, 2), line(drink.id, 3)])).toBe(2);
  });
  it("1st and 2nd burger: closed button", () => {
    expect(dishNameMode([], false)).toBe("button");
    expect(dishNameMode([line(burger.id)], false)).toBe("button");
  });
  it("from the 3rd burger: open", () => {
    expect(dishNameMode([line(burger.id), line(burger.id)], false)).toBe("open");
  });
  it("skipped with no names: back to the button", () => {
    expect(dishNameMode([line(burger.id, 2)], true)).toBe("button");
  });
  it("skipped but names in use: stays open", () => {
    expect(dishNameMode([line(burger.id, 1, "דנה"), line(burger.id)], true)).toBe("open");
  });
});
