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
  stock: StockItem[];
  meals: {
    items: { id: string; name: string; price: number }[];
    month_total: number;
    logs: { id: string; name: string; price: number; at: string; can_remove: boolean }[];
  };
}

const KNOWN_ERRORS = ["invalid_link", "week_published", "week_closed", "no_shift", "invalid_subscription", "invalid_time", "appeal_pending", "too_many"];

/** Token-gated database functions behind the employee page. */
const rpc = async <T,>(fn: string, args: Record<string, unknown>) => {
  const { data, error } = await staffDb.rpc(fn, args);
  if (error) throw new Error(KNOWN_ERRORS.find((c) => String(error.message).includes(c)) ?? "error");
  return data as T;
};
export const fetchStaffMe = (token: string) => rpc<StaffMe>("staff_portal_me", { p_token: token });
/** Categories employees see. */
export const STOCK_CATEGORIES = ["סופר", "ירקות", "טייק אווי", "רטבים", "לחמניות", "קפואים", "קציצה", "שתייה"] as const;
export type StockLevel = "out" | "low" | "count";
export interface StockItem { id: string; name: string; category: string; level: StockLevel | null; quantity: number | null }
/** Reported state of a product as short text ("נגמר", "נשאר קצת", "נשארו 2"). */
export const stockText = (level: StockLevel | null, qty: number | null) =>
  level === "out" ? "נגמר" : level === "low" ? "נשאר קצת" : level === "count" ? `נשארו ${qty}` : "יש מספיק";
/** Reports how much is left of a product (units, "a little", "ran out"), or clears the report (null). */
export const setStaffStock = (token: string, itemId: string, level: StockLevel | null, qty?: number) =>
  rpc<void>("staff_portal_stock_set", { p_token: token, p_item_id: itemId, p_level: level, p_qty: qty ?? null });

/** Staff meals: report an item taken, or take back a recent report. */
export const addStaffMeal = (token: string, itemId: string) => rpc<string | null>("staff_portal_meal_add", { p_token: token, p_item_id: itemId });
export const removeStaffMeal = (token: string, logId: string) => rpc<void>("staff_portal_meal_remove", { p_token: token, p_log_id: logId });

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

/**
 * Worked shifts for the dashboard's labour numbers: the old kitchen clock
 * (work_shifts) plus the name-strip clock (staff_time_entries, owner excluded),
 * without counting a shift twice when it exists in both.
 */
export const fetchLaborShifts = async (fromIso: string, toIso?: string) => {
  let oldQ = staffDb.from("work_shifts").select("clock_in, clock_out").gte("clock_in", fromIso);
  let newQ = staffDb.from("staff_time_entries").select("clock_in, clock_out, staff_members(is_owner)").gte("clock_in", fromIso);
  if (toIso) { oldQ = oldQ.lt("clock_in", toIso); newQ = newQ.lt("clock_in", toIso); }
  const [o, n] = await Promise.all([oldQ, newQ]);
  const out: { clock_in: string; clock_out: string | null }[] = [];
  const seen = new Set<number>();
  const rows = [...(o.data ?? []), ...(n.data ?? []).filter((r: { staff_members?: { is_owner?: boolean } }) => !r.staff_members?.is_owner)];
  for (const r of rows) {
    const key = new Date(r.clock_in).getTime();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ clock_in: r.clock_in, clock_out: r.clock_out });
  }
  return out;
};
