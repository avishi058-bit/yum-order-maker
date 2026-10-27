import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";

const AccessibilityWidget = lazy(() => import("./AccessibilityWidget"));

// Routes where the widget should NOT appear - internal staff / kiosk surfaces.
// Everything else is treated as a public route and gets the widget.
const INTERNAL_ROUTE_PREFIXES = [
  "/kitchen",   // covers /kitchen, /kitchen/install
  "/admin",
  "/station-setup",
  "/inventory", // token-based staff URL
  "/courier",
  "/events/admin",
  "/events/kitchen",
  "/login",
];

const isInternalRoute = (pathname: string) =>
  INTERNAL_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

// Routes that render a full-screen static page with its own built-in widget
// (same settings storage key), so the global one would only sit on top of it.
const SELF_HOSTED_WIDGET_ROUTES = ["/groups", "/en/groups"];

const AccessibilityWidgetGlobal = () => {
  const { pathname } = useLocation();
  if (isInternalRoute(pathname)) return null;
  if (SELF_HOSTED_WIDGET_ROUTES.includes(pathname.replace(/\/$/, ""))) return null;
  return (
    <Suspense fallback={null}>
      <AccessibilityWidget />
    </Suspense>
  );
};

export default AccessibilityWidgetGlobal;
