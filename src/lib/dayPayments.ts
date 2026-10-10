// Takings of the current business day, split by payment method.
// Rules that must keep holding (guarded by dayPayments.test.ts):
// - cancelled / pending_payment / payment_failed / declined orders never count;
// - credit counts only after the payment was actually approved (paid_at set),
//   otherwise abandoned card transactions would inflate the daily figure.

export const UNCOUNTED_STATUSES = new Set([
  "cancelled",
  "pending_payment",
  "payment_failed",
  "declined",
]);

export interface PayableOrder {
  status: string;
  created_at: string;
  payment_method: string | null;
  paid_at?: string | null;
  total: number;
}

export interface DayPaymentTotals {
  cash: number;
  cashCount: number;
  paybox: number;
  payboxCount: number;
  credit: number;
  creditCount: number;
}

export function dayPaymentTotals<T extends PayableOrder>(
  orders: T[],
  dayStart: Date,
): DayPaymentTotals {
  const todays = orders.filter(
    (o) => !UNCOUNTED_STATUSES.has(o.status) && new Date(o.created_at) >= dayStart,
  );
  const sum = (method: string) =>
    todays.filter((o) => o.payment_method === method).reduce((s, o) => s + o.total, 0);
  const count = (method: string) =>
    todays.filter((o) => o.payment_method === method).length;

  const paidCredit = todays.filter((o) => o.payment_method === "credit" && o.paid_at);

  return {
    cash: sum("cash"),
    cashCount: count("cash"),
    paybox: sum("paybox"),
    payboxCount: count("paybox"),
    credit: paidCredit.reduce((s, o) => s + o.total, 0),
    creditCount: paidCredit.length,
  };
}
