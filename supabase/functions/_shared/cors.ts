// Shared CORS helpers.
//
// TWO modes:
// 1. `corsHeadersFor(req)` — for endpoints called from the browser. Reflects
//    the Origin header only if it matches one of our allow-listed sites
//    (production, preview, sandbox, and localhost dev). Any other origin
//    receives `null` and the browser blocks the request.
// 2. `internalCorsHeaders` — for endpoints only invoked server-to-server
//    (pg_net webhooks, cron). Sets `Access-Control-Allow-Origin: null`
//    so no browser origin can invoke them.
//
// Both modes also cover the preflight `Access-Control-Allow-*` fields.

const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https:\/\/yum-order-maker\.lovable\.app$/,
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

const COMMON_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
  return {
    ...COMMON_HEADERS,
    "Access-Control-Allow-Origin": allowed ? origin : "null",
  };
}

/** For internal-only endpoints called by pg_net webhooks (never from a browser). */
export const internalCorsHeaders: Record<string, string> = {
  ...COMMON_HEADERS,
  "Access-Control-Allow-Origin": "null",
};
