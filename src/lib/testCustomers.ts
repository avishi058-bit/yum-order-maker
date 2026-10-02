// Customers/orders used for internal testing - excluded from all statistics & reports.
// The list lives in the admin-only `test_customers` table (edited in the admin
// screen). Call `loadTestCustomers()` before filtering; until it resolves the
// filter excludes nothing.
import { supabase } from "@/integrations/supabase/client";

let namePatterns: string[] = [];
let phones: string[] = [];
let loading: Promise<void> | null = null;

const normalize = (v?: string | null) =>
  (v || "").toString().trim().toLowerCase().replace(/[\u200f\u200e]/g, "");

export const loadTestCustomers = (force = false): Promise<void> => {
  if (loading && !force) return loading;
  loading = (async () => {
    const { data, error } = await (supabase as any).from("test_customers").select("kind, value");
    if (error) return;
    const rows = (data ?? []) as Array<{ kind: string; value: string }>;
    namePatterns = rows.filter((r) => r.kind === "name").map((r) => normalize(r.value));
    phones = rows.filter((r) => r.kind === "phone").map((r) => r.value.replace(/[^0-9]/g, "").replace(/^0/, ""));
  })();
  return loading;
};

export const isTestCustomer = (name?: string | null, phone?: string | null): boolean => {
  const n = normalize(name);
  if (n && namePatterns.some((p) => p && n.includes(p))) return true;
  const p = normalize(phone).replace(/[^0-9]/g, "");
  if (p && phones.some((x) => x && p.endsWith(x))) return true;
  return false;
};

/** Filter helper for arrays of order-like records. */
export const excludeTestOrders = <T extends { customer_name?: string | null; customer_phone?: string | null }>(
  rows: T[],
): T[] => rows.filter((r) => !isTestCustomer(r.customer_name, r.customer_phone));
