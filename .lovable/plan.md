# Intent Investigation — Are the Findings Real Debt or Deliberate Tradeoffs?

Read-only investigation, no changes made. Sources: code comments, `.lovable/memory/*`, git history, and cross-file references.

Verdict per item:

---

## 1. Polling on customer + courier + kitchen screens

### 🟢 INTENTIONAL — do NOT rip out
**`OrderTracking.tsx`, `OrderLiveTracker.tsx`, `OrderTopBar.tsx` (customer side):**
Explicit comments in the code:
- `OrderTracking.tsx:47` — *"Poll every 10s — realtime would expose channel access; polling is safer here"*
- `OrderLiveTracker.tsx:50` — *"Poll every 8s instead of realtime (no public DB channel access)"*
- `OrderTopBar.tsx:83` — same comment

These pages read orders via the **`get-order-by-token` edge function** (secure, token-scoped) — they deliberately do NOT open a Supabase realtime channel because that would require broader table read access for anon users. This is a **security decision from the earlier RLS hardening pass**, consistent with `.lovable/memory/standards/code-quality.md` ("Always validate permissions server-side… Never expose sensitive data to client"). Recommendation from the previous report to "consolidate with realtime invalidation" was wrong for these screens — leave the polling.

**`Kitchen.tsx` polling fallback:**
`Kitchen.tsx:655-661` has an explicit comment:
> *"Polling fallback — realtime already pushes updates instantly, so we only need a slow safety-net poll (every 10s) to catch dropped events. A tight 3s poll on top of realtime kept re-fetching the whole orders table and made status-button taps feel unresponsive."*

Kitchen already has realtime subscriptions on `orders`, `menu_availability`, `custom_toppings`. The 10s poll is a **deliberately-tuned safety net for dropped websocket events on tablets**. Additional guards (`pauseRefreshRef`, `localMutationUntilRef`, visibility listeners) show this is battle-tested code — do NOT touch.

**`Courier.tsx` 5s poll:** No comment, but the loop only runs while `courier.status !== "approved"` — it's waiting for admin approval and then stops. Intentional, narrow.

### 🟡 PARTIALLY UNINTENTIONAL — safe to improve
**Duplicate polling `OrderTopBar` + `OrderLiveTracker`:** No comment justifies both polling independently. They're mounted in different contexts (persistent mini-bar vs expanded modal), but on `/track` both can be alive simultaneously → 2× the edge-function calls. **Safe to share one query** (e.g. lift into a hook or React Query key keyed by `orderNumber+phone`). Keep the polling itself.

**1-second re-render ticks** (Kitchen line 432, OrderTracking line 65, OrderLiveTracker line 108, OrderTopBar line 131): No comment. They're for updating displayed elapsed time / countdown. On Kitchen this ticks the whole page — probably organic, safe to isolate into a tiny `<ElapsedTime>` child so the parent doesn't re-render every second. Low risk.

---

## 2. Uncompressed PNGs in `src/assets/`

### 🔴 UNINTENTIONAL DEBT — most of them are DEAD ASSETS
Grep for actual references to the biggest offenders:

| File | Size | References in src/ |
|---|---|---|
| `extra-patty.png` | 2.3 MB | **0** |
| `onion-jam.png` | 2.0 MB | **0** (webp version exists) |
| `doneness-well-done.png` | 1.5 MB | **0** |
| `doneness-medium-well.png` | 1.3 MB | **0** |
| `doneness-medium.png` | 1.2 MB | **0** |
| `fries-regular.png` | 1.4 MB | **0** (webp used instead) |
| `add-to-home-screen-ios.png` | 1.2 MB | **0** (`.jpeg` version used) |
| `waffle-fries.png` | 885 KB | **0** (webp used) |
| `garlic-confit.png` | 837 KB | **0** |
| `tomato.png` | 807 KB | **0** |
| `onion-rings.png` | 791 KB | **0** (webp used) |
| `drink-maccabi.png` | 1.1 MB | 1 (still live) |
| `kosher-certificate.jpeg` | 959 KB | 1 (still live) |
| `cart-burger-icon.png` | 752 KB | 1 (still live) |

**~14 MB of the 25 MB in `src/assets/` is unused files left behind after WebP conversions.** Vite tree-shakes unimported imports, so they don't reach the browser — but they inflate the repo, slow `npm install`/CI, and confuse future edits.

The ~3 MB that IS still shipped (`drink-maccabi`, `kosher-certificate`, `cart-burger-icon`, ~30 preloaded drink PNGs) is unintentional too — same conversion just wasn't finished. No memory note about a device that requires PNG. Safe to convert.

**Correction to the previous report:** The impact number (3–8s slower FMP) was overstated because dead files don't ship. Real impact is on the ~30 preloaded drink PNGs and the referenced ones.

---

## 3. Kitchen.tsx being 2,684 lines

### 🟡 ORGANIC GROWTH, cautious to split
No memory note about keeping it monolithic. But the file contains many hard-won edge-case handlers (visibility listeners, local-mutation suppression window, auto-print race retry, ringtone alert interval, realtime + polling coordination). Comments like:
- *"Race: orders INSERT realtime fires before order_items rows finish writing…"*
- *"Suppress background refetches for a short window after a local mutation… otherwise the button feels frozen…"*

These interlock across `useEffect`s. Splitting is worth doing but **must be careful** — this is exactly the type of file where a naive extract breaks subtle timing. Memory rule "Don't touch what already works unless explicitly asked" applies with extra weight here. Recommend splitting only extractable islands first (order card, settings modal, events panel) — not the realtime/polling core.

---

## 4. Other items

### C3 — lazy-load `CheckoutForm`, `ItemCustomizer`, customizers
🟢 **Unintentional.** No comment explains why they're eager on `/`. Admin routes were already lazy-loaded (App.tsx does this correctly), which shows the author knows the pattern. Safe to apply the same treatment to modals that only open on user interaction. Low risk.

### H2 — heavy libs (`xlsx`, `jspdf`, `html2canvas`, `recharts`)
🟢 **Unintentional.** Usage is confined to admin-only files:
- `xlsx` → `DashboardView.tsx`, `InventoryStats.tsx`
- `jspdf` → `bluetoothPrinter.ts`, `btReceiptOps.ts`, `eventContract.ts`
- `recharts` → `DashboardView.tsx`, `InventoryStats.tsx`, `ui/chart.tsx`

Guest bundle should never touch these. Dynamic `import()` inside the click handler is safe and standard. However: **print-related jspdf usage** touches the kitchen bon pipeline — memory rule *"Kitchen bons ALWAYS route through BT/agent/rawbt/browser pipeline"* means lazy-loading in printer code needs care (import once and cache, don't add latency to the first print). Handle print libs separately from the admin export libs.

### H3 — `any` types
🟢 **Unintentional.** No comments defending `any`. `.lovable/memory/standards/code-quality.md` says "Clear names… Strict separation UI/logic/data." Improving types aligns with stated standards. Low-risk to fix incrementally, high-risk to do in a big-bang PR — do file-by-file.

### H4 — duplicated logic
- **Phone-variant normalization duplicated across edge functions:** unintentional. Prior audit already added `normalizePhone` in `get-customer-orders`; the other functions haven't been updated yet. Safe to extract into `supabase/functions/_shared/`.
- **OrderTopBar ≈ OrderLiveTracker:** unintentional, safe to unify (see item 1).
- **Print/receipt libs (`kitchenReceipt.ts`, `btReceiptOps.ts`, `bluetoothPrinter.ts`, `rawbtPrinter.ts`, `localPrintAgent.ts`):** These look duplicated but each targets a different transport (Web Bluetooth vs RawBT app vs local HTTP agent vs browser print). The memory rule explicitly requires all four transports remain in the pipeline. Consolidation should be **content-building shared, transport-specific kept separate**. Medium risk.

### M1 — loading states / skeletons
🟢 Unintentional. No design memory says "avoid skeletons." Free to add.

### M2 — request waterfalls on boot
🟢 Unintentional. Sequential mounting rather than a design choice.

### M3 — realtime subscriptions `*` on whole tables
🟡 Mixed. `customToppingsStore` and `ingredientAvailability` need cross-table awareness for the kitchen availability system (see memory note `menu-item-inventory-end-to-end` — new items must be wired to kitchen availability). Broad subscription is defensible; narrowing to specific event types (`INSERT`/`UPDATE`) is safe but not urgent.

### M4 — sparse `React.memo`/`useMemo`
🟢 Unintentional. Only `KioskWelcome` uses `React.memo`. No standard about avoiding memoization. Adding it to Kitchen order cards and menu items is safe.

### M5 — edge functions doing extra round-trips
🟡 Mostly organic. Some sequential queries in `create-order`/`inventory-action` are order-dependent (must read stock before decrementing). Safe wins exist (batching independent selects) but each function needs individual review — not a blanket fix.

### M6 — missing indexes
🟢 Unintentional. No memory note. Safe to add, but should be verified with actual `EXPLAIN` before creating.

---

## Revised recommendation

Compared to the original report, adjust as follows:

| Item | Original priority | Revised |
|---|---|---|
| **C1 (images)** | Critical | High — mostly dead assets; delete unused, convert the ~3 remaining referenced PNGs |
| **C2 (Kitchen.tsx)** | Critical | Medium — split *around* the realtime/polling core, not through it |
| **C3 (lazy customer modals)** | Critical | Critical — confirmed safe |
| **H1 (polling)** | High — "kill it" | **Do NOT remove polling.** Only: (a) share OrderTopBar+LiveTracker source, (b) isolate 1s ticks into small children |
| **H2 (heavy libs)** | High | High — safe, but treat print libs (jspdf) separately from admin libs (xlsx/recharts) |
| **H3, H4, M1–M6** | Various | Unchanged, all safe |

Want me to proceed to build mode with the revised plan? Say which items (e.g. "C1 dead-asset cleanup, C3, H1 dedupe, H2 lazy load") and I'll implement.
