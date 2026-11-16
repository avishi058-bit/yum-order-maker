// Staff shifts: employee page API (token-gated edge function), push sign-up,
// and Israel-time formatting shared by the staff, admin and kitchen screens.
import { supabase } from "@/integrations/supabase/client";
import { VAPID_PUBLIC_KEY, ensureServiceWorker, isPushSupported, iosNeedsInstall } from "./push";

/** Untyped client for the staff_* tables (not in the generated types file). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const staffDb = supabase as any;

export const STAFF_TOKEN_KEY = "habikta_staff_token";
const TZ = "Asia/Jerusalem";

export interface StaffDay { date: string; starts_at: string; ends_at: string; requested: boolean }
export interface StaffShift { date: string; starts_at: string; ends_at: string; mine: boolean; team: string[] }
export interface StaffEntry { clock_in: string; clock_out: string | null; minutes: number; late_minutes: number; auto_closed: boolean }
export interface StaffMe {
  me: { name: string; is_owner: boolean };
  calendar_url: string;
  next_week: { week_start: string; published: boolean; days: StaffDay[] };
  upcoming: StaffShift[];
  month: { minutes: number; late_count: number; entries: StaffEntry[] };
  open_since: string | null;
}

export const callStaffPortal = async <T = unknown>(token: string, action: string, extra: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.functions.invoke("staff-portal", { body: { token, action, ...extra } });
  if (error) {
    // Supabase wraps non-2xx; read the JSON error code when there is one.
    let code = "error";
    try { code = (await (error as { context?: Response }).context?.json())?.error ?? code; } catch { /* ignore */ }
    throw new Error(code);
  }
  return data as T;
};

const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const subscribeStaffPush = async (token: string): Promise<{ ok: boolean; reason?: string }> => {
  if (iosNeedsInstall()) return { ok: false, reason: "ios_needs_install" };
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  const reg = await ensureServiceWorker();
  if (!reg) return { ok: false, reason: "sw_failed" };
  await navigator.serviceWorker.ready;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };
  const sub = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource }));
  const keys = sub.toJSON().keys ?? {};
  try {
    await callStaffPortal(token, "push_subscribe", { endpoint: sub.endpoint, p256dh: keys.p256dh ?? "", auth: keys.auth ?? "" });
    return { ok: true };
  } catch {
    return { ok: false, reason: "save_failed" };
  }
};

// ─── Israel-time formatting ──────────────────────────────────────────
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("he-IL", { timeZone: TZ, ...opts });
export const timeIL = (iso: string) => fmt({ hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
export const dayNameIL = (ymdOrIso: string) =>
  fmt({ weekday: "long" }).format(new Date(ymdOrIso.length === 10 ? `${ymdOrIso}T12:00:00Z` : ymdOrIso));
export const dateIL = (ymdOrIso: string) =>
  fmt({ day: "numeric", month: "numeric" }).format(new Date(ymdOrIso.length === 10 ? `${ymdOrIso}T12:00:00Z` : ymdOrIso));
export const todayIL = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
export const addDaysYmd = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const weekStartYmd = (ymd: string) => addDaysYmd(ymd, -new Date(`${ymd}T12:00:00Z`).getUTCDay());

/** "12:30 ש'" style total for minutes. */
export const hoursText = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
};
