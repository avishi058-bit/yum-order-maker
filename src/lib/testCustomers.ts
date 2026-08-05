// Customers/orders used for internal testing — excluded from all statistics & reports.
const EXCLUDED_NAME_PATTERNS = [
  "טסט",
  "test",
  "בדיקה",
  "בדקה",
  "אבישי שלזינגר",
];

const EXCLUDED_PHONES = ["0539311200", "0501234567"];

const normalize = (v?: string | null) =>
  (v || "").toString().trim().toLowerCase().replace(/[\u200f\u200e]/g, "");

export const isTestCustomer = (name?: string | null, phone?: string | null): boolean => {
  const n = normalize(name);
  if (n && EXCLUDED_NAME_PATTERNS.some((p) => n.includes(normalize(p)))) return true;
  const p = normalize(phone).replace(/[^0-9]/g, "");
  if (p && EXCLUDED_PHONES.some((x) => p.endsWith(x.replace(/^0/, "")))) return true;
  return false;
};

/** Filter helper for arrays of order-like records. */
export const excludeTestOrders = <T extends { customer_name?: string | null; customer_phone?: string | null }>(
  rows: T[],
): T[] => rows.filter((r) => !isTestCustomer(r.customer_name, r.customer_phone));
