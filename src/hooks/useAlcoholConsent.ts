import { useCallback, useState } from "react";
import { MenuItem } from "@/data/menu";

const STORAGE_KEY = "habakta_alcohol_consent";

/**
 * Session-scoped alcohol consent gate.
 * - Detects alcoholic items by id prefix `beer-`.
 * - Persists approval for the current browser session (sessionStorage)
 *   so the user is not prompted again on every alcohol item click.
 */
export const isAlcoholicItem = (item: MenuItem): boolean => {
  return item.category === "drink" && item.id.startsWith("beer-");
};

export const useAlcoholConsent = () => {
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const hasConsent = (): boolean => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  };

  const clearPending = () => {
    setPendingItem(null);
    setPendingAction(null);
  };

  /**
   * Returns true if the action may proceed immediately,
   * false if the consent modal was opened (caller should bail and
   * wait for `onConfirm` / `onCancel`).
   */
  const guard = useCallback((item: MenuItem, onApproved: () => void): boolean => {
    if (!isAlcoholicItem(item) || hasConsent()) {
      onApproved();
      return true;
    }

    setPendingItem(item);
    setPendingAction(() => onApproved);
    return false;
  }, []);

  const confirm = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }

    const action = pendingAction;
    clearPending();
    action?.();
  }, [pendingAction]);

  const cancel = useCallback(() => {
    clearPending();
  }, []);

  return {
    consentOpen: pendingItem !== null,
    pendingItem,
    guard,
    confirm,
    cancel,
  };
};
