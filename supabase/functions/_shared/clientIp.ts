/**
 * Trustworthy client IP.
 * - cf-connecting-ip is set by Cloudflare at the edge and overwrites any
 *   client-supplied value.
 * - Otherwise use the LAST (right-most) x-forwarded-for entry: that one is
 *   appended by our own proxy; earlier entries can be forged by the caller.
 */
export function getClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const parts = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length) return parts[parts.length - 1];
  return "unknown";
}
