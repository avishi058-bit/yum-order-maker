// Loads the admin-managed test-customer list (public.test_customers) and
// returns a predicate. Requires a service-role client.
// deno-lint-ignore no-explicit-any
export async function loadTestCustomerFilter(client: any) {
  const normalize = (v?: string | null) =>
    (v || "").toString().trim().toLowerCase().replace(/[\u200f\u200e]/g, "");
  const { data } = await client.from("test_customers").select("kind, value");
  const rows = (data ?? []) as Array<{ kind: string; value: string }>;
  const names = rows.filter((r) => r.kind === "name").map((r) => normalize(r.value)).filter(Boolean);
  const phones = rows
    .filter((r) => r.kind === "phone")
    .map((r) => r.value.replace(/[^0-9]/g, "").replace(/^0/, ""))
    .filter(Boolean);
  return (name?: string | null, phone?: string | null): boolean => {
    const n = normalize(name);
    if (n && names.some((p) => n.includes(p))) return true;
    const p = normalize(phone).replace(/[^0-9]/g, "");
    if (p && phones.some((x) => p.endsWith(x))) return true;
    return false;
  };
}
