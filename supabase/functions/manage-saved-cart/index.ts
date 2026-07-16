/**
 * manage-saved-cart
 * Single endpoint for all saved-cart operations (get/upsert/delete).
 *
 * SECURITY:
 * - Guest access uses guest_id (an opaque client-generated UUID from localStorage
 *   — an attacker cannot enumerate guests).
 * - Phone-based access REQUIRES a matching device_token proving the caller is
 *   the customer who registered that phone. Without a valid device_token,
 *   requests keyed by phone are rejected. This prevents anyone from reading,
 *   modifying, or deleting a customer's saved cart just by knowing their phone.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  action: "get" | "upsert" | "delete" | "mark";
  guest_id?: string | null;
  phone?: string | null;
  device_token?: string | null;
  items?: unknown[];
  dine_in?: boolean | null;
  total?: number;
  customer_name?: string | null;
  last_action?: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Body;
    const { action, guest_id, phone, device_token } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Establish identity: phone (auth) requires proof; guest_id is a private UUID.
    let identityColumn: "phone" | "guest_id";
    let identityValue: string;

    // A valid guest_id must look like a UUID or a hex/base64url string of
    // adequate length. This blocks trivial short strings, sequential ids
    // (e.g. "guest-1"), and other low-entropy values.
    const GUEST_ID_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const GUEST_ID_TOKEN = /^[A-Za-z0-9_-]{24,128}$/;
    const isValidGuestId = (v: string) =>
      GUEST_ID_UUID.test(v) || GUEST_ID_TOKEN.test(v);

    if (phone) {
      if (
        !device_token ||
        typeof device_token !== "string" ||
        device_token.length < 32
      ) {
        return jsonResponse({ error: "unauthorized" }, 401);
      }
      // Verify device_token belongs to this phone.
      const { data: customer } = await supabase
        .from("customers")
        .select("phone")
        .eq("device_token", device_token)
        .eq("phone", phone)
        .maybeSingle();
      if (!customer) return jsonResponse({ error: "unauthorized" }, 401);
      identityColumn = "phone";
      identityValue = phone;
    } else if (guest_id && typeof guest_id === "string" && isValidGuestId(guest_id)) {
      identityColumn = "guest_id";
      identityValue = guest_id;
    } else {
      return jsonResponse({ error: "missing_identity" }, 400);
    }

    if (action === "get") {
      const { data } = await supabase
        .from("saved_carts")
        .select("id, items, dine_in, total, customer_name, updated_at")
        .eq(identityColumn, identityValue)
        .maybeSingle();
      return jsonResponse({ cart: data ?? null });
    }


    if (action === "upsert") {
      const { items, dine_in, total, customer_name } = body;
      if (!Array.isArray(items)) return jsonResponse({ error: "invalid_items" }, 400);

      const { data: existing } = await supabase
        .from("saved_carts")
        .select("id")
        .eq(identityColumn, identityValue)
        .maybeSingle();

      const payload = {
        phone: phone ?? null,
        guest_id: phone ? null : guest_id,
        customer_name: customer_name ?? null,
        items,
        dine_in: dine_in ?? null,
        total: Number(total ?? 0),
        last_action: "updated",
      };

      if (existing?.id) {
        await supabase.from("saved_carts").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("saved_carts").insert(payload);
      }
      return jsonResponse({ ok: true });
    }

    if (action === "delete") {
      await supabase.from("saved_carts").delete().eq(identityColumn, identityValue);
      return jsonResponse({ ok: true });
    }

    if (action === "mark") {
      await supabase
        .from("saved_carts")
        .update({ last_action: body.last_action ?? "updated" })
        .eq(identityColumn, identityValue);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "invalid_action" }, 400);
  } catch (err) {
    console.error("manage-saved-cart error:", err);
    return jsonResponse({ error: "server_error" }, 500);
  }
});
