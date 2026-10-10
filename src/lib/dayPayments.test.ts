import { describe, expect, it } from "vitest";
import { dayPaymentTotals, type PayableOrder } from "./dayPayments";

// Business day starts 06:00 Israel time (UTC+03:00 in October).
const DAY_START = new Date("2026-10-10T06:00:00+03:00");

const order = (over: Partial<PayableOrder> = {}): PayableOrder => ({
  status: "completed",
  created_at: "2026-10-10T12:00:00+03:00",
  payment_method: "cash",
  paid_at: null,
  total: 0,
  ...over,
});

describe("dayPaymentTotals", () => {
  it("sums cash and paybox with their order counts", () => {
    const totals = dayPaymentTotals(
      [
        order({ payment_method: "cash", total: 100 }),
        order({ payment_method: "cash", total: 66 }),
        order({ payment_method: "paybox", total: 101 }),
      ],
      DAY_START,
    );
    expect(totals).toMatchObject({ cash: 166, cashCount: 2, paybox: 101, payboxCount: 1, credit: 0, creditCount: 0 });
  });

  it("counts credit only after the payment was approved", () => {
    const totals = dayPaymentTotals(
      [
        order({ payment_method: "credit", total: 500, paid_at: "2026-10-10T12:05:00+03:00" }),
        order({ payment_method: "credit", total: 300, paid_at: null }),
      ],
      DAY_START,
    );
    expect(totals).toMatchObject({ credit: 500, creditCount: 1 });
  });

  it("drops cancelled, pending-payment, failed and declined orders", () => {
    const totals = dayPaymentTotals(
      [
        order({ payment_method: "cash", total: 50, status: "cancelled" }),
        order({ payment_method: "cash", total: 60, status: "pending_payment" }),
        order({ payment_method: "credit", total: 70, status: "payment_failed", paid_at: "2026-10-10T12:00:00+03:00" }),
        order({ payment_method: "paybox", total: 80, status: "declined" }),
        order({ payment_method: "cash", total: 90 }),
      ],
      DAY_START,
    );
    expect(totals).toMatchObject({ cash: 90, cashCount: 1, paybox: 0, payboxCount: 0, credit: 0, creditCount: 0 });
  });

  it("ignores orders from before the business day started", () => {
    const totals = dayPaymentTotals(
      [
        order({ payment_method: "cash", total: 40, created_at: "2026-10-10T05:59:00+03:00" }),
        order({ payment_method: "cash", total: 45, created_at: "2026-10-10T06:00:00+03:00" }),
      ],
      DAY_START,
    );
    expect(totals).toMatchObject({ cash: 45, cashCount: 1 });
  });
});
