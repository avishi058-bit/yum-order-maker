// Edge function: gateway for the inventory page.
// All actions are gated by a secret token. No JWT auth required.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function validateToken(token: string | undefined): Promise<boolean> {
  if (!token || typeof token !== "string" || token.length < 16) return false;
  const { data } = await supabase
    .from("inventory_access_tokens")
    .select("id")
    .eq("token", token)
    .maybeSingle();
  if (!data) return false;
  // touch last_used_at (fire-and-forget)
  supabase
    .from("inventory_access_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { token, action } = body as { token?: string; action?: string };

    const ok = await validateToken(token);
    if (!ok) return json({ error: "invalid_token" }, 401);

    switch (action) {
      case "list": {
        const [itemsRes, recipesRes, movementsRes] = await Promise.all([
          supabase
            .from("inventory_items")
            .select("*")
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true }),
          supabase.from("inventory_recipes").select("*"),
          supabase
            .from("inventory_movements")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(200),
        ]);
        if (itemsRes.error) return json({ error: itemsRes.error.message }, 500);
        return json({
          items: itemsRes.data,
          recipes: recipesRes.data ?? [],
          movements: movementsRes.data ?? [],
        });
      }

      case "adjust": {
        const { item_id, delta, note } = body as {
          item_id: string;
          delta: number;
          note?: string;
        };
        if (!item_id || typeof delta !== "number") {
          return json({ error: "bad_params" }, 400);
        }
        const { data: cur, error: e1 } = await supabase
          .from("inventory_items")
          .select("quantity")
          .eq("id", item_id)
          .maybeSingle();
        if (e1 || !cur) return json({ error: "not_found" }, 404);
        const next = Number(cur.quantity) + delta;
        const { error: e2 } = await supabase
          .from("inventory_items")
          .update({ quantity: next })
          .eq("id", item_id);
        if (e2) return json({ error: e2.message }, 500);
        await supabase.from("inventory_movements").insert({
          inventory_item_id: item_id,
          delta,
          reason: delta >= 0 ? "manual_add" : "manual_remove",
          note: note ?? null,
        });
        return json({ ok: true, quantity: next });
      }

      case "set_quantity": {
        const { item_id, quantity } = body as {
          item_id: string;
          quantity: number;
        };
        if (!item_id || typeof quantity !== "number") {
          return json({ error: "bad_params" }, 400);
        }
        const { data: cur } = await supabase
          .from("inventory_items")
          .select("quantity")
          .eq("id", item_id)
          .maybeSingle();
        const delta = quantity - Number(cur?.quantity ?? 0);
        const { error } = await supabase
          .from("inventory_items")
          .update({ quantity })
          .eq("id", item_id);
        if (error) return json({ error: error.message }, 500);
        await supabase.from("inventory_movements").insert({
          inventory_item_id: item_id,
          delta,
          reason: "manual_add",
          note: "set_quantity",
        });
        return json({ ok: true });
      }

      case "update_item": {
        const { item_id, patch } = body as {
          item_id: string;
          patch: Record<string, unknown>;
        };
        if (!item_id || !patch) return json({ error: "bad_params" }, 400);
        const allowed = [
          "name",
          "category",
          "unit",
          "low_threshold",
          "presets",
          "menu_item_id",
          "sort_order",
          "notes",
        ];
        const clean: Record<string, unknown> = {};
        for (const k of allowed) if (k in patch) clean[k] = (patch as Record<string, unknown>)[k];
        const { error } = await supabase
          .from("inventory_items")
          .update(clean)
          .eq("id", item_id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      case "create_item": {
        const { item } = body as { item: Record<string, unknown> };
        if (!item || !item.name) return json({ error: "bad_params" }, 400);
        const { data, error } = await supabase
          .from("inventory_items")
          .insert(item)
          .select()
          .single();
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, item: data });
      }

      case "delete_item": {
        const { item_id } = body as { item_id: string };
        if (!item_id) return json({ error: "bad_params" }, 400);
        const { error } = await supabase
          .from("inventory_items")
          .delete()
          .eq("id", item_id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      case "set_recipe": {
        // Upsert a recipe row (menu_item_id + inventory_item_id)
        const { menu_item_id, inventory_item_id, amount_per_unit } = body as {
          menu_item_id: string;
          inventory_item_id: string;
          amount_per_unit: number;
        };
        if (!menu_item_id || !inventory_item_id) {
          return json({ error: "bad_params" }, 400);
        }
        if (amount_per_unit === 0) {
          await supabase
            .from("inventory_recipes")
            .delete()
            .eq("menu_item_id", menu_item_id)
            .eq("inventory_item_id", inventory_item_id);
          return json({ ok: true });
        }
        const { error } = await supabase
          .from("inventory_recipes")
          .upsert(
            { menu_item_id, inventory_item_id, amount_per_unit },
            { onConflict: "menu_item_id,inventory_item_id" },
          );
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      case "set_menu_available": {
        // Toggle menu_availability for a menu item (used when stock hits 0).
        const { menu_item_id, available } = body as {
          menu_item_id: string;
          available: boolean;
        };
        if (!menu_item_id) return json({ error: "bad_params" }, 400);
        const { error } = await supabase
          .from("menu_availability")
          .upsert(
            { item_id: menu_item_id, available },
            { onConflict: "item_id" },
          );
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      case "item_movements": {
        const { item_id, limit } = body as { item_id: string; limit?: number };
        if (!item_id) return json({ error: "bad_params" }, 400);
        const { data, error } = await supabase
          .from("inventory_movements")
          .select("*")
          .eq("inventory_item_id", item_id)
          .order("created_at", { ascending: false })
          .limit(Math.min(limit ?? 30, 200));
        if (error) return json({ error: error.message }, 500);
        return json({ movements: data });
      }

      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
