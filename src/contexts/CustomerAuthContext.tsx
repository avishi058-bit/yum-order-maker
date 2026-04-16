import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const DEVICE_TOKEN_KEY = "habakta_device_token";
const CUSTOMER_KEY = "habakta_customer";
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
  /** Register new customer after OTP */
  register: (phone: string, name: string, termsAccepted: boolean, marketingConsent: boolean) => Promise<void>;
  /** Login returning customer after OTP */
  login: (phone: string) => Promise<void>;
  /** Logout from this device */
  logout: () => Promise<void>;
  /** Logout from all devices */
  logoutAll: () => Promise<void>;
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
  const [loading, setLoading] = useState(true);

  // Try auto-login on mount
  useEffect(() => {
    const token = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!token) {
      // Try loading cached customer data
      try {
        const cached = localStorage.getItem(CUSTOMER_KEY);
        if (cached) setCustomer(JSON.parse(cached));
      } catch {}
      setLoading(false);
      return;
    }

    callAuth("auto-login", { deviceToken: token })
      .then((data) => {
        const c = data.customer as CustomerData;
        setCustomer(c);
        localStorage.setItem(CUSTOMER_KEY, JSON.stringify(c));
      })
      .catch(() => {
        // Token invalid, clear
        localStorage.removeItem(DEVICE_TOKEN_KEY);
        localStorage.removeItem(CUSTOMER_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  const saveSession = useCallback((token: string, c: CustomerData) => {
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(c));
    setCustomer(c);
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
    setCustomer(null);
  }, []);

  const logoutAll = useCallback(async () => {
    const token = localStorage.getItem(DEVICE_TOKEN_KEY);
    const phone = customer?.phone;
    if (token && phone) {
      try { await callAuth("logout-all", { deviceToken: token, phone }); } catch {}
    }
    localStorage.removeItem(DEVICE_TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_KEY);
    setCustomer(null);
  }, [customer]);

  return (
    <CustomerAuthContext.Provider value={{ customer, loading, isLoggedIn: !!customer, register, login, logout, logoutAll }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be inside CustomerAuthProvider");
  return ctx;
}
