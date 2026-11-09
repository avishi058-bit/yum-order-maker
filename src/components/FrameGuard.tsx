import { useLocation } from "react-router-dom";
import type { ReactNode } from "react";

// Staff and payment screens must never render inside another site's iframe
// (clickjacking). The CSP frame-ancestors in index.html is a <meta> tag, which
// browsers ignore for framing, so this is the real guard. It only acts on the
// production hosts, so the Lovable editor preview keeps working.
const PROD_HOSTS = new Set(["habikta-burger.com", "www.habikta-burger.com", "habikta-burger.lovable.app"]);
const SENSITIVE = ["/kitchen", "/admin", "/kiosk", "/courier", "/inventory", "/station-setup", "/events/admin", "/events/kitchen", "/login"];

const framedByOtherSite = (): boolean => {
  if (typeof window === "undefined" || window.top === window.self) return false;
  try {
    // Same-origin parent is readable; a foreign parent throws.
    return window.top!.location.origin !== window.location.origin;
  } catch {
    return true;
  }
};

const FrameGuard = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const blocked =
    typeof window !== "undefined" &&
    PROD_HOSTS.has(window.location.hostname) &&
    SENSITIVE.some((p) => pathname === p || pathname.startsWith(p + "/")) &&
    framedByOtherSite();

  if (!blocked) return <>{children}</>;
  return (
    <div dir="rtl" style={{ padding: 24, textAlign: "center", fontFamily: "sans-serif" }}>
      <p>מטעמי אבטחה, הדף הזה נפתח רק ישירות באתר.</p>
      <a href={window.location.href} target="_top" rel="noopener">לפתיחה באתר</a>
    </div>
  );
};

export default FrameGuard;
