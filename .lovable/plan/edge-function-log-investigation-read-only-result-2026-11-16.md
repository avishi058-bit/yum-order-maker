# Edge function log investigation (read-only) - result

No logs were returned for payment-callback, pinpad-charge or issue-invoice (searched with and without filters "fields" / "invoice"). The log store currently holds no lines for these functions in the retention window.

1. payment-callback "fields: ..." lines: none found, so no field names available.
2. pinpad-charge invoice created / failed / missing transaction id: 0 / 0 / 0 found.
3. issue-invoice lines: none found.
4. CreateInvoiceReceipt response field names: not visible in any log.

Suggested next step (needs approval, changes code): run one real test payment, or temporarily add a log of response key names only (no values) in the invoice helper, then re-read the logs.
