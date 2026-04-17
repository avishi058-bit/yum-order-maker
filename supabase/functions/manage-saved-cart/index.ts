/**
 * manage-saved-cart
 * Single endpoint for all saved-cart operations (get/upsert/delete).
 * Identity is established by `guest_id` (from localStorage) OR `phone`
 * (for logged-in customers). The function uses service role to bypass
 * the locked-down RLS, but enforces ownership via the request body.
 *
 * Action contract:
 *   { action: "get",    guest_id?, phone? }
 *   { action: "upsert", guest_id?, phone?, items, dine_in, total, customer_name }
 *   { action: "delete", guest_id?, phone? }
 *   { action: "mark",   guest_id?, phone?, last_action }
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
    const { action, guest_id, phone } = body;

    // Identity is mandatory — either a phone or a guest id
    const identityColumn = phone ? "phone" : "guest_id";
    const identityValue = phone ?? guest_id;

    if (!identityValue || typeof identityValue !== "string" || identityValue.length < 4) {
      return jsonResponse({ error: "missing_identity" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "get") {
      const { data } = await supabase
        .from("saved_carts")
        .select("*")
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
