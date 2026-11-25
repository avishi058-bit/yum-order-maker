import { describe, expect, it } from "vitest";
import { sideSauceLabels } from "./kitchenReceipt";

describe("side sauces on the ticket", () => {
  it("marks pickled jalapeño as on the side, keeping the quantity", () => {
    expect(sideSauceLabels(["חלפניו מוחמץ ביתי"])).toEqual(["חלפניו מוחמץ ביתי - בצד"]);
    expect(sideSauceLabels(["חלפניו מוחמץ ביתי × 2"])).toEqual(["חלפניו מוחמץ ביתי - בצד × 2"]);
  });
  it("leaves other sauces as they are", () => {
    expect(sideSauceLabels(["איולי הבית × 3", "קטשופ"])).toEqual(["איולי הבית × 3", "קטשופ"]);
  });
});
