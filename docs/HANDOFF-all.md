# Handoff - everything done in the previous chat (site and systems)

Read this first, then `docs/HANDOFF-group-order.md` for the open feature.
Private business items (accounting, invoices) are NOT here on purpose - the repo is public. The owner has them separately.

## Rules (from the owner)
- Answer in Hebrew ONLY - every message, summary and question. He gets angry when a reply slips into English. Short hyphens (-) only. Every change goes through the owner; show the final wording before anything is sent or published. For analysis tasks: come with conclusions before changing anything.
- Never break the live site. Work on copies/branches, never delete the Lovable project.
- The owner types passwords, keys, tokens and payment details himself; Claude only opens the page. Never solve CAPTCHAs; on cookie banners only decline.
- No customer data in the repo (public).
- Messages in his name are signed "אבישי, הבעלים של המבורגר הבקתה", no emoji. Kosher wording: "רבנות שדות נגב", never "מהדרין". Don't invent facts (groups came from the USA, Canada and China = 3 countries; no Google rating is known). Don't fake reviews. Don't touch ads.
- Never edit `src/integrations/supabase/client.ts` or `types.ts`. SEO only in `src/seo/pages.ts`. No full rebuilds. Verify after every deploy.
- He does not want design proposals pushed at him.

## How things run
- Push to `main` -> Cloudflare Pages project `habikta-burger` builds in about 2-3 minutes. Branch pushes get a preview `<branch>.habikta-burger.pages.dev`. `git pull --rebase` before pushing (Lovable bot commits land in main).
- Backend: Supabase via Lovable Cloud. SQL only through the Lovable database tool. Edge functions are locked: put logic in SQL RPCs, triggers and pg_net. Test SQL in `DO` blocks that `RAISE EXCEPTION` to roll back.
- Staff worker `habikta-staff` (`workers/staff/`, deployed by Workers Builds from GitHub): `https://api.habikta-burger.com` (used by the site) and the workers.dev address (used by the DB via `internal_config.staff_worker_url`). Endpoints `/notify`, `/calendar`, `/receipt`, `/sms/otp`, `/sms/ready`, `/sms/reopen`, `/sms/group-stuck`, `/health`. It deploys only from `main`. The DB authenticates with the staff VAPID private key.
- Images uploaded in Lovable (`/__l5e/...`) are served by `functions/__l5e/[[path]].js` (proxy with cache).

## Done and live
1. Customer SMS through SMS4Free (`workers/staff/src/sms.js`, secrets set by the owner, sender "HaBikta"):
   - Phone code (OTP) on website checkout, fully in the DB: `otp_request` (lock, 60s cooldown, per phone / IP / day limits), `otp_request_status`, `otp_verify` -> `verified_phones`. Migration `20261123090000_phone_otp_db.sql`.
   - Every phone is verified once per device, remembered until logout (`habikta_verified_phones`). Returning customers too. The code popup opens immediately (`src/components/auth/SignInSheet.tsx`, Apple-style), with the consent text about saving name and phone.
   - Sign-in (`CustomerAuthModal`): phone -> code -> name only if unknown.
   - "Ready" SMS: automatic for pickup / delivery; opt-in button for dine-in and kiosk ("הולכים לסיבוב וחוזרים?"). Migration `20261123080000_order_ready_sms.sql`, `internal_config.sms_ready_mode` = on. Texts start with the customer's name; pickup includes the Waze link and "בתאבון".
   - Flag `CUSTOMER_SMS: true` in `src/config/runtimeFlags.ts`.
2. Logo redone as an exact circle (`src/assets/logo.webp`).
3. Cart suggestions put items the customer hesitated over first (sides and drinks only, not burgers): `src/lib/hesitation.ts`, wired in `Index.tsx`, `Kiosk.tsx`, `KioskCartDrawer.tsx`.
4. Privacy page line about SMS verification (`PrivacyContent.tsx`); CSP allows `api.habikta-burger.com`.

5. (25.11) Z-Credit refused payment pages when the name had a geresh/quote ("Input Error - Parameter 'AdditionalText'"). Fix: `src/lib/zcreditText.ts` strips quotes only from what is sent to Z-Credit (CheckoutForm, Pay.tsx, group "pay for").
6. (25.11) Name on the dish (take-away): 1st/2nd burger - small optional button "+ רוצה להוסיף שם על המנה?" in the burger sheet footer; from the 3rd burger the old "של מי המנה? :)" popup; after a skip with no names it returns to the button (`src/lib/dishOwners.ts`, `ItemCustomizer.tsx`).
7. (25.11) Meal upgrade window: "שדרגו לי! 🍟🥤 (צ׳יפס + שתייה)", "להוסיף רק צ׳יפס" / "להוסיף רק שתייה" (open the extras list with +/-), "לא תודה" adds the burger directly.
8. (25.11) "עדכנו אותי כשנפתח" by SMS: migration `20261125100000_reopen_sms.sql` (applied), table `reopen_sms`, trigger on `restaurant_status.website_open` false->true sends ONE SMS per request via `/sms/reopen`. Text: "<name>, מעדכנים שפתחנו את הבקתה. עכשיו אפשר להיכנס ולהזמין 🙂 / https://habikta-burger.com / המבורגר הבקתה". Signed-in customers register at once, others sign in with the SMS code (`ReopenNotifyModal.tsx`). Also offered after saving an order for later (Index.tsx saved-order window).
9. (25.11) Kitchen: the sound prompt floats at the bottom (it used to make the screen jump on the first tap). Kiosk sauce window is big and centered. Ticket prints the pickled jalapeño sauce as "- בצד".
10. (25.11, branch `release`) Deals (`DealCustomizer`, `FamilyDealCustomizer`) rebuilt from shared parts in `src/components/deals/` to look exactly like the single-burger sheet; out-of-stock toppings hidden; "של מי המנה?" popup per deal burger, button after two skips. Group order merged too (see its handoff). Check whether `release` is in `main` before redoing anything.

Owner decisions (25.11): no number confirmation on the "ready" SMS opt-in and keep the name in it (no OTP needed - transactional message).

## Built, not live (waiting for the owner)
- Group order - merged into branch `release` (see `docs/HANDOFF-group-order.md`); never tested end-to-end with two phones in opening hours.
- Compact home redesign - branch `compact-home` (flag `COMPACT_HOME`), preview https://compact-home.habikta-burger.pages.dev . The owner said not to put it live.


## Older open items
- Diners / Amex note at payment; deal-oranges mapping; kiosk Assigned Access; 2FA.
- Scheduled task: ETA accuracy report on Thursday 26.11 at 12:30.
