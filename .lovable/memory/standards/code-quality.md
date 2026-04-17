---
name: Code quality & data standards
description: Mandatory standards for all future changes — code quality, data minimization, performance, security
type: preference
---

# Standard for all future changes

## Process rules (CRITICAL)
- NEVER do full rebuilds. NEVER break working features.
- Every change must be **targeted, safe, performance-neutral**.
- If "what already works" — don't touch it unless explicitly asked.
- Prefer the *correct* solution over the *fast* one.

## Code quality
- Readable, modular, small focused components.
- Clear names for functions/variables/components (English code, Hebrew UI).
- Strict separation: **UI / logic / data (API)**.
- No dense "everything in one file" code. No duplication.
- No `console.log` / debug code in production paths (keep `console.error` for real errors).
- Short comments on non-obvious logic only.

## Analytics events (when implementing tracking)
Standard event names: `view_product`, `add_to_cart`, `start_checkout`, `complete_order`, `abandon_cart`.
Identify users by phone when available; otherwise anonymous guest_id.

## Data storage principles
**Client-side (localStorage / cookies)** — non-sensitive only:
- display name, non-sensitive guest id, temporary cart, preferences.

**Server-side** — only operationally required:
- orders, order status, customer phone (only when needed), basic analytics.
- NEVER store credit card details (external processor only — Z-Credit).
- NEVER store data "just in case".

## Security
- Always validate permissions server-side (RLS + edge function checks), never trust client.
- Never expose sensitive data to client.
- Minimize data collection.

## Performance
- No heavy scripts without need. Avoid unnecessary re-renders.
- Every new feature must be performance-neutral or better.
