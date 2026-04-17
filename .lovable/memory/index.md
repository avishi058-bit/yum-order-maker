# Project Memory

## Core
RTL Hebrew food ordering app "הבקתה". Heebo font. Supabase Cloud backend.
Staff auth: email+password (admin/kitchen roles). Customer auth: phone OTP via WhatsApp.
All UI positions/animations centralized in src/config/uiConfig.ts.
Never edit src/integrations/supabase/client.ts or types.ts.
NEVER full rebuilds. NEVER break working features. Every change targeted, safe, performance-neutral.
Don't touch what already works unless explicitly asked. Prefer correct over fast.
Strict separation UI/logic/data. No console.log in prod (keep console.error). Minimal data: client=non-sensitive only, server=operationally required only. Never store credit card data.

## Memories
- [Customer auth system](mem://features/customer-auth) — Phone OTP, device token auto-login, registration with terms/marketing consent
- [UI config](mem://design/ui-config) — Centralized positions and animations in src/config/uiConfig.ts
- [Code quality & data standards](mem://standards/code-quality) — Mandatory standards: code quality, modularity, data minimization, analytics event names, security, performance
