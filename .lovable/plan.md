# Kiosk Preload Intent — Corrected Findings

Read-only re-investigation. Two important corrections to prior reports.

---

## 1. Preload logic — YES, kiosk-intentional (but wider than I first thought)

Two separate preload systems exist:

**A. `preloadSelectorIcons()` — `src/main.tsx:9`**
Runs on **every app boot** (customer, kiosk, admin — anyone loading the SPA), scheduled via `requestIdleCallback`. Preloads ~30 files: sides + drinks. Comment in the file:
> *"Preload all drink and side (fries/onion) selector icons at app startup so that by the time the user opens the drink or side picker the images are already in the browser cache and appear instantly."*

Purpose is universal "instant selector open," not kiosk-specific.

**B. Kiosk mount preload — `src/pages/Kiosk.tsx:136-163`**
Explicit block preloads **all `menuImages`** (burger tiles, meal tiles, drink tiles) using `new Image()` + `img.decode()`, tracked with an `imagesReady` flag. If the customer taps "התחל הזמנה" before decoding completes, the tap is **queued** (`pendingStart`) and auto-advances the view once ready. Comment:
> *"Preload + decode all menu images on kiosk mount (runs during the Welcome screen too, since this component mounts immediately). By the time the user taps 'התחל הזמנה' the bitmaps are already in memory & decoded — no progressive flicker, no layout settle, no scroll jump."*

Your recollection is exactly right — this is a deliberate kiosk-UX guarantee. `KioskWelcome` is even wrapped in `React.memo` with a stability comment saying it must not re-render during idle.

**What is NOT preloaded today:** the customizer-only topping/doneness/ingredient icons (extra-patty, onion-jam, garlic-confit, doneness-*, tomato, pickles, maple, aioli, onion, fried-onion). Those are pulled in as eager `import`s inside `ItemCustomizer.tsx` (46 imports). The browser only fetches them when React first renders an `<img>` (i.e., when someone opens the customizer). Today that's fine because ItemCustomizer's JS is in the initial bundle, so the images are known to the browser very early.

---

## 2. "Dead PNGs" — corrected, but the conclusion still holds

The prior report used `rg "<basename>.png|<basename>.jpe?g"` which correctly showed no imports of the `.png` versions. What I missed to explain: **the same base names ARE imported, but as `.webp`**. Verified for every file I flagged:

| Base name | `.png` in assets | `.webp` in assets | Which is imported |
|---|---|---|---|
| `extra-patty` | ✓ (2.3 MB) | ✓ | `.webp` (ItemCustomizer) |
| `onion-jam` | ✓ (2.0 MB) | ✓ | `.webp` (ItemCustomizer) |
| `garlic-confit` | ✓ (837 KB) | ✓ | `.webp` (ItemCustomizer) |
| `fried-onion` | ✓ (673 KB) | ✓ | `.webp` (ItemCustomizer) |
| `doneness-medium/-mw/-wd` | ✓ | ✓ | `.webp` (ItemCustomizer) |
| `tomato`, `pickles`, `onion`, `maple`, `aioli-sauce` | ✓ | ✓ | `.webp` (ItemCustomizer) |
| `fries-regular`, `onion-rings`, `waffle-fries`, `tempura-onion-rings` | ✓ | ✓ | `.webp` (preloadSelectorIcons + ItemCustomizer) |
| `add-to-home-screen-ios` | ✓ (1.2 MB) + `.jpeg` (214 KB) | — | **NEITHER imported** — check InstallGuide/IosInstallModal |

**No template-string or dynamic asset paths anywhere in the codebase** — grep for `` `@/assets/${` ``, `` `../assets/` ``, `new URL(...assets...)`, `import.meta.glob`, `require(...assets...)` all returned nothing. Every asset reference is a static import string. Vite tree-shakes unimported files at build time.

**Verdict:** the `.png` duplicates ARE safe to delete — nothing (static or dynamic) imports them. They just clutter the repo. Confirm `add-to-home-screen-ios.*` isn't referenced by `StepInstallGuide.tsx` or `IosInstallModal.tsx` before deleting those two specifically (I flagged, didn't fully verify).

---

## 3. C3 lazy-loading — your instinct is right, my recommendation was too blunt

The kiosk flow is: **Welcome → tap "Start Order" → menu → tap item → ItemCustomizer / DealCustomizer / FamilyDealCustomizer opens**.

If I `React.lazy` these customizers, then on **first item tap** the browser has to:
1. Fetch the customizer JS chunk
2. Parse + evaluate it
3. Fetch the 46 topping/doneness `.webp` files it references
4. Render + decode

On a kiosk tablet with warm WiFi that's ~200–500 ms of visible delay on the very first tap of the session — exactly the "feels laggy" moment you're trying to avoid. On subsequent taps it's cached and instant. Same problem hits customer phones on 4G, worse.

**So the naive lazy-load is a regression for the kiosk-instant feel.** But there's a clean middle path:

### Recommended approach — prefetch during idle screens

Use `React.lazy` + **prefetch the chunk during idle time** so the JS + images are already warmed up by the time the user taps an item:

- **Kiosk:** trigger `import("@/components/ItemCustomizer")`, `import("@/components/DealCustomizer")`, `import("@/components/FamilyDealCustomizer")` from inside the existing kiosk preload effect (right where `menuImages` are decoded). Also warm the customizer's topping/ingredient/doneness `.webp` images the same way — extend the `menuImages` preload set to include the ingredient/doneness map from ItemCustomizer.
- **Customer web:** trigger the same dynamic imports from `requestIdleCallback` in `main.tsx` (same slot where `preloadSelectorIcons` lives today). First page load stays small; by the time the user browses to a burger and taps it, the customizer chunk is already in memory.
- **Admin/kitchen routes:** irrelevant — never open customizers.

This gives us:
- Initial guest bundle ~20–30% smaller (measurable win)
- Kiosk still feels instant (chunk warmed during welcome screen)
- Zero regression on tap latency
- Safe rollout — if prefetch fails, `React.lazy` will just fetch on demand (current behavior for the first opener)

Same treatment fits `CheckoutForm.tsx` (1,099 lines): prefetch when the cart is opened (not when checkout is tapped) — cart open is the earliest signal a user is likely to check out.

---

## Summary — what's actually safe

| Item | Safe as-originally-proposed? | Corrected recommendation |
|---|---|---|
| Delete unused `.png` duplicates (extra-patty, onion-jam, doneness-*, garlic-confit, fried-onion, tomato, pickles, maple, aioli-sauce, onion, fried-onion, fries-regular, onion-rings, waffle-fries, tempura-onion-rings) | ✅ Yes | Straight delete; every one has a live `.webp` sibling. `add-to-home-screen-ios.*` — verify first, likely also unused. |
| Convert still-live PNGs (`drink-maccabi`, `kosher-certificate`, `cart-burger-icon`, ~30 preloaded drink PNGs in preloadSelectorIcons) to `.webp` | ✅ Yes | Cheap win; kiosk preload still runs on the WebP versions. |
| Lazy-load `ItemCustomizer`, `DealCustomizer`, `FamilyDealCustomizer`, `CheckoutForm` (C3) | ❌ No, not naively | Use `React.lazy` + **prefetch during kiosk welcome idle** + `requestIdleCallback` on customer web. Also extend the kiosk `menuImages` preload set to include the topping/doneness/ingredient WebPs. |
| H2 heavy libs (`xlsx`, `recharts`, `jspdf`) | ✅ Yes | Dynamic import in click handlers; these are admin/kitchen only, no kiosk-instant concern. |
| H3 `any` types, H4 dedup, M1–M6 | ✅ Yes | Unchanged from previous review. |
| H1 polling | Same as before | Do NOT remove polling. Only share OrderTopBar+OrderLiveTracker source and isolate 1s ticks. |
| C2 splitting Kitchen.tsx | Same as before | Only extract leaf components, don't touch the realtime/polling core. |

Tell me which of these you want me to execute (e.g. "delete dead PNGs + convert live PNGs + lazy-with-prefetch customizers + lazy admin libs") and I'll switch to build mode.
