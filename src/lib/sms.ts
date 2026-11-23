// Customer SMS (SMS4Free, sent by the staff worker on the database's behalf).
// Phone check: otp_request / otp_request_status / otp_verify RPCs. The database
// makes the code, applies the limits and has the worker send it. A phone checked
// on this device stays checked until the customer logs out.
// "Ready" SMS opt-in for dine-in and kiosk orders: the order_sms_optin RPC (the
// database sends the SMS when the kitchen marks the order ready).
import { supabase } from "@/integrations/supabase/client";
import { RUNTIME_FLAGS } from "@/config/runtimeFlags";

const TEST_KEY = "habikta_sms_test";
const VERIFIED_KEY = "habikta_verified_phones";

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

// The RPCs are not in the generated types (types.ts is never edited by hand).
const rpc = <T,>(fn: string, args: object) =>
  (supabase as unknown as { rpc: (f: string, a: object) => Promise<{ data: T | null; error: unknown }> }).rpc(fn, args);

/** Phones checked on this device (until logout). */
export const isPhoneVerified = (phone: string): boolean => {
  try {
    const map = JSON.parse(localStorage.getItem(VERIFIED_KEY) ?? "{}") as Record<string, number>;
    return !!map[cleanPhone(phone)];
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
/** Logout: the next order on this device asks for a code again. */
export const forgetVerifiedPhones = () => {
  try { localStorage.removeItem(VERIFIED_KEY); } catch { /* nothing to forget */ }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * "sent": code on its way (or one went out less than a minute ago - still valid).
 * "skip": SMS not available now (limit or provider down): continue without the check.
 * "error": show the message (bad number).
 */
export const sendPhoneCode = async (phone: string): Promise<{ result: "sent" | "skip" | "error"; cooldown?: boolean; error?: string }> => {
  try {
    const { data, error } = await rpc<{ ok?: boolean; skip?: boolean; cooldown?: boolean; req?: number; error?: string }>(
      "otp_request", { p_phone: cleanPhone(phone) });
    if (error || !data) return { result: "skip" };
    if (data.error) return { result: "error", error: data.error };
    if (!data.ok) return { result: "skip" };
    if (data.cooldown) return { result: "sent", cooldown: true };
    // Wait (up to ~8 seconds) to learn whether the SMS really went out.
    for (let i = 0; i < 12 && data.req; i++) {
      await sleep(i === 0 ? 900 : 600);
      const st = await rpc<string>("otp_request_status", { p_req: data.req });
      if (st.data === "sent") return { result: "sent" };
      if (st.data === "failed") return { result: "skip" };
    }
    return { result: "sent" };
  } catch {
    return { result: "skip" };
  }
};

/** On success also returns the name from this phone's last order (to fill in the details). */
export const verifyPhoneCode = async (phone: string, code: string): Promise<{ ok: boolean; name?: string | null; error?: string }> => {
  try {
    const { data, error } = await rpc<{ ok?: boolean; name?: string | null; error?: string }>(
      "otp_verify", { p_phone: cleanPhone(phone), p_code: code });
    if (error || !data) return { ok: false, error: "אין חיבור, נסו שוב" };
    if (data.ok) {
      rememberVerified(phone);
      return { ok: true, name: data.name ?? null };
    }
    return { ok: false, error: data.error || "קוד שגוי" };
  } catch {
    return { ok: false, error: "אין חיבור, נסו שוב" };
  }
};

/** Ask for a "ready" SMS for this order. Never throws: the order is already placed. */
export const optInReadySms = async (orderId: string, phone: string) => {
  try {
    await rpc("order_sms_optin", { p_order: orderId, p_phone: cleanPhone(phone) });
  } catch { /* the order matters more than the SMS */ }
};
