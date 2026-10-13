import { describe, expect, it } from "vitest";
import { GROUPS_BOOKING_ENABLED, GROUPS_WHATSAPP_URL } from "./groupsContact";

describe("groups campaign contact rules", () => {
  it("disables online bookings for the groups campaign", () => {
    expect(GROUPS_BOOKING_ENABLED).toBe(false);
  });
  it("routes contact to the requested WhatsApp number", () => {
    const url = new URL(GROUPS_WHATSAPP_URL);
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/972584633555");
  });
});