import { describe, expect, it } from "vitest";
import { zcreditSafeText } from "./zcreditText";

describe("zcreditSafeText", () => {
  it("removes Hebrew geresh and gershayim", () => {
    expect(zcreditSafeText("ג׳ני כהן")).toBe("גני כהן");
    expect(zcreditSafeText("צ״ח")).toBe("צח");
  });
  it("removes ASCII and curly quotes", () => {
    expect(zcreditSafeText("Ma'ayan \"Mimi\" O’Neil")).toBe("Maayan Mimi ONeil");
  });
  it("keeps plain names and handles empty values", () => {
    expect(zcreditSafeText("  דנה  לוי ")).toBe("דנה לוי");
    expect(zcreditSafeText(undefined)).toBe("");
  });
});
