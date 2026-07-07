import { supabase } from "@/integrations/supabase/client";
import { VAPID_PUBLIC_KEY, ensureServiceWorker, isPushSupported, iosNeedsInstall } from "./push";

const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

export const subscribeCourierPush = async (
  courierId: string,
): Promise<{ ok: boolean; reason?: string }> => {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (iosNeedsInstall()) return { ok: false, reason: "ios_needs_install" };

  const reg = await ensureServiceWorker();
  if (!reg) return { ok: false, reason: "sw_failed" };
  await navigator.serviceWorker.ready;

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };

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

  // Upsert by endpoint
  const { data: existing } = await supabase
    .from("courier_push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .limit(1);
  if (existing && existing.length) {
    await supabase.from("courier_push_subscriptions").delete().eq("id", existing[0].id);
  }
  const { error } = await supabase.from("courier_push_subscriptions").insert({
    courier_id: courierId,
    endpoint,
    p256dh,
    auth,
    user_agent: navigator.userAgent,
  });
  if (error && (error as any).code !== "23505") {
    console.error("[courier-push] save failed", error);
    return { ok: false, reason: "save_failed" };
  }
  return { ok: true };
};
