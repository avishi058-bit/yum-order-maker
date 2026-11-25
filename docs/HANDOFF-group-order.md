# Group order - handoff (branch `group-order`)

Status: built, on preview only. NOT merged to `main`. The owner approves every change and must see final wording before anything goes live.
Preview: https://group-order.habikta-burger.pages.dev/group

## What it does
- Organizer opens a group at `/group` (name, phone, dine-in or takeaway). The phone is verified once by SMS code; it gets ONE "ready" SMS for the whole group.
- Organizer shares `/group/:code` (WhatsApp button). Each participant enters a name, orders on the normal menu (orange bar on top), pays by card only. No SMS code, no ready SMS, no preorder (scheduled time) for participants.
- Group page (everyone sees): who is in, items, total, paid / not paid, progress bar; live "X בונה הזמנה..." / "בתשלום..." (Realtime presence, `src/hooks/useGroupPresence.ts`); toasts for joined / paid / removed.
- Anyone can pay for an unpaid person; the organizer or the person removes an unpaid dish (two-tap confirm, no browser dialogs).
- Organizer presses "כולם הזמינו - לשלוח את ההזמנה למטבח" (= `group_lock`). The kitchen gets nothing until locked AND every order is paid; then all orders are released together with one bon number and one kitchen push.
- Kitchen (`src/pages/Kitchen.tsx` + `src/lib/groupOrders.ts`): held orders hidden; released group shows as ONE card (owner name on each dish); status / ETA / paid changes apply to all order ids behind the card.
- Closed hours: cannot open a group, order or pay.
- Stuck group (`supabase/migrations/20261124120000_group_stuck.sql`, cron `group-stuck-tick` every minute):
  - 15 min after the first payment, if not sent: ONE SMS to the organizer (worker `/sms/group-stuck`, text in `workers/staff/src/sms.js`) with a manage link `/group/CODE#m=TOKEN`. The token (hash in `order_groups.manage_hash`) counts as the organizer secret on any device.
  - Organizer box "מי עוד לא שילם (N)" (`src/components/group/UnpaidManager.tsx`): pay for someone, take someone out, or "לשלוח למטבח בלי מי שלא שילם" (`group_send_without_unpaid` cancels the unpaid orders and releases).
  - 30 min after the first payment: kitchen card "הזמנה קבוצתית נתקעה - נא ליצור קשר" with name, phone, tel: QR (`src/components/kitchen/StuckGroupCard.tsx`, `src/hooks/useStuckGroups.ts`); rings like a new order until "הבנתי"; disappears when the group is sent.

## Files
- DB (already applied to production, inert for normal orders):
  - `supabase/migrations/20261123100000_group_orders.sql` - tables `order_groups`, `order_group_members`, `orders.group_id`, `orders.group_hold`; RPCs `group_get/attach/lock/remove/pay_info`, `group_try_release`, trigger `group_on_order_status`; patched `notify_kitchen_new_order`, `reping_kitchen_for_pending_orders`, `kitchen_burgers_in_prep`, `eta_on_order_new` to skip held orders.
  - `supabase/migrations/20261124000000_group_organizer_sms.sql` - `group_create(name, dine_in, phone)` requires a phone in `verified_phones`; `order_ready_sms_claim` sends one SMS per group to `order_groups.notify_phone`, never to participants.
- Frontend: `src/pages/GroupOrder.tsx`, `src/lib/groupSession.ts`, `src/hooks/useGroupPresence.ts`, `src/lib/groupOrders.ts`; edits in `Index.tsx` (group bar, presence), `CheckoutForm.tsx` (card only, attach before payment, no OTP / opt-in / preorder in group), `OrderConfirmation.tsx` (back to group page), `Kitchen.tsx`, `HeroSection.tsx` (link), `App.tsx` (routes).

## Still open
1. Real test in opening hours with two phones: open group, two people order and pay, live "building" dots, organizer sends, kitchen shows one card + one bon, organizer gets one SMS on ready.
2. Stuck-group flow (decided by the owner 24.11): code written on the branch, NOT yet pushed; migration `20261124120000_group_stuck.sql` NOT yet applied - both wait for the owner's OK. The SMS only works after merge to main (the worker deploys from main) and links to habikta-burger.com. Test: a test group in opening hours, one person pays, wait 15 and 30 minutes.
3. Note to owner: paying for someone else passes that person's phone to the payment page (Z-Credit requires it); not shown on screen.
4. After approval: merge `group-order` into `main` (`git pull --rebase` first - Lovable bot commits land in main), wait for Cloudflare Pages, verify live.

## Rules (from the owner)
- Answer in Hebrew only, short hyphens (-) only. Show final wording before anything is sent or published.
- Never break the live site; never delete the Lovable project. Never edit `src/integrations/supabase/client.ts` or `types.ts`. SEO only in `src/seo/pages.ts`. No full rebuilds.
- Never type passwords, keys or payment details; the owner does it. Repo is public: no customer data in it.
- SQL only through the Lovable database tool; edge functions are not changed - logic goes in SQL RPCs / triggers.
