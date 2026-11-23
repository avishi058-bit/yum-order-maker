// SMS for customers, sent through SMS4Free (an Israeli SMS provider).
// - /otp/send, /otp/verify: phone check on the website checkout. Codes live in
//   KV for 10 minutes, hashed. Limits per phone, per IP and per day keep the
//   bill small even if someone abuses the form.
// - /sms/ready: the database calls this when the kitchen marks an order ready,
//   after claiming it (once per order). The call carries the staff VAPID private
//   key, checked against the public key like /notify, so only the database can
//   make the worker send.
// The provider's key, user and password are Cloudflare secrets the owner
// enters himself: SMS4FREE_KEY, SMS4FREE_USER, SMS4FREE_PASS.

const WAZE = "https://waze.com/ul?ll=31.43473,34.54170&navigate=yes";
const OTP_TTL = 600;
const LIMITS = { phoneCooldown: 60, phonePerDay: 5, ipPerHour: 8, globalPerDay: 300 };

const isMobile = (p) => /^05\d{8}$/.test(p);
export const normalizePhone = (raw) => {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("972")) d = `0${d.slice(3)}`;
  return d;
};
export const firstName = (name) => {
  const n = String(name ?? "").trim().split(/\s+/)[0] ?? "";
  return n.length >= 2 && n.length <= 14 && n !== "לקוח" ? n : "";
};

export const readyText = (kind, name) => {
  const hi = name ? `${name}, ` : "";
  if (kind === "delivery") return `${hi}ההזמנה שלך מוכנה ועכשיו יוצאת אליך! המבורגר הבקתה`;
  if (kind === "pickup") return `${hi}איזה כיף! ההזמנה שלך מוכנה ומחכה לך בבקתה\nלניווט בוויז: ${WAZE}`;
  return `${hi}איזה כיף! ההזמנה שלך מוכנה ומחכה לך בדלפק. בתאבון! המבורגר הבקתה`;
};
export const otpText = (code) =>
  `קוד האימות שלך בהמבורגר הבקתה: ${code}\nאין למסור את הקוד לאף אחד\n\n@habikta-burger.com #${code}`;

export const sendSms = async (env, phone, msg) => {
  if (!env.SMS4FREE_KEY || !env.SMS4FREE_USER || !env.SMS4FREE_PASS) return { ok: false, status: "no_config" };
  const res = await fetch("https://api.sms4free.co.il/ApiSMS/v2/SendSMS", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // Trimmed: a space pasted with the key or password makes SMS4Free answer -1.
      key: String(env.SMS4FREE_KEY).trim(), user: String(env.SMS4FREE_USER).replace(/\D/g, ""), pass: String(env.SMS4FREE_PASS).trim(),
      // Until a package is bought, SMS4Free only sends from the registered number.
      sender: env.SMS_SENDER || String(env.SMS4FREE_USER).replace(/\D/g, ""),
      recipient: phone, msg,
    }),
  }).catch(() => null);
  const data = res ? await res.json().catch(() => ({})) : {};
  const status = Number(data?.status ?? 0);
  return { ok: status > 0, status };
};

const sha = async (s) => {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
};
const israelDay = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);

/** Increments a KV counter; returns false when it is already at the limit. */
const bump = async (kv, key, limit, ttl) => {
  const n = Number((await kv.get(key)) ?? 0);
  if (n >= limit) return false;
  await kv.put(key, String(n + 1), { expirationTtl: ttl });
  return true;
};

export const handleOtpSend = async (req, env, json) => {
  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(body?.phone);
  if (!isMobile(phone)) return json(req, { error: "מספר טלפון לא תקין" }, 400);
  const kv = env.SMS_KV;
  // A code went out less than a minute ago: it is still valid, use it.
  if (await kv.get(`cd:${phone}`)) return json(req, { ok: true, cooldown: true });
  const ip = req.headers.get("CF-Connecting-IP") || "?";
  const day = israelDay();
  if (!(await bump(kv, `n:ip:${ip}:${new Date().toISOString().slice(0, 13)}`, LIMITS.ipPerHour, 3700))
    || !(await bump(kv, `n:p:${phone}:${day}`, LIMITS.phonePerDay, 90000))
    || !(await bump(kv, `n:g:${day}`, LIMITS.globalPerDay, 90000))) {
    // Over a limit: let the customer continue without the check rather than block the order.
    return json(req, { ok: false, skip: true });
  }
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const sent = await sendSms(env, phone, otpText(code));
  if (!sent.ok) return json(req, { ok: false, skip: true, status: sent.status });
  await kv.put(`otp:${phone}`, JSON.stringify({ h: await sha(`${phone}:${code}`), tries: 0 }), { expirationTtl: OTP_TTL });
  await kv.put(`cd:${phone}`, "1", { expirationTtl: LIMITS.phoneCooldown });
  return json(req, { ok: true });
};

export const handleOtpVerify = async (req, env, json) => {
  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(body?.phone);
  const code = String(body?.code ?? "").replace(/\D/g, "");
  if (!isMobile(phone) || code.length !== 6) return json(req, { error: "קוד שגוי" }, 400);
  const kv = env.SMS_KV;
  const rec = JSON.parse((await kv.get(`otp:${phone}`)) ?? "null");
  if (!rec) return json(req, { error: "הקוד פג, שלחו קוד חדש" }, 410);
  if (rec.h === (await sha(`${phone}:${code}`))) {
    await kv.delete(`otp:${phone}`);
    return json(req, { ok: true });
  }
  rec.tries += 1;
  if (rec.tries >= 5) await kv.delete(`otp:${phone}`);
  else await kv.put(`otp:${phone}`, JSON.stringify(rec), { expirationTtl: OTP_TTL });
  return json(req, { error: rec.tries >= 5 ? "יותר מדי ניסיונות, שלחו קוד חדש" : "קוד שגוי" }, 400);
};

export const handleReady = async (req, env, checkKey) => {
  const body = await req.json().catch(() => ({}));
  try { await checkKey(env, body?.vapid_private); } catch { return new Response("forbidden", { status: 403 }); }
  const phone = normalizePhone(body?.phone);
  if (!isMobile(phone)) return new Response("bad", { status: 400 });
  const out = await sendSms(env, phone, readyText(body?.kind, firstName(body?.name)));
  return Response.json({ ok: out.ok, status: out.status });
};
