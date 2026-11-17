// Staff shifts worker (Cloudflare Workers, no dependencies).
//   POST /notify   - from the database (staff_send_messages) with the VAPID private key.
//                    Sends each message as Web Push (RFC 8291 aes128gcm + VAPID).
//   GET  /calendar?t=<token> - iCal feed of the person's published shifts.
//   GET  /health   - "ok"

const enc = new TextEncoder();
const b64uToBytes = (s) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const bytesToB64u = (bytes) => {
  let s = "";
  for (const x of new Uint8Array(bytes)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const hkdf = async (salt, ikm, info, length) => {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
};

// VAPID signing key from the base64url private scalar + the public key. The
// private scalar arrives with each /notify call (env.VAPID_PRIVATE_KEY is only a
// fallback); it must match VAPID_PUBLIC_KEY or the call is refused.
const signingKeys = new Map();
const getSigningKey = async (env, d = env.VAPID_PRIVATE_KEY) => {
  if (!d) throw new Error("no_key");
  if (signingKeys.has(d)) return signingKeys.get(d);
  const pub = b64uToBytes(env.VAPID_PUBLIC_KEY);
  const key = await crypto.subtle.importKey("jwk", {
    kty: "EC", crv: "P-256", d,
    x: bytesToB64u(pub.slice(1, 33)), y: bytesToB64u(pub.slice(33, 65)), ext: true,
  }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  // Prove the private key belongs to our public key: sign, then verify.
  const probe = enc.encode("habikta-staff");
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, probe);
  const verifyKey = await crypto.subtle.importKey("raw", pub, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  if (!(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, verifyKey, sig, probe))) throw new Error("key_mismatch");
  signingKeys.set(d, key);
  return key;
};

const vapidHeader = async (env, endpoint, d) => {
  const header = bytesToB64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = bytesToB64u(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT,
  })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await getSigningKey(env, d), enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${bytesToB64u(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
};

/** RFC 8291 payload encryption (single record, aes128gcm). */
const encrypt = async (sub, payload) => {
  const uaPublic = b64uToBytes(sub.p256dh);
  const authSecret = b64uToBytes(sub.auth);
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(enc.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
};

const sendPush = async (env, sub, payload, d) => {
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidHeader(env, sub.endpoint, d),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body: await encrypt(sub, payload),
  });
  return res.status;
};

const rpc = (env, fn, args) =>
  fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
    body: JSON.stringify(args),
  });

const handleNotify = async (req, env) => {
  const { messages = [], vapid_private: d, secret } = await req.json().catch(() => ({}));
  try { await getSigningKey(env, d); } catch { return new Response("forbidden", { status: 403 }); }
  const expired = [];
  let sent = 0;
  await Promise.all(messages.flatMap((m) => (m.subs || []).map(async (s) => {
    try {
      const status = await sendPush(env, s, JSON.stringify({ title: m.title, body: m.body, tag: m.tag, url: m.url || "/staff" }), d);
      if (status === 404 || status === 410) expired.push(s.endpoint);
      else if (status < 300) sent++;
    } catch { /* one bad subscription must not stop the rest */ }
  })));
  if (expired.length && secret) await rpc(env, "staff_push_expired", { p_secret: secret, p_endpoints: expired });
  return Response.json({ ok: true, sent, expired: expired.length });
};

const icsTime = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

const handleCalendar = async (url, env) => {
  const token = url.searchParams.get("t") || "";
  if (!/^[0-9a-f]{48}$/.test(token)) return new Response("not found", { status: 404 });
  const res = await rpc(env, "staff_calendar_feed", { p_token: token });
  if (!res.ok) return new Response("not found", { status: 404 });
  const shifts = await res.json();
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HaBikta//Shifts//HE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    // Green calendar (iPhone takes the calendar colour; COLOR is the per-event standard).
    "X-WR-CALNAME:משמרות הבקתה", "X-APPLE-CALENDAR-COLOR:#16A34A", "COLOR:green", "X-WR-TIMEZONE:Asia/Jerusalem", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  for (const s of shifts) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:shift-${s.id}-${token.slice(0, 8)}@habikta-burger.com`,
      `DTSTAMP:${icsTime(new Date().toISOString())}`,
      `DTSTART:${icsTime(s.starts_at)}`,
      `DTEND:${icsTime(s.ends_at)}`,
      `SUMMARY:${esc(s.title || "משמרת הבקתה")}`,
      "COLOR:green",
      `LOCATION:${esc("הבקתה, דרך ערבי נחל 21, תושיה")}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc("משמרת בעוד שעה - זמן להתארגן")}`, "TRIGGER:-PT60M", "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-cache" },
  });
};

// ─── Receipt reading (owner only) ─────────────────────────────────────
// The owner's shopping list sends a receipt photo and the products still
// missing; a vision model says which of them the receipt shows, and how many.
const ALLOWED_ORIGINS = ["https://habikta-burger.com", "https://www.habikta-burger.com", "https://habikta-burger.lovable.app"];
const cors = (req) => {
  const origin = req.headers.get("Origin") ?? "";
  const ok = ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin) || origin.startsWith("http://localhost");
  return ok ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" } : {};
};
const json = (req, body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(req) } });

/** Only the owner can read suppliers (admin-only RLS), so a row back means admin. */
const isAdmin = async (env, auth) => {
  if (!auth?.startsWith("Bearer ")) return false;
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/staff_suppliers?select=id&limit=1`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: auth },
  });
  if (!r.ok) return false;
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
};

const handleReceipt = async (req, env) => {
  if (!env.AI) return json(req, { error: "no_ai" }, 503);
  if (!(await isAdmin(env, req.headers.get("Authorization")))) return json(req, { error: "forbidden" }, 403);
  const body = await req.json().catch(() => null);
  const image = typeof body?.image === "string" ? body.image : "";
  const items = Array.isArray(body?.items) ? body.items.slice(0, 80) : [];
  if (!image.startsWith("data:image/") || image.length > 6_000_000 || items.length === 0) return json(req, { error: "bad_request" }, 400);
  const list = items.map((i, n) => `${n + 1}. ${String(i.name).slice(0, 60)} (נספר ב${String(i.unit ?? "יחידות").slice(0, 20)}${i.pack_size ? `, ${i.pack_name ?? "ארגז"} = ${Number(i.pack_size)}` : ""})`).join("\n");
  const prompt = `This is a photo of a shopping receipt from an Israeli store, in Hebrew.
Here is a numbered list of products the restaurant was missing:
${list}
For each product in the list that appears on the receipt, say how many were bought, in the unit written next to it (convert cases/packs to that unit when needed).
Answer with JSON only, no other text: [{"n": <list number>, "quantity": <number>, "line": "<the receipt line you matched>"}]. If nothing matches, answer [].`;
  let text = "";
  try {
    const out = await env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }] }],
      max_tokens: 800,
      temperature: 0,
    });
    text = typeof out?.response === "string" ? out.response : JSON.stringify(out?.response ?? "");
  } catch (e) {
    return json(req, { error: "ai_failed", detail: String(e).slice(0, 200) }, 502);
  }
  const m = text.match(/\[[\s\S]*\]/);
  let found = [];
  try { found = m ? JSON.parse(m[0]) : []; } catch { found = []; }
  const result = found
    .filter((f) => Number.isInteger(f?.n) && f.n >= 1 && f.n <= items.length && Number(f.quantity) > 0)
    .map((f) => ({ id: items[f.n - 1].id, quantity: Math.min(9999, Number(f.quantity)), line: String(f.line ?? "").slice(0, 80) }));
  return json(req, { found: result });
};

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/receipt" && req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
    if (url.pathname === "/receipt" && req.method === "POST") return handleReceipt(req, env);
    if (url.pathname === "/notify" && req.method === "POST") return handleNotify(req, env);
    if (url.pathname === "/calendar" && req.method === "GET") return handleCalendar(url, env);
    if (url.pathname === "/health") return new Response("ok");
    return new Response("not found", { status: 404 });
  },
};

// Exposed for the local crypto test (workers/staff/test).
export { encrypt, vapidHeader };
