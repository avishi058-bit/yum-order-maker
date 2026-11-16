# Invoice number for website orders - findings and fix plan

## Findings

**1. Z-Credit GetSessionStatus (latest paid website order, 15 Nov)**
The call returned HTTP 200 with no error. These are the key names:
- Top level: `HasError, ReturnCode, ReturnMessage, SessionId, Errors[], CallBackJSON, TransactionID, TransactionSuccess, IsTransactionPageLoaded, TransactionPageLoadedAt, CreatedAt, TransactionResultCode, IsInvalidated, InvalidatedAt, OrderAmount, TipAmount, TipChoice`
- `CallBackJSON` is a **JSON string**, not an object. Inside it: `SessionId, ReferenceNumber, HolderId, Total, Currency, Installments, CardNum, CardName, CardBin, UniqueID, Token, ApprovalNumber, CustomerName, CustomerPhone, CustomerEmail, ExpDate_MMYY, FirstInstallentAmount, OtherInstallmentsAmount, CreditType, J, CardIssuerCode, CardFinancerCode, CardBrandCode, VoucherNumber, InvoiceRecieptDocumentNumber, InvoiceRecieptNumber, PaymentMethod, UID, ZData`
- **`InvoiceRecieptDocumentNumber` and `InvoiceRecieptNumber` are both filled in.** Z-Credit did issue the invoice.

Our parser in `_shared/zcreditSession.ts` misses it, for three reasons:
- It looks for `Data`, `PaymentsDetails`, `Transactions` and `SessionStatus`. None of these exist in the response, so the result is always "pending" and never "paid". That is also why the "invoice number not found" warning never appears in the logs.
- It never parses the `CallBackJSON` string, so the document number search can't reach it.
- The real success and amount fields are `TransactionSuccess` and `OrderAmount` (or `CallBackJSON.Total`). It never reads them.

**2. Session creation.** `create-payment` already sends `CreateInvoice: true`, and Z-Credit issues the invoice. Nothing is missing on that side.

**3. Rows that have `invoice_issued_at` but no `invoice_number`**
- **Pinpad (204 rows):** `pinpad-charge` sets `invoice_issued_at` before the invoice is created, as a lock, using `claimInvoice`. When the invoice succeeds, it saves `invoice_number = pickInvoiceNumber(result)`. That comes back null because the CreateInvoiceReceipt response field names don't match (and `ReturnDocumentInResponse: false`). So the lock date stays and the number is null. `send-invoice-email` has the same pattern (`pickNumber`).
- **Old rows with no session (280):** the same lock pattern, written by older code.
- **Website orders (240):** none have `invoice_issued_at`. Every website path is gated on `documentNumber`, which is always null (see point 1).
- `payment-callback` should catch `InvoiceRecieptDocumentNumber` directly from the callback body, because its key pattern matches. But it logged nothing in 7 days, so the callback may not be reaching us. Most likely the orders become paid through other paths, such as staff marking them paid. This is not confirmed.

**4. Pinpad.** `pinpad-charge` asks for an invoice through `ZCreditWS .../CreateInvoiceReceipt` with the TransactionId. The number should come back in that response, but the actual field names are still unknown. The code logs `keys` when it can't find the number, so one real terminal charge will show them.

**5. Options**
- **Website A (recommended):** fix the GetSessionStatus parser so it parses `CallBackJSON` and reads `TransactionSuccess` and `OrderAmount`. The kitchen button and `get-payment-status` then work. Pros: read-only, uses the number Z-Credit already issued, covers old orders too. Cons: one Z-Credit call per lookup.
- **Website B:** rely only on the callback body. Pros: no extra call. Cons: the callback currently doesn't seem to arrive, and it doesn't cover past orders.
- **Website C:** issue a new invoice ourselves. Rejected: it would create a duplicate tax document.
- **Pinpad A:** after one real charge, read the logged key names and fix `pickInvoiceNumber`. **Pinpad B:** set `ReturnDocumentInResponse` or call a document lookup by TransactionId. Both are out of scope here.

## Fix plan (website orders only)

1. In `_shared/zcreditSession.ts`, parse `result.CallBackJSON` when it is a string, without failing on bad JSON.
   - Mark the order paid when `TransactionSuccess === true` (or `TransactionResultCode` is 0), unless `IsInvalidated` is set.
   - Take the amount from `OrderAmount`, falling back to `CallBackJSON.Total`.
   - Take the document number from `InvoiceRecieptDocumentNumber`, then `InvoiceRecieptNumber`, then the existing pattern search on the parsed object.
   - Keep the current fallbacks for other response shapes.
2. Leave `issue-invoice`, `get-payment-status` and `payment-callback` unchanged. They already save the number when they get one, so they pick it up automatically.
3. In `payment-callback`, also parse `CallBackJSON` if the body contains it, using the same helper.
4. Add a small unit test with a fake response that has a field-name-only shape. It checks three things: paid becomes true, the amount matches, and the document number is read from inside `CallBackJSON`.
5. Deploy `issue-invoice`, `get-payment-status` and `payment-callback`. Press "print invoice" on the 15 Nov order and confirm `invoice_number` is now saved.
6. No change to pinpad, data, or UI.
