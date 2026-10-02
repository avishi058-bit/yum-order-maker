// Ask Z-Credit (GetSessionStatus) what happened on a hosted payment page.
// Returns the outcome plus the charged amount when Z-Credit reports one.

const STATUS_URL =
  "https://pci.zcredit.co.il/webcheckout/api/WebCheckout/GetSessionStatus";

export type SessionOutcome = "paid" | "failed" | "pending" | "unknown";

const num = (v: unknown): number | null => {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function fetchSessionStatus(
  sessionId: string,
): Promise<{ outcome: SessionOutcome; amount: number | null }> {
  const key = Deno.env.get("ZCREDIT_KEY");
  if (!key) return { outcome: "unknown", amount: null };
  try {
    const res = await fetch(STATUS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Key: key, SessionId: sessionId }),
    });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result) return { outcome: "unknown", amount: null };
    if (result.HasError === true && !result.Data) {
      console.error("GetSessionStatus error code:", result.ReturnCode ?? null);
      return { outcome: "unknown", amount: null };
    }
    const data = result.Data ?? result;
    const txList: Record<string, unknown>[] =
      (Array.isArray(data.PaymentsDetails) && data.PaymentsDetails) ||
      (Array.isArray(data.Transactions) && data.Transactions) ||
      [];
    const okTx = txList.filter((tx) => {
      const code = tx.ReturnCode ?? tx.ResultCode ?? tx.Status;
      return code === 0 || code === "0" || tx.IsSuccess === true;
    });
    const txAmount = okTx.reduce((s, tx) => {
      const a = num(tx.Amount ?? tx.TransactionSum ?? tx.Sum ?? tx.Total ?? tx.TotalAmount);
      return a == null ? s : (s ?? 0) + a;
    }, null as number | null);
    const amount =
      txAmount ??
      num(data.Total ?? data.Amount ?? data.TotalAmount ?? data.TransactionSum ?? data.Sum);

    if (okTx.length) return { outcome: "paid", amount };
    const statusText = String(data.SessionStatus ?? data.Status ?? data.PaymentStatus ?? "").toLowerCase();
    if (["paid", "success", "successful", "completed", "closed"].includes(statusText)) {
      return { outcome: "paid", amount };
    }
    if (["failed", "declined", "error", "cancelled", "canceled", "expired"].includes(statusText)) {
      return { outcome: "failed", amount: null };
    }
    return { outcome: "pending", amount: null };
  } catch (err) {
    console.error("GetSessionStatus fetch failed:", (err as Error)?.message);
    return { outcome: "unknown", amount: null };
  }
}

/** True only when Z-Credit reported an amount equal to the order total. */
export const amountMatches = (amount: number | null, total: unknown) =>
  amount != null && Math.abs(amount - Number(total)) <= 0.01;
