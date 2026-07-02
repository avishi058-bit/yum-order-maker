import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import "./index.css";
import { initIngredientAvailability } from "./lib/ingredientAvailability";
import { preloadSelectorIcons } from "./lib/preloadSelectorIcons";

initIngredientAvailability().catch(() => {});
preloadSelectorIcons();

// Swap manifest + apple title when on the /kitchen route so installing from
// /kitchen creates a separate "Kitchen" PWA, while / stays the customer app.
(function applyKitchenManifest() {
  if (!window.location.pathname.startsWith("/kitchen")) return;
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (link) link.href = "/kitchen.webmanifest";
  const appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) appleTitle.content = "מטבח";
  const appName = document.querySelector<HTMLMetaElement>('meta[name="application-name"]');
  if (appName) appName.content = "מטבח - הבקתה";
  document.title = "מטבח - הבקתה";
})();

// Detect standalone (installed PWA) mode and tag <html> so CSS can target it.
(function tagStandaloneMode() {
  const apply = () => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    document.documentElement.classList.toggle("pwa-installed", isStandalone);
  };
  apply();
  try {
    window.matchMedia("(display-mode: standalone)").addEventListener("change", apply);
  } catch {}
})();

// Capture the Android install prompt as EARLY as possible — before React
// mounts — otherwise Chrome may fire it before our useEffect attaches and we
// lose it forever (resulting in the manual "3 steps" fallback on /install).
(function captureInstallPrompt() {
  const w = window as unknown as { __deferredInstallPrompt?: Event };
  const handler = (e: Event) => {
    e.preventDefault();
    w.__deferredInstallPrompt = e;
    window.dispatchEvent(new CustomEvent("deferred-install-prompt-ready"));
  };
  window.addEventListener("beforeinstallprompt", handler);
})();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// Register the push-notifications service worker (production + preview).
// Skipped inside Lovable editor iframes to avoid caching issues.
if ("serviceWorker" in navigator) {
  const inIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  if (!inIframe) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[sw] registration failed", err);
      });
    });
  }
}
