// Shared invoice helpers: line building (incl. "הזמן חייל/ת" donation) and a
// lock that guarantees one tax invoice per order.
// deno-lint-ignore-file no-explicit-any

export type InvoiceItem = {
  ItemDescription: string;
  ItemQuantity: number;
  ItemPrice: number;
  IsTaxFree: boolean;
};

const GENERAL = "פריט כללי";
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Builds invoice lines so they always sum to the charged total. */
export function buildInvoiceItems(
  rows: { item_name: string | null; price: number | string; quantity: number | string }[],
  order: { total: number | string; soldier_donation?: number | string | null; donation_only?: boolean | null },
): InvoiceItem[] {
  const total = Number(order.total);
  if (order.donation_only) {
    return [{ ItemDescription: GENERAL, ItemQuantity: 1, ItemPrice: total, IsTaxFree: false }];
  }
  const items: InvoiceItem[] = rows
    .filter((r) => Number(r.price) > 0)
    .map((r) => ({
      ItemDescription: String(r.item_name ?? "פריט").slice(0, 100),
      ItemQuantity: Number(r.quantity) || 1,
      ItemPrice: Number(r.price),
      IsTaxFree: false,
    }));
  const donation = r2(Math.max(0, Number(order.soldier_donation) || 0));
  if (donation > 0) {
    items.push({ ItemDescription: GENERAL, ItemQuantity: 1, ItemPrice: donation, IsTaxFree: false });
  }
  const linesSum = items.reduce((s, i) => s + i.ItemPrice * i.ItemQuantity, 0);
  const diff = r2(total - linesSum);
  if (items.length === 0) {
    items.push({ ItemDescription: "רכישה בהבקתה", ItemQuantity: 1, ItemPrice: total, IsTaxFree: false });
  } else if (Math.abs(diff) >= 0.01) {
    items.push({ ItemDescription: diff > 0 ? "תוספות" : "הנחה", ItemQuantity: 1, ItemPrice: diff, IsTaxFree: false });
  }
  return items;
}

/**
 * Atomically reserves the right to issue the invoice for an order.
 * invoice_issued_at doubles as the lock: it is set only when both
 * invoice_number and invoice_issued_at are still empty. Returns false when
 * another request already issued (or is issuing) the invoice.
 */
export async function claimInvoice(supabase: any, orderId: string): Promise<boolean> {
  const { data } = await supabase
    .from("orders")
    .update({ invoice_issued_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("invoice_number", null)
    .is("invoice_issued_at", null)
    .select("id");
  return Array.isArray(data) && data.length === 1;
}

/** Releases the lock after a failed Z-Credit call so a retry is possible. */
export async function releaseInvoice(supabase: any, orderId: string) {
  await supabase
    .from("orders")
    .update({ invoice_issued_at: null })
    .eq("id", orderId)
    .is("invoice_number", null);
}
