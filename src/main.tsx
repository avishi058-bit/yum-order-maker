import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import "./index.css";

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
