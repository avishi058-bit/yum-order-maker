// Warm the customer ordering flow: dynamic-import the heavy customizer/checkout
// chunks and preload the topping/doneness/ingredient icons those components
// render. Called during idle time (kiosk welcome screen, or requestIdleCallback
// on customer web) so the first customizer/checkout tap feels instant.
//
// IMPORTANT: this is purely opportunistic prefetching. It never blocks the UI,
// never re-renders anything, and silently swallows errors — if the network
// hiccups, React.lazy will just fetch on demand as a fallback.

// Customizer-specific icons that are NOT already covered by preloadSelectorIcons.
// (preloadSelectorIcons already warms sides + drinks; here we add the
// topping/doneness/ingredient bitmaps that live inside ItemCustomizer.)
import aioliImg from "@/assets/aioli-sauce.webp";
import picklesImg from "@/assets/pickles.webp";
import tomatoImg from "@/assets/tomato.webp";
import onionImg from "@/assets/onion.webp";
import mapleImg from "@/assets/maple.webp";
import garlicConfitImg from "@/assets/garlic-confit.webp";
import friedOnionImg from "@/assets/fried-onion.webp";
import onionJamImg from "@/assets/onion-jam.webp";
import extraPattyImg from "@/assets/extra-patty.webp";
import donenessMediumImg from "@/assets/doneness-medium.webp";
import donenessMediumWellImg from "@/assets/doneness-medium-well.webp";
import donenessWellDoneImg from "@/assets/doneness-well-done.webp";
import blueCheeseIcon from "@/assets/menu/blue-cheese-icon.png";
import cheddarIcon from "@/assets/menu/cheddar-icon.png";

const CUSTOMIZER_ICONS: string[] = [
  aioliImg,
  picklesImg,
  tomatoImg,
  onionImg,
  mapleImg,
  garlicConfitImg,
  friedOnionImg,
  onionJamImg,
  extraPattyImg,
  donenessMediumImg,
  donenessMediumWellImg,
  donenessWellDoneImg,
  blueCheeseIcon,
  cheddarIcon,
];

let prefetchStarted = false;

/**
 * Trigger dynamic-import of the customizer + checkout chunks and preload the
 * icons those chunks render. Idempotent — safe to call multiple times; only
 * fires once per page load.
 *
 * Returns a promise that resolves when the JS chunks are fetched. Callers may
 * ignore it (fire-and-forget is fine).
 */
export function prefetchCustomerFlow(): Promise<void> {
  if (prefetchStarted) return Promise.resolve();
  prefetchStarted = true;

  // Warm images — non-blocking, browser cache only.
  if (typeof window !== "undefined") {
    for (const src of CUSTOMIZER_ICONS) {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    }
  }

  // Prefetch component chunks. These match the React.lazy() paths in
  // Index.tsx and Kiosk.tsx — Vite dedups the same specifier so we don't
  // download twice.
  const imports: Array<Promise<unknown>> = [
    import("@/components/ItemCustomizer"),
    import("@/components/DealCustomizer"),
    import("@/components/FamilyDealCustomizer"),
    import("@/components/CheckoutForm"),
  ];

  return Promise.all(imports)
    .then(() => undefined)
    .catch(() => {
      // Prefetch failure is silent — React.lazy will retry on real use.
      prefetchStarted = false;
    });
}
