# "Edit order" feature — removal investigation (findings only)

## 1. Where it's surfaced in the UI

**One entry point**, on each order card in `src/pages/Kitchen.tsx`:

- **File:** `src/pages/Kitchen.tsx` around line 2252
- **Trigger:** a small pencil icon button (Lucide `<Pencil size={16} />`) in the order card's top-right button strip, with title tooltip **"ערוך הזמנה"** ("edit order").
- **Visibility gate:** only rendered when `order.status === "new" || order.status === "preparing"` — you cannot edit an order once it's ready/completed.
- **Onclick:** `setEditingOrder(order)` opens the modal.

The modal itself lives at `src/components/EditOrderModal.tsx` (221 lines) and is rendered from Kitchen.tsx around line 2648 when `editingOrder` state is set.

Related state in Kitchen.tsx:
- `const [editingOrder, setEditingOrder] = useState<Order | null>(null);` (line 342)

**Nothing else surfaces this** — no admin page, no station page, no courier page invokes the modal or the edge function.

## 2. What edit-order lets staff actually change

Per `supabase/functions/edit-order/index.ts` header comment + body:

**Yes, changes:**
- Swap items, change quantities, add/remove items on the order.
- Toppings, removals, with_meal / meal_side / meal_drink, deal_burgers / deal_drinks.
- Total is recomputed server-side from the shared pricing module (client-supplied `price` is ignored).
- **Optional `discount`** — admin-only, non-negative, capped at recomputed total. This is currently the ONLY way for staff to apply a manual price discount to an existing order.
- Triggers fridge inventory restore for removed items and pull for new ones.
- Returns `requires_reprint=true` → Kitchen.tsx auto-prints an updated bon.

**No, doesn't change:**
- **Status** (new / preparing / ready / completed / cancelled) — handled separately by direct `supabase.from("orders").update({ status: ... })` calls elsewhere in Kitchen.tsx (lines 809, 850, etc.), gated by RLS + role. **Untouched by removing edit-order.**
- **Notes / customer_name / customer_phone / customer_address** — edit-order doesn't touch them.
- **ETA (estimated_ready_at)** — updated separately in Kitchen.tsx (line 1168).
- **Payment method / delivery fields** — not editable via edit-order.

## 3. Dependencies — does anything else break?

Grep of the entire codebase for `edit-order`:

```
src/pages/Kitchen.tsx          (import + render of EditOrderModal only)
src/components/EditOrderModal.tsx  (the modal itself; single caller of the edge function)
supabase/functions/edit-order/index.ts  (the function)
```

**Nothing else depends on it.** No admin panel, no cron job, no other edge function, no DB trigger references `edit-order`.

Removing the button, the modal, and the edge function is fully self-contained. Deleting:
- `src/components/EditOrderModal.tsx`
- the import + `editingOrder` state + pencil button + modal render in `Kitchen.tsx`
- `supabase/functions/edit-order/` folder

…leaves everything else — status transitions, printing, ETA, cancel, inventory triggers on order_items change, fridge pull/restore, delivery, kiosk, admin — completely intact.

**One tiny side effect to be aware of:** the fridge auto-pull trigger `apply_order_item_to_fridge` runs on `INSERT` of `order_items`; the auto-restore path today is invoked by `edit-order` via `restore_fridge_for_order_item` and by the `apply_order_to_inventory` cancel path. If staff never edit orders anymore, `restore_fridge_for_order_item` becomes unused code but harmless (still called by cancel flow indirectly? — cancel uses `apply_order_to_inventory`, a separate function, so `restore_fridge_for_order_item` becomes fully orphaned). It's fine to keep the RPC function in the DB; removing it is optional cleanup.

## 4. Real-world use cases that would be lost

Realistic scenarios staff currently handle via this modal:

1. **"Customer wants to add a side / drink after ordering"** — today: open edit, add the line, save, updated bon auto-prints. After removal: staff would have to (a) take a second separate order, or (b) verbally add it and adjust cash on the spot with no system record.
2. **"Wrong topping / typo on an item"** — today: swap the topping, resave, reprint. After removal: no way to correct; the bon that already printed is what the kitchen makes.
3. **"Customer changes their mind about a burger they haven't started cooking"** — today: edit + reprint. After removal: cancel the whole order and take a new one (loses order_number, loses history continuity, resets ETA).
4. **"Applying a manual discount"** (admin-only path today) — today: enter a discount in the modal, total updates. After removal: **no path in the app to manually discount a placed order at all.** Staff would either eat the difference in cash or refund out-of-band.
5. **"Undercharging fix"** — today: add the missing paid topping / meal upgrade to reflect what was actually served. After removal: no correction path.

**Adjacent capabilities that stay working** (do NOT confuse with edit-order):
- Cancelling an order → still works.
- Marking preparing/ready/completed → still works.
- Reprinting the same bon → still works.
- Updating ETA → still works.
- Adding a completely new second order for the same customer → still works.

## Bottom line

- **Scope of change to remove it:** 3 places — one button + state + modal render in `Kitchen.tsx`, one component file, one edge function. Zero collateral damage to other flows.
- **What staff lose:** the ability to modify items/quantities/toppings on an already-placed order, and the admin's ability to apply a manual discount (that discount path exists nowhere else in the app today).
- **What staff keep:** all status transitions, cancelling, reprinting, ETA changes, and creating fresh orders.

If losing the discount path is a problem, the user may want to keep a stripped-down version (discount only, no item edits) — worth confirming before deletion. If losing item-correction is acceptable (typical answer: staff will just cancel + reorder), removal is safe and clean.

No changes made. Confirm removal and I'll switch to build mode and delete: `EditOrderModal.tsx`, the pencil button + `editingOrder` state + modal render in `Kitchen.tsx`, and the `edit-order` edge function.
