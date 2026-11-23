// Group order on this device (see src/pages/GroupOrder.tsx).
// - The group being ordered into right now lives in sessionStorage (this tab).
// - The organizer's secret and each person's member token (lets them remove
//   their own unpaid dish) live in localStorage, per group code.
import { supabase } from "@/integrations/supabase/client";

export type GroupMember = {
  order_id: string;
  name: string;
  total: number;
  state: "paid" | "unpaid";
  items: Array<{ name: string; qty: number }> | null;
};
export type GroupInfo = {
  code: string;
  organizer: string;
  dine_in: boolean;
  status: "open" | "locked" | "sent" | "cancelled";
  members: GroupMember[];
};
export type ActiveGroup = { code: string; name: string; organizer: string; dineIn: boolean };

const ACTIVE_KEY = "habikta_group_active";
const keysKey = (code: string) => `habikta_group_${code}`;

// The database functions are newer than the generated types.
const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }> }).rpc(fn, args);

export const getActiveGroup = (): ActiveGroup | null => {
  try { return JSON.parse(sessionStorage.getItem(ACTIVE_KEY) || "null"); } catch { return null; }
};
export const setActiveGroup = (g: ActiveGroup | null) => {
  try {
    if (g) sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(g));
    else sessionStorage.removeItem(ACTIVE_KEY);
  } catch { /* ignore */ }
  window.dispatchEvent(new Event("group-changed"));
};

type Keys = { secret?: string; tokens: Record<string, string>; myName?: string };
export const groupKeys = (code: string): Keys => {
  try { return { tokens: {}, ...JSON.parse(localStorage.getItem(keysKey(code)) || "{}") }; } catch { return { tokens: {} }; }
};
const saveKeys = (code: string, k: Keys) => {
  try { localStorage.setItem(keysKey(code), JSON.stringify(k)); } catch { /* ignore */ }
};
export const rememberMyName = (code: string, name: string) => saveKeys(code, { ...groupKeys(code), myName: name });

export const createGroup = async (name: string, dineIn: boolean) => {
  const { data, error } = await rpc("group_create", { p_name: name, p_dine_in: dineIn });
  if (error || !data?.code) throw new Error(error?.message || "create_failed");
  saveKeys(data.code, { secret: data.secret, tokens: {}, myName: name });
  return data.code as string;
};

export const fetchGroup = async (code: string): Promise<GroupInfo | null> => {
  const { data, error } = await rpc("group_get", { p_code: code });
  if (error) throw new Error(error.message);
  return (data as GroupInfo) ?? null;
};

/** Called by checkout right after the order is created, before the payment page. */
export const attachToGroup = async (code: string, orderId: string, name: string) => {
  const { data, error } = await rpc("group_attach", { p_code: code, p_order: orderId, p_name: name });
  if (error) throw new Error(error.message.includes("group_closed") ? "group_closed" : "attach_failed");
  const k = groupKeys(code);
  k.tokens[orderId] = data.member_token;
  saveKeys(code, k);
};

export const lockGroup = async (code: string) => {
  const { data, error } = await rpc("group_lock", { p_code: code, p_secret: groupKeys(code).secret ?? "" });
  if (error) throw new Error(error.message.includes("group_empty") ? "group_empty" : "lock_failed");
  return !!data?.sent;
};

/** Organizer, or the person who ordered it, removes an unpaid dish. */
export const removeFromGroup = async (code: string, orderId: string) => {
  const k = groupKeys(code);
  const secret = k.tokens[orderId] ?? k.secret ?? "";
  const { error } = await rpc("group_remove", { p_code: code, p_order: orderId, p_secret: secret });
  if (error) throw new Error("remove_failed");
};

export const groupPayInfo = async (code: string, orderId: string) => {
  const { data, error } = await rpc("group_pay_info", { p_code: code, p_order: orderId });
  if (error || !data) return null;
  return data as { order_id: string; total: number; name: string; phone: string };
};

/** Starts the card payment for an unpaid group order (one's own, or someone else's). */
export const payGroupOrder = async (code: string, orderId: string) => {
  const info = await groupPayInfo(code, orderId);
  if (!info) throw new Error("not_unpaid");
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      total: Number(info.total),
      items: [{ name: `הזמנה קבוצתית - ${info.name}`, price: Number(info.total), quantity: 1 }],
      customerName: info.name,
      customerPhone: info.phone,
      orderId,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.sessionUrl) throw new Error(json?.error || "payment_failed");
  window.location.href = json.sessionUrl;
};

export const canManage = (code: string) => !!groupKeys(code).secret;
export const isMine = (code: string, orderId: string) => !!groupKeys(code).tokens[orderId];
