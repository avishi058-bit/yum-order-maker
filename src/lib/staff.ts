// Staff shifts: employee page API (token-gated edge function), push sign-up,
// and Israel-time formatting shared by the staff, admin and kitchen screens.
import { supabase } from "@/integrations/supabase/client";
import { isPushSupported, iosNeedsInstall } from "./push";

/** Untyped client for the staff_* tables (not in the generated types file). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const staffDb = supabase as any;

export const STAFF_TOKEN_KEY = "habikta_staff_token";
const TZ = "Asia/Jerusalem";

export interface StaffDay { date: string; label: string; starts_at: string; ends_at: string; requested: boolean }
export interface StaffShift { date: string; label: string; starts_at: string; ends_at: string; mine: boolean; team: string[] }
export interface StaffAppeal { status: "pending" | "approved" | "rejected"; claimed_in: string }
export interface StaffEntry { id: string; appeal: StaffAppeal | null; clock_in: string; clock_out: string | null; label: string; minutes: number; late_minutes: number; auto_closed: boolean }
export interface StaffMe {
  me: { name: string; is_owner: boolean };
  /** Null until the staff worker (push + calendar) is set up. */
  calendar_url: string | null;
  push_key: string | null;
  next_week: {
    week_start: string; published: boolean; submitted_at: string | null;
    closed: { date: string; label: string }[]; days: StaffDay[];
  };
  upcoming: StaffShift[];
  month: { minutes: number; late_count: number; entries: StaffEntry[] };
  open_since: string | null;
}

const KNOWN_ERRORS = ["invalid_link", "week_published", "week_closed", "no_shift", "invalid_subscription", "invalid_time", "appeal_pending"];

/** Token-gated database functions behind the employee page. */
const rpc = async <T,>(fn: string, args: Record<string, unknown>) => {
  const { data, error } = await staffDb.rpc(fn, args);
  if (error) throw new Error(KNOWN_ERRORS.find((c) => String(error.message).includes(c)) ?? "error");
  return data as T;
};
export const fetchStaffMe = (token: string) => rpc<StaffMe>("staff_portal_me", { p_token: token });
/** Asks the admin to correct a shift's arrival time ("HH:MM", Israel time). */
export const appealStaffEntry = (token: string, entryId: string, time: string) =>
  rpc<void>("staff_portal_appeal", { p_token: token, p_entry_id: entryId, p_time: time });

/** Sends the whole week's availability in one go (replaces an earlier submission). */
export const submitStaffWeek = (token: string, weekStart: string, dates: string[]) =>
  rpc<void>("staff_portal_submit", { p_token: token, p_week_start: weekStart, p_dates: dates });

const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/**
 * Staff reminders come from the staff worker, which signs with its own VAPID
 * key. A separate service-worker registration (scope /staff/) keeps this
 * subscription apart from the customer and kitchen push subscriptions.
 */
export const subscribeStaffPush = async (token: string, pushKey: string): Promise<{ ok: boolean; reason?: string }> => {
  if (iosNeedsInstall()) return { ok: false, reason: "ios_needs_install" };
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  let reg: ServiceWorkerRegistration;
  try {
    reg = (await navigator.serviceWorker.getRegistration("/staff/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/staff/" }));
  } catch {
    return { ok: false, reason: "sw_failed" };
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };
  try {
    const sub = (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(pushKey) as BufferSource }));
    const keys = sub.toJSON().keys ?? {};
    await rpc<void>("staff_portal_push", { p_token: token, p_endpoint: sub.endpoint, p_p256dh: keys.p256dh ?? "", p_auth: keys.auth ?? "" });
    return { ok: true };
  } catch {
    return { ok: false, reason: "save_failed" };
  }
};

// ─── Israel-time formatting ──────────────────────────────────────────
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("he-IL", { timeZone: TZ, ...opts });
export const timeIL = (iso: string) => fmt({ hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "מוצ״ש"];
/** Short day name; Saturday is always "מוצ״ש" (shifts start after Shabbat ends). */
export const dayNameIL = (ymdOrIso: string) => {
  const ymd = ymdOrIso.length === 10 ? ymdOrIso : new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(ymdOrIso));
  return DAY_NAMES[new Date(`${ymd}T12:00:00Z`).getUTCDay()];
};
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
