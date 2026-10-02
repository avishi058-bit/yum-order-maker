// Shared CORS helpers.
//
// TWO modes:
// 1. `corsHeadersFor(req)` - for endpoints called from the browser. Reflects
//    the Origin header only if it is one of OUR exact origins. Any other
//    origin receives `null` and the browser blocks the request.
// 2. `internalCorsHeaders` - for endpoints only invoked server-to-server
//    (pg_net webhooks, cron). Sets `Access-Control-Allow-Origin: null`.
//
// Allowed origins: the ALLOWED_ORIGINS env var (comma-separated) when set,
// otherwise the built-in list below. PUBLIC_APP_URL (if set) is always added.
// localhost / 127.0.0.1 are allowed for local development.

const DEFAULT_ORIGINS = [
  "https://habikta-burger.lovable.app",
  "https://id-preview--a11d489f-9e42-43ff-b3f5-02cfc468e993.lovable.app",
  "https://a11d489f-9e42-43ff-b3f5-02cfc468e993.lovableproject.com",
];

const LOCAL_DEV = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function buildAllowList(): Set<string> {
  const fromEnv = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const list = fromEnv.length ? fromEnv : [...DEFAULT_ORIGINS];
  const appUrl = (Deno.env.get("PUBLIC_APP_URL") ?? "").trim().replace(/\/+$/, "");
  if (appUrl) {
    try { list.push(new URL(appUrl).origin); } catch { /* ignore */ }
  }
  return new Set(list);
}

const ALLOWED = buildAllowList();

export function isAllowedOrigin(origin: string): boolean {
  return ALLOWED.has(origin) || LOCAL_DEV.test(origin);
}

const COMMON_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    ...COMMON_HEADERS,
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "null",
  };
}

/** For internal-only endpoints called by pg_net webhooks (never from a browser). */
export const internalCorsHeaders: Record<string, string> = {
  ...COMMON_HEADERS,
  "Access-Control-Allow-Origin": "null",
};
