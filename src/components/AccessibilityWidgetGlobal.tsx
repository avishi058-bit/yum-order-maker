import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";

const AccessibilityWidget = lazy(() => import("./AccessibilityWidget"));

// Routes where the widget should NOT appear — internal staff / kiosk surfaces.
// Everything else is treated as a public route and gets the widget.
const INTERNAL_ROUTE_PREFIXES = [
  "/kitchen",   // covers /kitchen, /kitchen/install
  "/admin",
  "/station-setup",
  "/inventory", // token-based staff URL
  "/courier",
  "/events/admin",
  "/events/kitchen",
  "/kiosk",     // physical kiosk — staff has manual accessibility assistance
  "/login",
];

const isInternalRoute = (pathname: string) =>
  INTERNAL_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const AccessibilityWidgetGlobal = () => {
  const { pathname } = useLocation();
  if (isInternalRoute(pathname)) return null;
  return (
    <Suspense fallback={null}>
      <AccessibilityWidget />
    </Suspense>
  );
};

export default AccessibilityWidgetGlobal;
