# Performance & Code Quality Review — Findings Only

No code changes made. Prioritized list below, with plain-language impact estimates. Numbers are order-of-magnitude, based on file sizes, patterns, and dependency inspection.

---

## 🔴 Critical — visible user impact today

### C1. Uncompressed PNG assets in the bundle (~25 MB in `src/assets`)
Many source images are 500 KB–2.3 MB PNGs (`extra-patty.png` 2.3 MB, `onion-jam.png` 2.0 MB, `doneness-well-done.png` 1.5 MB, `fries-regular.png` 1.4 MB, `add-to-home-screen-ios.png` 1.2 MB, `drink-maccabi.png` 1.1 MB, `kosher-certificate.jpeg` 959 KB, and many more). WebP versions exist for *some* (e.g. `hero-burger.webp` 183 KB vs `.jpg` 395 KB; `onion-jam.webp` 186 KB vs `.png` 2 MB) but the heavy PNGs still exist and are likely still referenced.

**Impact:** On a 4G phone this alone can add **3–8 seconds** to first meaningful paint, and burns customer mobile data. On the kiosk tablet over Wi-Fi it's less painful but still slows cold start noticeably.

**Fix direction:** convert every remaining PNG to WebP (or AVIF), keep PNG only where transparency + old-Safari support both matter, and audit `preloadSelectorIcons.ts` — it currently preloads ~30 PNGs at boot.

### C2. Giant "God components" hurting maintainability and re-render cost
- `src/pages/Kitchen.tsx` — **2,684 lines**, 51 `useEffect/useState` calls, multiple `setInterval`s (1s tick, alert loop, poll loop). Every state change re-renders the whole kitchen screen.
- `src/components/ItemCustomizer.tsx` — **1,625 lines**
- `src/pages/Inventory.tsx` — **1,244 lines**
- `src/components/FavoriteOrderModal.tsx` — **1,196 lines**
- `src/components/CheckoutForm.tsx` — **1,099 lines**
- `src/pages/Index.tsx` — **922 lines**, 30 hook calls

**Impact:** Kitchen screen re-renders far more than needed (every 1-second tick re-renders all order cards); on lower-end tablets this shows up as sluggish tap response and dropped animations. Also makes bugs much harder to isolate — a common source of regressions.

**Fix direction:** split each into focused sub-components + `React.memo` on order cards; move the 1-second "elapsed time" tick into a small child that owns its own state so the parent doesn't re-render.

### C3. Public menu page (`/`) not code-split
`Index`, `NotFound`, `Login`, `Install` are eager-imported in `App.tsx`. That's fine for `Index` itself, but `Index.tsx` in turn imports the full menu, `CheckoutForm` (1,099 lines), all customizers, `framer-motion`, etc., all in the initial bundle. Admin/kitchen routes are lazy — good — but the customer path is where bundle size hurts most.

**Impact:** Slower Time-to-Interactive on the actual page 99% of users see. Estimate 30–40% of initial JS is code the guest ordering flow doesn't need until they open a customizer or the cart.

**Fix direction:** lazy-load `CheckoutForm`, `ItemCustomizer`, `DealCustomizer`, `FamilyDealCustomizer`, `LocationPickerModal` — only mount when the user actually opens them.

---

## 🟠 High — clear waste, not user-blocking yet

### H1. Multiple 1-second polling timers on Kitchen + Tracking
- `Kitchen.tsx` — 1-second re-render tick + additional polls
- `OrderTracking.tsx` — fetches order every 10s **and** re-renders every 1s
- `OrderLiveTracker.tsx` + `OrderTopBar.tsx` — each polls orders every 8s and ticks every 1s (so two components polling the same order in parallel on the same page)
- `Courier.tsx` — polls every 5s

**Impact:** Battery drain on courier phones and kitchen tablets, and duplicated network requests (probably 2× the DB hits needed on the customer tracking screen because TopBar + LiveTracker both poll). Realtime subscriptions already exist for some tables — polling on top is redundant.

**Fix direction:** Consolidate to one shared "current order" query via React Query with realtime invalidation; drop the 1-second re-render ticks (use CSS `@keyframes` for elapsed-time animations, or a single top-level ticker that publishes to context).

### H2. Heavy libraries loaded eagerly
`xlsx`, `jspdf`, `html2canvas`, `recharts`, `framer-motion`, `canvas-confetti`, `qrcode`, `react-signature-canvas` — several are only used in admin/kitchen/report screens but end up in shared chunks if imported at module top.

**Impact:** `xlsx` alone is ~400 KB gzipped; `jspdf`+`html2canvas` ~200 KB; `recharts` ~150 KB. Together potentially **~1 MB** of JS that guests never need.

**Fix direction:** dynamic `import()` these inside the click handler that uses them ("Export to Excel", "Download PDF", chart page).

### H3. `any` types concentrated in critical files
15 in `Kitchen.tsx`, 11 in `LocationPickerModal.tsx`, 10 in `EventsKitchen`/`EventsKitchenPanel`, plus scattered across print/checkout libs. Order objects, print payloads, and location data are all loosely typed.

**Impact:** Category of bug the audit already caught (client-supplied prices in `edit-order`) is exactly the kind of thing types would surface earlier. Also makes refactors risky.

### H4. Duplicated logic across pages
- OTP normalization / phone variants — logic now exists in `get-customer-orders` but similar variants are re-implemented in `send-whatsapp-otp`, `customer-auth`, `CheckoutForm`.
- Order fetching & 1s tick duplicated between `OrderLiveTracker` and `OrderTopBar` (near-identical code).
- Print/receipt building: `kitchenReceipt.ts`, `btReceiptOps.ts`, `bluetoothPrinter.ts`, `rawbtPrinter.ts`, `localPrintAgent.ts` — pipeline is right but has repeated formatting code.

---

## 🟡 Medium — quality wins, low user impact

### M1. Loading states are minimal
`App.tsx` uses a single spinner for lazy routes. No skeletons on menu, order tracking, or checkout — user sees blank then pop-in. Menu especially would benefit from skeleton cards while `custom_toppings` + `menu_availability` load.

### M2. Waterfall requests on boot
On the home page: menu image preload → custom toppings fetch → ingredient availability fetch → site settings → business hours → customer auth check. Several of these are sequential in effect because components mount in a chain. Batching the "first render prerequisites" into one parallel `Promise.all` at the root would shave ~200–500 ms.

### M3. Realtime subscriptions not scoped tightly
`ingredientAvailability.ts` and `customToppingsStore.ts` subscribe to `*` events on entire tables. For a busy kitchen those channels carry every update. Fine today, worth watching as data grows.

### M4. `useMemo`/`useCallback` used sparsely (only 36 files) relative to the size of the top components
Not a blanket "add memo everywhere" recommendation, but the kitchen order list, customizer topping grids, and menu section absolutely should memoize their per-row renders.

### M5. Edge functions doing extra round-trips
`inventory-action` (596 lines) and `create-order` (582 lines) each perform multiple sequential `select` → `update` calls that could be RPCs or single `.select(...).eq(...)` batched queries. Not slow at current volume; will bite at scale or during rushes.

### M6. Missing indexes to verify
Frequent query columns worth confirming have indexes: `orders(phone)`, `orders(created_at desc)`, `orders(status)`, `order_tracking_tokens(token)`, `customer_devices(device_token)`, `delivery_requests(courier_id, status)`. A quick `EXPLAIN` on the top-10 slow queries would confirm.

---

## 🟢 Low — nice-to-have

- `preloadSelectorIcons.ts` preloads ~30 PNGs at idle. Once C1 is done, keep this; before then it's amplifying the image weight problem.
- `index.html` CSP allows `'unsafe-inline'` + `'unsafe-eval'` in scripts — needed for Vite dev but should be tightened in production build.
- No `<link rel="preload" as="image">` for the LCP hero image — cheap fix.
- Service worker (`public/sw.js`) is push-only, no caching. That's actually the right call today (avoids stale-menu bugs) — flag only if you later want offline kiosk mode.
- Some `console.log`s remain in production paths (against your own stated standard). Audit and drop.

---

## Suggested greenlight order (best ROI first)

1. **C1 image compression** — biggest single win for real customers, low risk, one PR.
2. **C3 + H2 lazy-load heavy stuff on customer path** — faster first load, invisible to admin.
3. **H1 kill duplicate polling + 1s re-renders** — battery + smoothness on tablets/couriers.
4. **C2 split Kitchen.tsx** — invest here before adding more kitchen features.
5. **H3/H4 typing + dedup** — ongoing maintainability.
6. Everything under Medium/Low — opportunistic, alongside related feature work.

Tell me which of these you want me to actually implement (e.g. "1, 2, 3") and I'll switch to build mode.
