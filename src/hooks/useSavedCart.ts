import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import type { CartItem } from "@/components/CartDrawer";

const GUEST_ID_KEY = "habakta_guest_id";
const SAVE_DEBOUNCE_MS = 800;
const MAX_AGE_HOURS = 48;

function getOrCreateGuestId(): string {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `g_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

export interface SavedCart {
  id: string;
  items: CartItem[];
  dineIn: boolean | null;
  total: number;
  customerName: string | null;
  updatedAt: string;
}

interface UseSavedCartArgs {
  cart: CartItem[];
  dineIn: boolean | null;
  total: number;
  /** True when an order is currently in progress (e.g. checkout open). Pauses save+prompt. */
  paused?: boolean;
}

/**
 * Manages the persisted "saved cart" for both guests and logged-in customers.
 *
 * Storage strategy: server (Supabase) is the source of truth, with a localStorage
 * mirror for instant first paint. Identity uses phone (when logged in) or a
 * persistent guest_id stored in localStorage.
 */
export function useSavedCart({ cart, dineIn, total, paused = false }: UseSavedCartArgs) {
  const { customer } = useCustomerAuth();
  const [savedCart, setSavedCart] = useState<SavedCart | null>(null);
  const [loaded, setLoaded] = useState(false);
  const skipNextSaveRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  // Identity (phone if logged in, otherwise the persistent guest id)
  const phone = customer?.phone ?? null;
  const guestId = getOrCreateGuestId();

  // ── Initial fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const query = supabase.from("saved_carts").select("*");
      const { data, error } = phone
        ? await query.eq("phone", phone).maybeSingle()
        : await query.eq("guest_id", guestId).maybeSingle();

      if (cancelled) return;

      if (!error && data) {
        const ageMs = Date.now() - new Date(data.updated_at).getTime();
        const ageHours = ageMs / (1000 * 60 * 60);
        if (ageHours <= MAX_AGE_HOURS && Array.isArray(data.items) && (data.items as unknown as CartItem[]).length > 0) {
          setSavedCart({
            id: data.id,
            items: data.items as unknown as CartItem[],
            dineIn: data.dine_in,
            total: Number(data.total),
            customerName: data.customer_name,
            updatedAt: data.updated_at,
          });
        } else if (ageHours > MAX_AGE_HOURS) {
          // Expired — best-effort cleanup
          await supabase.from("saved_carts").delete().eq("id", data.id);
        }
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // Re-run when identity changes (e.g. user logs in mid-session)
  }, [phone, guestId]);

  // ── Persist on cart change (debounced) ───────────────────────────────────
  useEffect(() => {
    if (!loaded || paused) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    saveTimerRef.current = window.setTimeout(async () => {
      try {
        if (cart.length === 0) {
          // Empty cart → drop the saved record
          if (phone) await supabase.from("saved_carts").delete().eq("phone", phone);
          else await supabase.from("saved_carts").delete().eq("guest_id", guestId);
          return;
        }

        const payload = {
          phone,
          guest_id: phone ? null : guestId,
          customer_name: customer?.name ?? null,
          items: cart as unknown as never,
          dine_in: dineIn,
          total,
          last_action: "updated",
        };

        await supabase.from("saved_carts").upsert(payload, {
          onConflict: phone ? "phone" : "guest_id",
        });
      } catch {
        // Network errors are non-fatal — local cart still works
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [cart, dineIn, total, loaded, paused, phone, guestId, customer?.name]);

  /** Mark that the next cart change should NOT be persisted (e.g. when we restore the saved cart into state). */
  const suppressNextSave = useCallback(() => {
    skipNextSaveRef.current = true;
  }, []);

  /** User accepted to resume — mark as resumed and clear the prompt. */
  const markResumed = useCallback(async () => {
    if (!savedCart) return;
    const target = savedCart;
    setSavedCart(null);
    try {
      await supabase
        .from("saved_carts")
        .update({ last_action: "resumed" })
        .eq("id", target.id);
    } catch {}
  }, [savedCart]);

  /** User chose to start fresh — wipe the saved cart. */
  const discardSaved = useCallback(async () => {
    const target = savedCart;
    setSavedCart(null);
    if (!target) return;
    try {
      await supabase
        .from("saved_carts")
        .update({ last_action: "discarded" })
        .eq("id", target.id);
      await supabase.from("saved_carts").delete().eq("id", target.id);
    } catch {}
  }, [savedCart]);

  /** Hide the prompt without changing the saved cart (e.g. user closed the modal). */
  const dismissPrompt = useCallback(() => {
    setSavedCart(null);
  }, []);

  return {
    savedCart,
    loaded,
    suppressNextSave,
    markResumed,
    discardSaved,
    dismissPrompt,
  };
}
