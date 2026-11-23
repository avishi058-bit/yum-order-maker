// SMS for customers, sent through SMS4Free (an Israeli SMS provider).
// - /sms/otp: phone-check codes. The database (otp_request / otp_verify) makes
//   the code, keeps it hashed and applies the limits; the worker only sends it.
// - /sms/ready: the database calls this when the kitchen marks an order ready,
//   after claiming it (once per order). The call carries the staff VAPID private
//   key, checked against the public key like /notify, so only the database can
//   make the worker send (both endpoints).
// The provider's key, user and password are Cloudflare secrets the owner
// enters himself: SMS4FREE_KEY, SMS4FREE_USER, SMS4FREE_PASS.

const WAZE = "https://waze.com/ul?ll=31.43473,34.54170&navigate=yes";

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
  // Name first, then "ready" - that is what shows on the lock screen.
  const hi = name ? `${name}, ` : "";
  if (kind === "delivery") return `${hi}ההזמנה שלך מוכנה ויוצאת אליך! בתאבון! המבורגר הבקתה`;
  if (kind === "pickup") return `${hi}ההזמנה שלך מוכנה! היא מחכה לך בבקתה. בתאבון!\nלניווט בוויז: ${WAZE}`;
  return `${hi}ההזמנה שלך מוכנה! היא מחכה לך בדלפק. בתאבון! המבורגר הבקתה`;
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

export const handleReady = async (req, env, checkKey) => {
  const body = await req.json().catch(() => ({}));
  try { await checkKey(env, body?.vapid_private); } catch { return new Response("forbidden", { status: 403 }); }
  const phone = normalizePhone(body?.phone);
  if (!isMobile(phone)) return new Response("bad", { status: 400 });
  const out = await sendSms(env, phone, readyText(body?.kind, firstName(body?.name)));
  return Response.json({ ok: out.ok, status: out.status });
};

// /sms/otp: the database (otp_request) asks for a phone-check code to be sent.
// Same VAPID check as /sms/ready, so only the database can use it.
export const handleOtpSms = async (req, env, checkKey) => {
  const body = await req.json().catch(() => ({}));
  try { await checkKey(env, body?.vapid_private); } catch { return new Response("forbidden", { status: 403 }); }
  const phone = normalizePhone(body?.phone);
  const code = String(body?.code ?? "");
  if (!isMobile(phone) || !/^\d{6}$/.test(code)) return new Response("bad", { status: 400 });
  const out = await sendSms(env, phone, otpText(code));
  return Response.json({ ok: out.ok, status: out.status });
};
