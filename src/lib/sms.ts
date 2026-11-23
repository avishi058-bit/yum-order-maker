// Customer SMS through the staff worker (Cloudflare) and SMS4Free.
// Phone check codes: /otp/send and /otp/verify. "Ready" SMS opt-in for dine-in
// and kiosk orders: the order_sms_optin RPC (the database sends the SMS itself
// when the kitchen marks the order ready).
import { supabase } from "@/integrations/supabase/client";
import { RUNTIME_FLAGS } from "@/config/runtimeFlags";

const WORKER = "https://habikta-staff.avishi058.workers.dev";
const TEST_KEY = "habikta_sms_test";
const VERIFIED_KEY = "habikta_verified_phones";
const VERIFIED_DAYS = 90;

/** On for everyone once the flag is on; before that only on a device opened once with ?smstest=1. */
export const smsEnabled = (): boolean => {
  if (RUNTIME_FLAGS.CUSTOMER_SMS) return true;
  try {
    const q = new URLSearchParams(window.location.search).get("smstest");
    if (q === "1") localStorage.setItem(TEST_KEY, "1");
    if (q === "0") localStorage.removeItem(TEST_KEY);
    return localStorage.getItem(TEST_KEY) === "1";
  } catch {
    return false;
  }
};

const cleanPhone = (p: string) => p.replace(/\D/g, "").replace(/^972/, "0");

/** Phones verified on this device recently don't need a code again. */
export const isPhoneVerified = (phone: string): boolean => {
  try {
    const map = JSON.parse(localStorage.getItem(VERIFIED_KEY) ?? "{}") as Record<string, number>;
    const at = map[cleanPhone(phone)];
    return !!at && Date.now() - at < VERIFIED_DAYS * 864e5;
  } catch {
    return false;
  }
};
const rememberVerified = (phone: string) => {
  try {
    const map = JSON.parse(localStorage.getItem(VERIFIED_KEY) ?? "{}") as Record<string, number>;
    map[cleanPhone(phone)] = Date.now();
    localStorage.setItem(VERIFIED_KEY, JSON.stringify(map));
  } catch { /* storage blocked: the customer just gets a code next time */ }
};

const post = async (path: string, body: unknown) => {
  const res = await fetch(`${WORKER}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data: data as { ok?: boolean; skip?: boolean; cooldown?: boolean; error?: string } };
};

/** "sent": code on its way. "skip": SMS not available now, continue without it. "error": show the message. */
export const sendPhoneCode = async (phone: string): Promise<{ result: "sent" | "skip" | "error"; cooldown?: boolean; error?: string }> => {
  try {
    const { ok, data } = await post("/otp/send", { phone: cleanPhone(phone) });
    if (ok && data.ok) return { result: "sent", cooldown: !!data.cooldown };
    if (ok && data.skip) return { result: "skip" };
    return { result: "error", error: data.error || "שגיאה בשליחת הקוד" };
  } catch {
    return { result: "skip" };
  }
};

export const verifyPhoneCode = async (phone: string, code: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const { ok, data } = await post("/otp/verify", { phone: cleanPhone(phone), code });
    if (ok && data.ok) {
      rememberVerified(phone);
      return { ok: true };
    }
    return { ok: false, error: data.error || "קוד שגוי" };
  } catch {
    return { ok: false, error: "אין חיבור, נסו שוב" };
  }
};

/** Ask for a "ready" SMS for this order. Never throws: the order is already placed. */
export const optInReadySms = async (orderId: string, phone: string) => {
  try {
    // Not in the generated types (types.ts is never edited by hand).
    const db = supabase as unknown as { rpc: (fn: string, args: object) => Promise<unknown> };
    await db.rpc("order_sms_optin", {
      p_order: orderId,
      p_phone: cleanPhone(phone),
    });
  } catch { /* the order matters more than the SMS */ }
};
