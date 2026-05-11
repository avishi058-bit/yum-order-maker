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
const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/customer-auth`;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
}

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null);

async function callAuth(action: string, body: Record<string, unknown>) {
  const res = await fetch(`${EDGE_URL}?action=${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: API_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "שגיאה");
  return data;
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [favoriteItems, setFavoriteState] = useState<CartItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Try auto-login on mount
  useEffect(() => {
    // Restore cached favorite immediately so UI doesn't flash
    try {
      const cachedFav = localStorage.getItem(FAVORITE_KEY);
      if (cachedFav) setFavoriteState(JSON.parse(cachedFav));
    } catch {}

    const token = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!token) {
      try {
        const cached = localStorage.getItem(CUSTOMER_KEY);
        if (cached) setCustomer(JSON.parse(cached));
      } catch {}

      // PWA opened standalone without a session → try to recover from the last order on this device.
      // This handles the flow: order on website → install to home screen → open app for the first time.
      const recovery = isStandalone() ? readLastOrderCustomer() : null;
      if (recovery) {
        callAuth("link-from-order", { phone: recovery.phone, name: recovery.name })
          .then((data) => {
            const c = data.customer as CustomerData & { favoriteItems?: CartItem[] | null };
            localStorage.setItem(DEVICE_TOKEN_KEY, data.deviceToken);
            localStorage.setItem(CUSTOMER_KEY, JSON.stringify(c));
            setCustomer({
              name: c.name, phone: c.phone, isReturning: c.isReturning,
              loginCount: c.loginCount, lastLoginAt: c.lastLoginAt,
            });
            const fav = c.favoriteItems ?? null;
            setFavoriteState(fav);
            if (fav) localStorage.setItem(FAVORITE_KEY, JSON.stringify(fav));
            // Immediately ask for notification permission so they get real-time order updates.
            setTimeout(() => {
              try { window.dispatchEvent(new CustomEvent("request-notify-permission")); } catch {}
            }, 800);
          })
          .catch(() => {})
          .finally(() => setLoading(false));
        return;
      }

      setLoading(false);
      return;
    }

    callAuth("auto-login", { deviceToken: token })
      .then((data) => {
        const c = data.customer as CustomerData & { favoriteItems?: CartItem[] | null };
        setCustomer({
          name: c.name,
          phone: c.phone,
          isReturning: c.isReturning,
          loginCount: c.loginCount,
          lastLoginAt: c.lastLoginAt,
        });
        localStorage.setItem(CUSTOMER_KEY, JSON.stringify(c));
        const fav = c.favoriteItems ?? null;
        setFavoriteState(fav);
        if (fav) localStorage.setItem(FAVORITE_KEY, JSON.stringify(fav));
        else localStorage.removeItem(FAVORITE_KEY);
      })
      .catch(() => {
        localStorage.removeItem(DEVICE_TOKEN_KEY);
        localStorage.removeItem(CUSTOMER_KEY);
        localStorage.removeItem(FAVORITE_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  const saveSession = useCallback((token: string, c: CustomerData & { favoriteItems?: CartItem[] | null }) => {
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(c));
    setCustomer({
      name: c.name, phone: c.phone, isReturning: c.isReturning,
      loginCount: c.loginCount, lastLoginAt: c.lastLoginAt,
    });
    const fav = c.favoriteItems ?? null;
    setFavoriteState(fav);
    if (fav) localStorage.setItem(FAVORITE_KEY, JSON.stringify(fav));
    else localStorage.removeItem(FAVORITE_KEY);
  }, []);

  const register = useCallback(async (phone: string, name: string, termsAccepted: boolean, marketingConsent: boolean) => {
    const data = await callAuth("register", { phone, name, termsAccepted, marketingConsent });
    saveSession(data.deviceToken, data.customer);
  }, [saveSession]);

  const login = useCallback(async (phone: string) => {
    const data = await callAuth("login", { phone });
    saveSession(data.deviceToken, data.customer);
  }, [saveSession]);

  const logout = useCallback(async () => {
    const token = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (token) {
      try { await callAuth("logout", { deviceToken: token }); } catch {}
    }
    localStorage.removeItem(DEVICE_TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_KEY);
    localStorage.removeItem(FAVORITE_KEY);
    setCustomer(null);
    setFavoriteState(null);
  }, []);

  const logoutAll = useCallback(async () => {
    const token = localStorage.getItem(DEVICE_TOKEN_KEY);
    const phone = customer?.phone;
    if (token && phone) {
      try { await callAuth("logout-all", { deviceToken: token, phone }); } catch {}
    }
    localStorage.removeItem(DEVICE_TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_KEY);
    localStorage.removeItem(FAVORITE_KEY);
    setCustomer(null);
    setFavoriteState(null);
  }, [customer]);

  const linkFromOrder = useCallback(async (phone: string, name: string) => {
    if (localStorage.getItem(DEVICE_TOKEN_KEY)) return;
    try {
      const data = await callAuth("link-from-order", { phone, name });
      saveSession(data.deviceToken, data.customer);
    } catch (e) {
      console.warn("[auth] linkFromOrder failed", e);
    }
  }, [saveSession]);

  const setFavoriteItems = useCallback(async (items: CartItem[] | null) => {
    const token = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!token) throw new Error("not_logged_in");
    await callAuth("set-favorite", { deviceToken: token, items });
    setFavoriteState(items);
    if (items) localStorage.setItem(FAVORITE_KEY, JSON.stringify(items));
    else localStorage.removeItem(FAVORITE_KEY);
  }, []);

  return (
    <CustomerAuthContext.Provider value={{
      customer, loading, isLoggedIn: !!customer,
      favoriteItems, setFavoriteItems,
      register, login, logout, logoutAll, linkFromOrder,
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
