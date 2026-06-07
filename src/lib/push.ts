import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY =
  "BFD4YbeYcDZRm60f0Vw6_CuGSOz02wRvH_G7k6jgyicFCOOoKS8hEDLWbvHBiZDF7uTQU8T895zZ43Ga3dNbfrg";

export const isPushSupported = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
};

export const isIos = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // iPhone / iPod / iPad (older)
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as Mac but is touch-enabled
  if (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document) return true;
  return false;
};

export const isSafari = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
};

export const isStandalonePwa = (): boolean => {
  if (typeof window === "undefined") return false;
  // iOS uses navigator.standalone, others use display-mode media query
  return (
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    (window.navigator as any).standalone === true
  );
};

/** iOS 16.4+ supports web push only when the site is installed as a PWA. */
export const iosNeedsInstall = (): boolean => isIos() && !isStandalonePwa();

const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

export const ensureServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/sw.js");
    if (existing) return existing;
    return await navigator.serviceWorker.register("/sw.js");
  } catch (e) {
    console.error("[push] SW registration failed", e);
    return null;
  }
};

export const subscribeToPush = async (params: {
  orderId?: string | null;
  customerPhone?: string;
}): Promise<{ ok: boolean; reason?: string }> => {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (iosNeedsInstall()) return { ok: false, reason: "ios_needs_install" };

  const reg = await ensureServiceWorker();
  if (!reg) return { ok: false, reason: "sw_failed" };

  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  const json = sub.toJSON();
  const endpoint = sub.endpoint;
  const p256dh = (json.keys && json.keys.p256dh) || "";
  const auth = (json.keys && json.keys.auth) || "";

  const { error } = await supabase.from("push_subscriptions").insert({
    order_id: params.orderId ?? null,
    customer_phone: params.customerPhone ?? null,
    endpoint,
    p256dh,
    auth,
  });

  // 23505 = unique_violation → already subscribed, fine
  if (error && (error as any).code !== "23505") {
    console.error("[push] save subscription failed", error);
    return { ok: false, reason: "save_failed" };
  }

  return { ok: true };
};

export const getExistingSubscription = async (): Promise<PushSubscription | null> => {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return null;
  return await reg.pushManager.getSubscription();
};

/**
 * Subscribe THIS device as a kitchen device — it will receive a push every time
 * a new order is created (via DB trigger → notify-kitchen-new-order edge fn).
 */
export const subscribeKitchenToPush = async (): Promise<{ ok: boolean; reason?: string }> => {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (iosNeedsInstall()) return { ok: false, reason: "ios_needs_install" };

  const reg = await ensureServiceWorker();
  if (!reg) return { ok: false, reason: "sw_failed" };
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  const json = sub.toJSON();
  const endpoint = sub.endpoint;
  const p256dh = (json.keys && json.keys.p256dh) || "";
  const auth = (json.keys && json.keys.auth) || "";

  // Manual upsert by endpoint: try update first, then insert if nothing matched.
  const { data: existing } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .limit(1);

  let err: any = null;
  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from("push_subscriptions")
      .update({ p256dh, auth, is_kitchen: true })
      .eq("id", existing[0].id);
    err = error;
  } else {
    const { error } = await supabase
      .from("push_subscriptions")
      .insert({ endpoint, p256dh, auth, is_kitchen: true });
    err = error;
  }

  if (err && (err as any).code !== "23505") {
    console.error("[push] save kitchen subscription failed", err);
    return { ok: false, reason: "save_failed" };
  }
  return { ok: true };
};

export const isKitchenSubscribed = async (): Promise<boolean> => {
  const sub = await getExistingSubscription();
  if (!sub) return false;
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", sub.endpoint)
    .eq("is_kitchen", true)
    .maybeSingle();
  return !!data;
};

/**
 * Turn OFF kitchen push for THIS device — flips is_kitchen to false on the row
 * matching this device's endpoint so the kitchen notifier skips it.
 */
export const unsubscribeKitchenFromPush = async (): Promise<{ ok: boolean; reason?: string }> => {
  const sub = await getExistingSubscription();
  if (!sub) return { ok: true };
  const { error } = await supabase
    .from("push_subscriptions")
    .update({ is_kitchen: false })
    .eq("endpoint", sub.endpoint);
  if (error) {
    console.error("[push] unsubscribe kitchen failed", error);
    return { ok: false, reason: "update_failed" };
  }
  return { ok: true };
};


