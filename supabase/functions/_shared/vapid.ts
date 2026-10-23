// Web-push VAPID keys.
// Uses the VAPID_* env secrets when set; otherwise reads them once from the
// service-role-only public.internal_config table (keys vapid_public_key,
// vapid_private_key, vapid_subject). Values are never logged or returned.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export async function loadVapid(): Promise<VapidKeys> {
  const envPublic = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const envPrivate = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const envSubject = Deno.env.get("VAPID_SUBJECT") ?? "";
  if (envPublic && envPrivate) {
    return { publicKey: envPublic, privateKey: envPrivate, subject: envSubject || "mailto:contact@example.com" };
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await supabase
      .from("internal_config")
      .select("key, value")
      .in("key", ["vapid_public_key", "vapid_private_key", "vapid_subject"]);
    if (error || !data) throw error ?? new Error("no rows");
    const get = (k: string) => data.find((r) => r.key === k)?.value ?? "";
    return {
      publicKey: get("vapid_public_key"),
      privateKey: get("vapid_private_key"),
      subject: get("vapid_subject") || envSubject || "mailto:contact@example.com",
    };
  } catch (_e) {
    console.error("VAPID keys not available");
    return { publicKey: "", privateKey: "", subject: envSubject || "mailto:contact@example.com" };
  }
}
