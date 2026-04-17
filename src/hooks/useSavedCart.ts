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
 * All saved-cart access goes through the `manage-saved-cart` edge function,
 * which enforces ownership via guest_id (localStorage) or phone (auth).
 * The underlying table is RLS-locked from direct client access.
 */
export function useSavedCart({ cart, dineIn, total, paused = false }: UseSavedCartArgs) {
  const { customer } = useCustomerAuth();
  const [savedCart, setSavedCart] = useState<SavedCart | null>(null);
  const [loaded, setLoaded] = useState(false);
  const skipNextSaveRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  const phone = customer?.phone ?? null;
  const guestId = getOrCreateGuestId();

  // ── Initial fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: result } = await supabase.functions.invoke("manage-saved-cart", {
        body: { action: "get", phone, guest_id: phone ? null : guestId },
      });
      if (cancelled) return;

      const data = result?.cart;
      if (data) {
        const ageMs = Date.now() - new Date(data.updated_at).getTime();
        const ageHours = ageMs / (1000 * 60 * 60);
        if (ageHours <= MAX_AGE_HOURS && Array.isArray(data.items) && data.items.length > 0) {
          setSavedCart({
            id: data.id,
            items: data.items as CartItem[],
            dineIn: data.dine_in,
            total: Number(data.total),
            customerName: data.customer_name,
            updatedAt: data.updated_at,
          });
        } else if (ageHours > MAX_AGE_HOURS) {
          // Expired — best-effort cleanup
          await supabase.functions.invoke("manage-saved-cart", {
            body: { action: "delete", phone, guest_id: phone ? null : guestId },
          });
        }
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [phone, guestId]);

  // Track whether the user has actually interacted with the cart in this session.
  const hasInteractedRef = useRef(false);
  useEffect(() => {
    if (cart.length > 0) hasInteractedRef.current = true;
  }, [cart.length]);

  const persistCart = useCallback(async (itemsToPersist: CartItem[]) => {
    if (itemsToPersist.length === 0) {
      await supabase.functions.invoke("manage-saved-cart", {
        body: { action: "delete", phone, guest_id: phone ? null : guestId },
      });
      return;
    }

    await supabase.functions.invoke("manage-saved-cart", {
      body: {
        action: "upsert",
        phone,
        guest_id: phone ? null : guestId,
        customer_name: customer?.name ?? null,
        items: itemsToPersist,
        dine_in: dineIn,
        total,
      },
    });
  }, [phone, guestId, customer?.name, dineIn, total]);

  // ── Persist on cart change (debounced) ───────────────────────────────────
  useEffect(() => {
    if (!loaded || paused) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (cart.length === 0 && !hasInteractedRef.current) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    saveTimerRef.current = window.setTimeout(() => {
      void persistCart(cart).catch(() => {
        // Network / persistence errors are non-fatal — local cart still works
      });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [cart, loaded, paused, persistCart]);

  // Flush immediately when entering an active order flow.
  useEffect(() => {
    if (!loaded || !paused) return;
    if (cart.length === 0 && !hasInteractedRef.current) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    void persistCart(cart).catch(() => {});
  }, [cart, loaded, paused, persistCart]);

  const suppressNextSave = useCallback(() => {
    skipNextSaveRef.current = true;
  }, []);

  const markResumed = useCallback(async () => {
    if (!savedCart) return;
    setSavedCart(null);
    try {
      await supabase.functions.invoke("manage-saved-cart", {
        body: { action: "mark", phone, guest_id: phone ? null : guestId, last_action: "resumed" },
      });
    } catch {}
  }, [savedCart, phone, guestId]);

  const discardSaved = useCallback(async () => {
    setSavedCart(null);
    try {
      await supabase.functions.invoke("manage-saved-cart", {
        body: { action: "delete", phone, guest_id: phone ? null : guestId },
      });
    } catch {}
  }, [phone, guestId]);

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
