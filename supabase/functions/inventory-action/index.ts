// Edge function: gateway for the inventory page.
// All actions are gated by a token from public.inventory_access_tokens.
// Tokens now support:
//   - `expires_at`  — after this time, the token stops working
//   - `revoked_at`  — manually killing a specific token
//   - `scope`       — "admin" (full access + financial stats) or
//                     "inventory" (stock CRUD only, no revenue reads)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeadersFor } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type TokenScope = "admin" | "inventory";

interface TokenValidation {
  ok: boolean;
  scope: TokenScope;
}

async function validateToken(token: string | undefined): Promise<TokenValidation> {
  if (!token || typeof token !== "string" || token.length < 16) {
    return { ok: false, scope: "inventory" };
  }
  const { data } = await supabase
    .from("inventory_access_tokens")
    .select("id, scope, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!data) return { ok: false, scope: "inventory" };
  if (data.revoked_at) return { ok: false, scope: "inventory" };
  if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) {
    return { ok: false, scope: "inventory" };
  }
  // touch last_used_at (fire-and-forget)
  supabase
    .from("inventory_access_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});
  return { ok: true, scope: (data.scope as TokenScope) ?? "admin" };
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { token, action } = body as { token?: string; action?: string };

    const validation = await validateToken(token);
    if (!validation.ok) return json({ error: "invalid_token" }, 401);

    // Actions that expose financial/order data require admin scope.
    const ADMIN_ONLY_ACTIONS = new Set([
      "stats",
      "list_tokens",
      "create_token",
      "revoke_token",
      "rotate_token",
    ]);
    if (ADMIN_ONLY_ACTIONS.has(action ?? "") && validation.scope !== "admin") {
      return json({ error: "insufficient_scope" }, 403);
    }


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
        const { item_id, delta, note, reason } = body as {
          item_id: string;
          delta: number;
          note?: string;
          reason?: string;
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
        const finalReason =
          reason ?? (delta >= 0 ? "manual_add" : "manual_remove");
        await supabase.from("inventory_movements").insert({
          inventory_item_id: item_id,
          delta,
          reason: finalReason,
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
          "unit_cost",
          "fridge_target",
          "fridge_qty",
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

      case "record_purchase": {
        // Add stock from a purchase, optionally storing the unit cost paid.
        const { item_id, qty, unit_cost, note } = body as {
          item_id: string;
          qty: number;
          unit_cost?: number;
          note?: string;
        };
        if (!item_id || typeof qty !== "number" || qty <= 0) {
          return json({ error: "bad_params" }, 400);
        }
        const { data: cur } = await supabase
          .from("inventory_items")
          .select("quantity")
          .eq("id", item_id)
          .maybeSingle();
        if (!cur) return json({ error: "not_found" }, 404);
        const next = Number(cur.quantity) + qty;
        const updates: Record<string, unknown> = { quantity: next };
        if (typeof unit_cost === "number" && unit_cost > 0) {
          updates.unit_cost = unit_cost;
        }
        const { error: e2 } = await supabase
          .from("inventory_items")
          .update(updates)
          .eq("id", item_id);
        if (e2) return json({ error: e2.message }, 500);
        await supabase.from("inventory_movements").insert({
          inventory_item_id: item_id,
          delta: qty,
          reason: "purchase",
          note: note ?? null,
          unit_cost: typeof unit_cost === "number" ? unit_cost : null,
        });
        return json({ ok: true, quantity: next });
      }

      case "mark_out_of_stock": {
        // Zero the item and record the remaining qty as waste.
        const { item_id, note } = body as { item_id: string; note?: string };
        if (!item_id) return json({ error: "bad_params" }, 400);
        const { data: cur } = await supabase
          .from("inventory_items")
          .select("quantity")
          .eq("id", item_id)
          .maybeSingle();
        if (!cur) return json({ error: "not_found" }, 404);
        const remaining = Number(cur.quantity);
        if (remaining > 0) {
          await supabase
            .from("inventory_items")
            .update({ quantity: 0 })
            .eq("id", item_id);
          await supabase.from("inventory_movements").insert({
            inventory_item_id: item_id,
            delta: -remaining,
            reason: "waste",
            note: note ?? "נגמר בפועל",
          });
        }
        return json({ ok: true });
      }

      case "stats": {
        const { from, to } = body as { from?: string; to?: string };
        const now = new Date();
        const defFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const defTo = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
        const fromIso = from ?? defFrom;
        const toIso = to ?? defTo;

        const [itemsRes, movsRes, ordersRes, orderItemsRes] = await Promise.all([
          supabase.from("inventory_items").select("*"),
          supabase
            .from("inventory_movements")
            .select("*")
            .gte("created_at", fromIso)
            .lt("created_at", toIso),
          supabase
            .from("orders")
            .select("id,total,status,created_at")
            .gte("created_at", fromIso)
            .lt("created_at", toIso)
            .neq("status", "cancelled"),
          supabase
            .from("order_items")
            .select("item_id,item_name,quantity,price,created_at")
            .gte("created_at", fromIso)
            .lt("created_at", toIso),
        ]);

        if (itemsRes.error) return json({ error: itemsRes.error.message }, 500);

        type Item = {
          id: string;
          name: string;
          category: string;
          unit: string;
          quantity: number;
          unit_cost: number;
        };
        const items = (itemsRes.data ?? []) as Item[];
        const movs = movsRes.data ?? [];
        const orders = ordersRes.data ?? [];
        const orderItems = orderItemsRes.data ?? [];

        const perItem = items.map((it) => {
          const my = movs.filter((m: { inventory_item_id: string }) => m.inventory_item_id === it.id);
          let purchased = 0, purchasedValue = 0, waste = 0, consumed = 0, manualAdd = 0, manualRemove = 0;
          for (const m of my as Array<{ delta: number; reason: string; unit_cost: number | null }>) {
            const d = Number(m.delta);
            if (m.reason === "purchase" || (m.reason === "manual_add" && d > 0)) {
              if (m.reason === "purchase") {
                purchased += d;
                purchasedValue += d * (Number(m.unit_cost) || Number(it.unit_cost) || 0);
              } else {
                manualAdd += d;
              }
            } else if (m.reason === "waste") {
              waste += Math.abs(d);
            } else if (m.reason === "order_ready") {
              consumed += Math.abs(d);
            } else if (m.reason === "manual_remove") {
              manualRemove += Math.abs(d);
            }
          }
          const cost = Number(it.unit_cost) || 0;
          return {
            id: it.id,
            name: it.name,
            category: it.category,
            unit: it.unit,
            current_qty: Number(it.quantity),
            unit_cost: cost,
            current_value: Number(it.quantity) * cost,
            purchased_qty: purchased,
            purchased_value: purchasedValue || purchased * cost,
            manual_added_qty: manualAdd,
            manual_added_value: manualAdd * cost,
            waste_qty: waste,
            waste_value: waste * cost,
            consumed_qty: consumed,
            consumed_value: consumed * cost,
            manual_removed_qty: manualRemove,
          };
        });

        const totals = {
          purchases_value: perItem.reduce((s, p) => s + p.purchased_value, 0),
          manual_added_value: perItem.reduce((s, p) => s + p.manual_added_value, 0),
          waste_value: perItem.reduce((s, p) => s + p.waste_value, 0),
          consumed_value: perItem.reduce((s, p) => s + p.consumed_value, 0),
          current_value: perItem.reduce((s, p) => s + p.current_value, 0),
          revenue: orders.reduce((s: number, o: { total: number }) => s + Number(o.total || 0), 0),
          orders_count: orders.length,
        };

        // top selling menu items in period
        const sellMap = new Map<string, { name: string; qty: number; revenue: number }>();
        for (const oi of orderItems as Array<{ item_id: string; item_name: string; quantity: number; price: number }>) {
          const key = oi.item_id || oi.item_name;
          const cur = sellMap.get(key) ?? { name: oi.item_name, qty: 0, revenue: 0 };
          cur.qty += Number(oi.quantity) || 0;
          cur.revenue += (Number(oi.price) || 0) * (Number(oi.quantity) || 0);
          sellMap.set(key, cur);
        }
        const topItems = Array.from(sellMap.entries())
          .map(([id, v]) => ({ id, ...v }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 30);

        return json({ from: fromIso, to: toIso, per_item: perItem, totals, top_items: topItems });
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

      case "fridge_set_target": {
        const { item_id, fridge_target } = body as { item_id: string; fridge_target: number };
        if (!item_id || typeof fridge_target !== "number" || fridge_target < 0) {
          return json({ error: "bad_params" }, 400);
        }
        const { error } = await supabase
          .from("inventory_items")
          .update({ fridge_target: Math.round(fridge_target) })
          .eq("id", item_id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      case "fridge_mark_refilled": {
        // Mark items as fully refilled. Either a single item (item_id) or all tracked items.
        const { item_id, items } = body as { item_id?: string; items?: Array<{ id: string; qty: number }> };
        if (Array.isArray(items) && items.length > 0) {
          for (const it of items) {
            await supabase
              .from("inventory_items")
              .update({ fridge_qty: Math.max(0, Math.round(it.qty)) })
              .eq("id", it.id);
          }
          return json({ ok: true });
        }
        if (item_id) {
          const { data: cur } = await supabase
            .from("inventory_items")
            .select("fridge_target")
            .eq("id", item_id)
            .maybeSingle();
          if (!cur) return json({ error: "not_found" }, 404);
          const { error } = await supabase
            .from("inventory_items")
            .update({ fridge_qty: Number(cur.fridge_target) || 0 })
            .eq("id", item_id);
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true });
        }
        return json({ error: "bad_params" }, 400);
      }

      case "fridge_set_qty": {
        const { item_id, fridge_qty } = body as { item_id: string; fridge_qty: number };
        if (!item_id || typeof fridge_qty !== "number" || fridge_qty < 0) {
          return json({ error: "bad_params" }, 400);
        }
        const { error } = await supabase
          .from("inventory_items")
          .update({ fridge_qty: Math.round(fridge_qty) })
          .eq("id", item_id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      // ---- Token management (admin-scope only) ----
      case "list_tokens": {
        const { data, error } = await supabase
          .from("inventory_access_tokens")
          .select("id, label, scope, expires_at, revoked_at, created_at, last_used_at")
          .order("created_at", { ascending: false });
        if (error) return json({ error: error.message }, 500);
        return json({ tokens: data ?? [] });
      }

      case "create_token": {
        const { label, scope, expires_in_days } = body as {
          label?: string;
          scope?: TokenScope;
          expires_in_days?: number;
        };
        const nextScope: TokenScope = scope === "inventory" ? "inventory" : "admin";
        const days = typeof expires_in_days === "number" && expires_in_days > 0
          ? Math.min(365, Math.floor(expires_in_days))
          : null;
        const expires_at = days ? new Date(Date.now() + days * 86400_000).toISOString() : null;
        // Cryptographically random URL-safe token (~44 chars).
        const buf = new Uint8Array(32);
        crypto.getRandomValues(buf);
        const newToken = btoa(String.fromCharCode(...buf))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const { data, error } = await supabase
          .from("inventory_access_tokens")
          .insert({ token: newToken, label: label ?? null, scope: nextScope, expires_at })
          .select("id, label, scope, expires_at, created_at")
          .single();
        if (error) return json({ error: error.message }, 500);
        // Return the token value ONCE — caller must save it now.
        return json({ ok: true, token: newToken, record: data });
      }

      case "revoke_token": {
        const { token_id } = body as { token_id?: string };
        if (!token_id) return json({ error: "bad_params" }, 400);
        const { error } = await supabase
          .from("inventory_access_tokens")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", token_id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      case "rotate_token": {
        // Convenience: create a new token with the same scope/label as an
        // existing one, then revoke the old. Caller receives the new value.
        const { token_id, expires_in_days } = body as {
          token_id?: string;
          expires_in_days?: number;
        };
        if (!token_id) return json({ error: "bad_params" }, 400);
        const { data: prev } = await supabase
          .from("inventory_access_tokens")
          .select("label, scope")
          .eq("id", token_id)
          .maybeSingle();
        if (!prev) return json({ error: "not_found" }, 404);
        const days = typeof expires_in_days === "number" && expires_in_days > 0
          ? Math.min(365, Math.floor(expires_in_days))
          : null;
        const expires_at = days ? new Date(Date.now() + days * 86400_000).toISOString() : null;
        const buf = new Uint8Array(32);
        crypto.getRandomValues(buf);
        const newToken = btoa(String.fromCharCode(...buf))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const { data, error } = await supabase
          .from("inventory_access_tokens")
          .insert({
            token: newToken,
            label: prev.label,
            scope: prev.scope,
            expires_at,
          })
          .select("id, label, scope, expires_at, created_at")
          .single();
        if (error) return json({ error: error.message }, 500);
        await supabase
          .from("inventory_access_tokens")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", token_id);
        return json({ ok: true, token: newToken, record: data });
      }

      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
