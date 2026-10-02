import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { CartItem } from "@/components/CartDrawer";

const DEVICE_TOKEN_KEY = "habakta_device_token";
const CUSTOMER_KEY = "habakta_customer";
const FAVORITE_KEY = "habakta_favorite";
const LAST_ORDER_CUSTOMER_KEY = "habakta_last_order_customer";
const LAST_ORDER_COOKIE = "habakta_loc";

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  // @ts-ignore iOS Safari
  if (window.navigator.standalone === true) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
};

const readCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1] ?? "") : null;
};

const writeCookie = (name: string, value: string, days = 365) => {
  if (typeof document === "undefined") return;
  const exp = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
};

/** Persist the most recent order customer on this device for cross-context recovery (e.g. PWA install). */
export const rememberLastOrderCustomer = (phone: string, name: string) => {
  try {
    const payload = JSON.stringify({ phone, name, ts: Date.now() });
    localStorage.setItem(LAST_ORDER_CUSTOMER_KEY, payload);
    writeCookie(LAST_ORDER_COOKIE, payload);
  } catch {}
};

const readLastOrderCustomer = (): { phone: string; name: string } | null => {
  try {
    const raw = localStorage.getItem(LAST_ORDER_CUSTOMER_KEY) || readCookie(LAST_ORDER_COOKIE);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (v?.phone && v?.name) return { phone: v.phone, name: v.name };
  } catch {}
  return null;
};
const MARKETING_PENDING_KEY = "habakta_marketing_pending";

/** Marketing opt-in chosen on this device; sent once with the next order. */
export const takePendingMarketingConsent = (phone: string): boolean => {
  try {
    const raw = localStorage.getItem(MARKETING_PENDING_KEY);
    if (!raw) return false;
    const v = JSON.parse(raw);
    return v?.phone === phone && v?.consent === true;
  } catch { return false; }
};
export const clearPendingMarketingConsent = () => {
  try { localStorage.removeItem(MARKETING_PENDING_KEY); } catch {}
};

export interface CustomerData {
  name: string;
  phone: string;
  isReturning: boolean;
  loginCount: number;
  lastLoginAt?: string;
}

interface CustomerAuthContextType {
  customer: CustomerData | null;
  loading: boolean;
  isLoggedIn: boolean;
  /** The customer's saved "usual" order (favorite). null if not set. */
  favoriteItems: CartItem[] | null;
  /** Persist a new favorite for the current logged-in customer. */
  setFavoriteItems: (items: CartItem[] | null) => Promise<void>;
  register: (phone: string, name: string, termsAccepted: boolean, marketingConsent: boolean) => Promise<void>;
  login: (phone: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  linkFromOrder: (phone: string, name: string) => Promise<void>;
  /** Update the display name of the currently logged-in customer. */
  updateName: (newName: string) => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [favoriteItems, setFavoriteState] = useState<CartItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Device-only session: everything is read from this device's storage.
  // The server never returns customer data by phone or token.
  useEffect(() => {
    try { localStorage.removeItem(DEVICE_TOKEN_KEY); } catch {}
    try {
      const cachedFav = localStorage.getItem(FAVORITE_KEY);
      if (cachedFav) setFavoriteState(JSON.parse(cachedFav));
    } catch {}
    let restored: CustomerData | null = null;
    try {
      const cached = localStorage.getItem(CUSTOMER_KEY);
      if (cached) {
        const c = JSON.parse(cached);
        if (c?.phone && c?.name) restored = { name: c.name, phone: c.phone, isReturning: true, loginCount: c.loginCount ?? 1 };
      }
    } catch {}
    // PWA opened standalone for the first time: reuse this device's last order details.
    if (!restored && isStandalone()) {
      const rec = readLastOrderCustomer();
      if (rec) {
        restored = { name: rec.name, phone: rec.phone, isReturning: true, loginCount: 1 };
        localStorage.setItem(CUSTOMER_KEY, JSON.stringify(restored));
      }
    }
    if (restored) setCustomer(restored);
    setLoading(false);
  }, []);

  const saveLocal = useCallback((phone: string, name: string) => {
    const c: CustomerData = { name, phone, isReturning: false, loginCount: 1 };
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(c));
    setCustomer(c);
  }, []);

  const register = useCallback(async (phone: string, name: string, _termsAccepted: boolean, marketingConsent: boolean) => {
    saveLocal(phone, name);
    try {
      if (marketingConsent) localStorage.setItem(MARKETING_PENDING_KEY, JSON.stringify({ phone, consent: true }));
      else localStorage.removeItem(MARKETING_PENDING_KEY);
    } catch {}
  }, [saveLocal]);

  const login = useCallback(async (_phone: string) => {
    throw new Error("not_supported");
  }, []);

  const clearAll = useCallback(() => {
    localStorage.removeItem(CUSTOMER_KEY);
    localStorage.removeItem(FAVORITE_KEY);
    setCustomer(null);
    setFavoriteState(null);
  }, []);

  const logout = useCallback(async () => { clearAll(); }, [clearAll]);
  const logoutAll = useCallback(async () => { clearAll(); }, [clearAll]);

  const linkFromOrder = useCallback(async (phone: string, name: string) => {
    if (localStorage.getItem(CUSTOMER_KEY)) return;
    saveLocal(phone, name);
  }, [saveLocal]);

  const setFavoriteItems = useCallback(async (items: CartItem[] | null) => {
    setFavoriteState(items);
    if (items) localStorage.setItem(FAVORITE_KEY, JSON.stringify(items));
    else localStorage.removeItem(FAVORITE_KEY);
  }, []);

  const updateName = useCallback(async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error("שם לא יכול להיות ריק");
    setCustomer((prev) => {
      if (!prev) return prev;
      const next = { ...prev, name: trimmed };
      try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return (
    <CustomerAuthContext.Provider value={{
      customer, loading, isLoggedIn: !!customer,
      favoriteItems, setFavoriteItems,
      register, login, logout, logoutAll, linkFromOrder, updateName,
    }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be inside CustomerAuthProvider");
  return ctx;
}
