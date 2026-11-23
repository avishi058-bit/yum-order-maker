// @vitest-environment-options {"url": "https://habikta-burger.com/"}
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
    functions: {
      invoke: async () => ({ data: { allowed: false, country: "US" }, error: null }),
    },
  },
}));

import GeoGate, { isGeoBypassPath } from "@/components/GeoGate";

const LOCK_TEXT = "גישה מוגבלת לישראל בלבד";

const GoToMenu = () => {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/menu")}>go to menu</button>;
};

describe("isGeoBypassPath", () => {
  it("bypasses the groups landing pages, with or without trailing slash", () => {
    expect(isGeoBypassPath("/groups")).toBe(true);
    expect(isGeoBypassPath("/groups/")).toBe(true);
    expect(isGeoBypassPath("/en/groups")).toBe(true);
    expect(isGeoBypassPath("/en/groups/")).toBe(true);
  });

  it("bypasses the static groups files", () => {
    expect(isGeoBypassPath("/groups-page/")).toBe(true);
    expect(isGeoBypassPath("/groups-page")).toBe(true);
    expect(isGeoBypassPath("/groups-page/index.html")).toBe(true);
    expect(isGeoBypassPath("/groups-page/en.html")).toBe(true);
    expect(isGeoBypassPath("/groups-tour.html")).toBe(true);
    expect(isGeoBypassPath("/groups-tour-en.html")).toBe(true);
  });

  it("keeps every other page gated", () => {
    expect(isGeoBypassPath("/")).toBe(false);
    expect(isGeoBypassPath("/kiosk")).toBe(false);
    expect(isGeoBypassPath("/groups-x")).toBe(false);
    expect(isGeoBypassPath("/groupss")).toBe(false);
    expect(isGeoBypassPath("/en/groups-x")).toBe(false);
    expect(isGeoBypassPath("/otef-aza")).toBe(false);
    expect(isGeoBypassPath("/admin/orders")).toBe(false);
  });
});

// A visitor from abroad: the geo lookup answers "not allowed".
describe("GeoGate with a foreign visitor", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the real page on /groups instead of the lock screen", async () => {
    render(
      <MemoryRouter initialEntries={["/groups"]}>
        <GeoGate><p>group lunch landing content</p></GeoGate>
      </MemoryRouter>,
    );
    expect(screen.getByText("group lunch landing content")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 120));
    expect(screen.queryByText(LOCK_TEXT)).toBeNull();
  });

  it("shows the real page on /en/groups too", async () => {
    render(
      <MemoryRouter initialEntries={["/en/groups"]}>
        <GeoGate><p>english group landing content</p></GeoGate>
      </MemoryRouter>,
    );
    expect(screen.getByText("english group landing content")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 120));
    expect(screen.queryByText(LOCK_TEXT)).toBeNull();
  });

  it("still shows the lock screen on every other page", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <GeoGate><p>home content</p></GeoGate>
      </MemoryRouter>,
    );
    expect(await screen.findByText(LOCK_TEXT)).toBeTruthy();
    expect(screen.queryByText("home content")).toBeNull();
  });

  it("locks /otef-aza as well", async () => {
    render(
      <MemoryRouter initialEntries={["/otef-aza"]}>
        <GeoGate><p>otef content</p></GeoGate>
      </MemoryRouter>,
    );
    expect(await screen.findByText(LOCK_TEXT)).toBeTruthy();
  });

  it("re-checks when leaving a groups page for a gated page", async () => {
    render(
      <MemoryRouter initialEntries={["/groups"]}>
        <GeoGate>
          <p>group lunch landing content</p>
          <GoToMenu />
        </GeoGate>
      </MemoryRouter>,
    );
    expect(screen.getByText("group lunch landing content")).toBeTruthy();
    fireEvent.click(screen.getByText("go to menu"));
    await waitFor(() => expect(screen.queryByText(LOCK_TEXT)).toBeTruthy());
  });
});
