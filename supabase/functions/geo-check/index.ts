// Geo restriction: allow only visitors whose IP resolves to Israel (IL).
// Returns { country, allowed }. Fails open (allowed=true) on lookup errors
// so a third-party outage never locks legitimate customers out.

import { corsHeadersFor } from "../_shared/cors.ts";

const ALLOWED_COUNTRIES = new Set(["IL"]);

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

async function lookupCountry(ip: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`https://ipwho.is/${ip}?fields=country_code,success`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.success && typeof data.country_code === "string") {
      return data.country_code.toUpperCase();
    }
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const ip = getClientIp(req);
  if (!ip || isPrivateIp(ip)) {
    return new Response(
      JSON.stringify({ country: null, allowed: true, reason: "local" }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const country = await lookupCountry(ip);
  if (!country) {
    // Fail open — don't punish users for a third-party outage.
    return new Response(
      JSON.stringify({ country: null, allowed: true, reason: "lookup_failed" }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const allowed = ALLOWED_COUNTRIES.has(country);
  return new Response(
    JSON.stringify({ country, allowed }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
