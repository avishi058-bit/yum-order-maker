// Kiosk physical terminal (PinPad) charge via Z-Credit Gateway WS API.
//
// Instead of opening a web payment page, the kiosk asks the server to push the
// charge straight to the physical PinPad standing next to the screen. The
// customer taps / inserts the card on the device itself.
//
// Security:
// - Credentials (TerminalNumber / Password / PinPad ID) never leave the server.
// - The amount is ALWAYS taken from the stored order row, never from the client.
// - Only orders in 'pending_payment' are chargeable; status flips server-side.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";
import { getClientIp } from "../_shared/clientIp.ts";
import { buildInvoiceItems, claimInvoice, releaseInvoice } from "../_shared/invoice.ts";

const ZCREDIT_WS_URL =
  "https://pci.zcredit.co.il/ZCreditWS/api/Transaction/CommitFullTransaction";
const ZCREDIT_INVOICE_URL =
  "https://pci.zcredit.co.il/ZCreditWS/api/Transaction/CreateInvoiceReceipt";
const TAX_RATE = 18;
const BUSINESS_ADDRESS = "דרך ערבי נחל 21";
const BUSINESS_CITY = "תושיה";

const BodySchema = z.object({
  orderId: z.string().uuid(),
  invoiceEmail: z.string().trim().email().max(255).optional(),
  invoiceName: z.string().trim().max(100).optional(),
  // Split payment: charge only this part of the order (validated against the
  // unpaid remainder below). Omitted = charge everything that is left.
  amount: z.number().positive().max(100000).optional(),
  // What this payer is paying for (printed on their invoice). Text only.
  note: z.string().trim().max(200).optional(),
});

const round2 = (n: number) => Math.round(n * 100) / 100;

function pickInvoiceNumber(result: Record<string, unknown>): string | null {
  for (const key of ["InvoiceReceiptNumber", "DocumentNumber", "InvoiceNumber", "ReceiptNumber", "DocNumber", "ReferenceNumber"]) {
    const value = result[key];
    if (value != null && String(value).trim() !== "" && String(value) !== "0") return String(value);
  }
  return null;
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const TERMINAL = Deno.env.get("ZCREDIT_TERMINAL_NUMBER");
    // Prefer the current terminal password. ZCREDIT_WS_PASSWORD is retained
    // only as a legacy fallback so an older stale value cannot override it.
    const PASSWORD =
      Deno.env.get("ZCREDIT_TERMINAL_PASSWORD") ?? Deno.env.get("ZCREDIT_WS_PASSWORD");
    const PINPAD_ID = Deno.env.get("ZCREDIT_PINPAD_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    if (!TERMINAL || !PASSWORD || !PINPAD_ID || !SUPABASE_URL) {
      return json({ error: "server_misconfigured" }, 500);
    }


    const rawBody = await req.json().catch(() => ({}));
    // Warm-up ping sent by the kiosk the moment the customer taps "credit",
    // so the function is already booted when the real charge arrives.
    if ((rawBody as any)?.warmup === true) return json({ warm: true });

    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) return json({ error: "invalid_body" }, 400);


    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limit real charge requests by IP (warm-up pings returned above and
    // are not counted). A kiosk sends one or two per customer, so 10/minute
    // never blocks real use but stops anyone flooding the terminal.
    const ip = getClientIp(req);
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      p_action: "pinpad_charge",
      p_key: ip,
      p_max_attempts: 10,
      p_window: "1 minute",
    });
    if (allowed === false) return json({ error: "rate_limited" }, 429);
    await supabase.rpc("record_rate_limit_attempt", {
      p_action: "pinpad_charge",
      p_key: ip,
      p_ip_address: ip,
    });

    const { data: order, error: ordErr } = await supabase
      .from("orders")
      .select("id, total, status, customer_name, customer_phone, order_number, soldier_donation, donation_only")
      .eq("id", parsed.data.orderId)
      .maybeSingle();

    if (ordErr || !order) return json({ error: "order_not_found" }, 404);
    if (order.status !== "pending_payment") {
      return json({ error: "order_not_payable" }, 409);
    }

    const orderTotal = round2(Number(order.total));
    if (!(orderTotal > 0)) return json({ error: "invalid_amount" }, 400);

    // Split payments: what earlier cards already covered.
    const { data: prevPayments, error: prevErr } = await supabase
      .from("order_payments")
      .select("amount")
      .eq("order_id", order.id);
    if (prevErr) return json({ error: "server_error" }, 500);
    const paidSoFar = round2((prevPayments ?? []).reduce((a, r) => a + Number(r.amount), 0));
    const remaining = round2(orderTotal - paidSoFar);
    if (!(remaining > 0)) return json({ error: "order_not_payable" }, 409);

    const requested = parsed.data.amount != null ? round2(parsed.data.amount) : remaining;
    if (!(requested > 0) || requested > remaining) return json({ error: "invalid_amount", remaining }, 400);
    // Owner rule: every card pays at least ₪10, and a part may not leave less
    // than ₪10 for the next card (paying the whole remainder is always fine).
    const SPLIT_MIN = 10;
    if (requested < remaining && (requested < SPLIT_MIN || remaining - requested < SPLIT_MIN)) {
      return json({ error: "invalid_amount", remaining, min: SPLIT_MIN }, 400);
    }
    const sum = requested;
    const isSplit = paidSoFar > 0 || sum < remaining;
    const isFinal = sum >= remaining;

    // Claim the order before touching the terminal: only one request can set
    // the marker, so two concurrent calls can never charge the same order
    // twice. Kiosk orders never use a web checkout session, so the column is
    // free here. Released only on an explicit decline; on an unknown outcome
    // it stays claimed, because retrying could double-charge.
    const claim = `pinpad:${crypto.randomUUID()}`;
    const { data: claimed } = await supabase
      .from("orders")
      .update({ payment_session_id: claim })
      .eq("id", order.id)
      .eq("status", "pending_payment")
      .is("payment_session_id", null)
      .select("id");
    if (!Array.isArray(claimed) || claimed.length !== 1) {
      return json({ error: "charge_in_progress" }, 409);
    }
    const releaseClaim = () =>
      supabase
        .from("orders")
        .update({ payment_session_id: null })
        .eq("id", order.id)
        .eq("payment_session_id", claim);

    // Mirror EXACTLY the payload shape that Z-Credit accepts for this terminal.
    const payload = {
      TerminalNumber: TERMINAL.trim(),
      Password: PASSWORD.trim(),
      // Routing the charge to the physical device: PINPAD prefix + device id.
      Track2: `PINPAD${PINPAD_ID.trim()}`,
      CardNumber: "",
      ExpDate_MMYY: "",
      CVV: "",
      TransactionSum: sum,
      NumberOfPayments: 1,
      FirstPaymentSum: 0,
      OtherPaymentsSum: 0,
      TransactionType: "01",
      CurrencyType: 1,
      CreditType: 1,
      J: 0,
      IsCustomerPresent: false,
      AuthNum: "",
      HolderID: "",
      CustomerName: "",
      CustomerEmail: "",
      PhoneNumber: "",
      ItemDescription: "",
      DisableMobile: false,
    };

    const res = await fetch(ZCREDIT_WS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));

    const hasError = result?.HasError === true || Number(result?.ReturnCode) !== 0;

    if (hasError) {
      // An explicit decline means nothing was charged, so the same order may be
      // retried. An empty/garbled response is not proof of that - keep the claim.
      const explicitDecline =
        result?.HasError === true ||
        (result?.ReturnCode != null && Number(result.ReturnCode) !== 0);
      if (explicitDecline) await releaseClaim();
      console.error("pinpad-charge declined", {
        orderId: order.id,
        code: result?.ReturnCode,
        msg: result?.ReturnMessage,
        // Non-sensitive diagnostics: never log the values themselves.
        terminal: TERMINAL,
        pwdSource: Deno.env.get("ZCREDIT_TERMINAL_PASSWORD") ? "TERMINAL" : "WS",
        pwdLen: PASSWORD.length,
        pwdTrimmedLen: PASSWORD.trim().length,
        pinpadLen: PINPAD_ID.length,
      });

      return json(
        {
          success: false,
          code: result?.ReturnCode ?? null,
          message: result?.ReturnMessage || "העסקה לא אושרה",
        },
        200,
      );
    }

    // The JSON gateway has returned different identifier fields across
    // terminal versions. Keep every non-empty candidate and let the invoice
    // endpoint confirm which one identifies this charge. ReferenceNumber is
    // part of the documented CommitFullTransaction response.
    const transactionIdCandidates = [
      result?.TransactionId,
      result?.TransactionID,
      result?.TransactionUniqueID,
      result?.UID,
      result?.ReferenceNumber,
    ]
      .filter((value) => value != null && String(value).trim() !== "" && String(value) !== "0")
      .map((value) => String(value).trim())
      .filter((value, index, values) => values.indexOf(value) === index);
    let transactionId = transactionIdCandidates[0] ?? null;

    const { data: paymentRow, error: payErr } = await supabase
      .from("order_payments")
      .insert({
        order_id: order.id,
        amount: sum,
        transaction_id: transactionId,
        reference: result?.ReferenceNumber != null ? String(result.ReferenceNumber) : null,
        note: parsed.data.note ?? null,
      })
      .select("id")
      .single();
    if (payErr) console.error("pinpad-charge: payment row failed", { orderId: order.id, message: payErr.message });

    if (!isFinal) {
      if (payErr) {
        // The card was charged but the part could not be recorded. Keep the
        // order locked: charging the "remainder" now could overcharge.
        return json({
          success: false,
          charged: true,
          message: "התשלום נקלט אך לא נרשם. נא לפנות לצוות",
        });
      }
      // Part of the order is still unpaid: free the order for the next card.
      // It stays pending_payment, so the kitchen does not see it yet.
      await releaseClaim();
    }

    const { error: updErr } = !isFinal ? { error: null } : await supabase
      .from("orders")
      .update({
        status: "new",
        payment_method: "credit",
        // Same as the web checkout: paid_at fires trg_soldier_fund_on_paid, so
        // kiosk donation-only orders (auto-closed, never seen by the kitchen)
        // still reach the soldier fund.
        paid_at: new Date().toISOString(),
        // Needed later to email the Z-Credit invoice to the customer.
        payment_reference:
          result?.ReferenceNumber != null ? String(result.ReferenceNumber) : null,
        // Needed to issue an invoice/receipt via CreateInvoiceReceipt on the
        // SAME physical terminal that performed the charge.
        payment_transaction_id: transactionId,
      })
      .eq("id", order.id)
      .eq("status", "pending_payment");
    if (updErr) console.error("pinpad-charge: order update failed", updErr);

    // Every successful physical-terminal charge gets one official invoice.
    // Email delivery is optional and is requested in the same call, preventing
    // kiosk navigation from cancelling a separate invoice request.
    let invoiceCreated = false;
    let invoiceEmailed = false;
    let invoiceMessage: string | null = null;
    let invoiceNumber: string | null = null;

    if (isSplit && transactionId) {
      // One invoice per card, for exactly what that card paid.
      const partPayload = {
        TerminalNumber: TERMINAL.trim(),
        Password: PASSWORD.trim(),
        TransactionId: transactionId,
        ZCreditInvoiceReceipt: {
          Type: 1,
          TaxRate: TAX_RATE,
          RecepientName: parsed.data.invoiceName || order.customer_name || "לקוח",
          RecepientCompanyID: "",
          Address: BUSINESS_ADDRESS,
          City: BUSINESS_CITY,
          ZipCode: "",
          PhoneNum: order.customer_phone ?? "",
          ReceipientEmail: parsed.data.invoiceEmail ?? "",
          EmailDocumentToReceipient: Boolean(parsed.data.invoiceEmail),
          ReturnDocumentInResponse: false,
          Items: [{
            ItemDescription: (parsed.data.note || "תשלום על חלק מההזמנה").slice(0, 100),
            ItemQuantity: 1,
            ItemPrice: sum,
            IsTaxFree: false,
          }],
        },
      };
      const partRes = await fetch(ZCREDIT_INVOICE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partPayload),
      });
      const partResult = await partRes.json().catch(() => ({}));
      const partFailed =
        !partRes.ok || partResult?.HasError === true ||
        (partResult?.ReturnCode != null && Number(partResult.ReturnCode) !== 0);
      if (partFailed) {
        invoiceMessage = String(partResult?.ReturnMessage ?? "") || "הפקת החשבונית נכשלה";
        console.error("pinpad-charge: split invoice failed", { orderId: order.id, code: partResult?.ReturnCode });
      } else {
        invoiceCreated = true;
        invoiceEmailed = Boolean(parsed.data.invoiceEmail);
        invoiceNumber = pickInvoiceNumber(partResult ?? {});
        if (paymentRow?.id) {
          await supabase.from("order_payments").update({ invoice_number: invoiceNumber }).eq("id", paymentRow.id);
        }
      }
    } else if (!transactionId) {
      invoiceMessage = "המסוף אישר את החיוב אך לא החזיר מזהה עסקה להפקת חשבונית";
      console.error("pinpad-charge: missing transaction id", {
        orderId: order.id,
        responseKeys: Object.keys(result ?? {}),
      });
    } else if (!(await claimInvoice(supabase, order.id))) {
      invoiceMessage = "כבר הופקה חשבונית להזמנה זו";
    } else {
      const { data: rows } = await supabase
        .from("order_items")
        .select("item_name, price, quantity")
        .eq("order_id", order.id);
      const items = buildInvoiceItems(rows ?? [], order);

      const invoicePayload = {
        TerminalNumber: TERMINAL.trim(),
        Password: PASSWORD.trim(),
        ZCreditInvoiceReceipt: {
          Type: 1,
          TaxRate: TAX_RATE,
          RecepientName: parsed.data.invoiceName || order.customer_name || "לקוח",
          RecepientCompanyID: "",
          Address: BUSINESS_ADDRESS,
          City: BUSINESS_CITY,
          ZipCode: "",
          PhoneNum: order.customer_phone ?? "",
          ReceipientEmail: parsed.data.invoiceEmail ?? "",
          EmailDocumentToReceipient: Boolean(parsed.data.invoiceEmail),
          ReturnDocumentInResponse: false,
          Items: items,
        },
      };

      let invoiceResponse: Response | null = null;
      let invoiceResult: Record<string, unknown> = {};
      for (let index = 0; index < transactionIdCandidates.length; index += 1) {
        const candidate = transactionIdCandidates[index];
        if (index > 0) await new Promise((resolve) => setTimeout(resolve, 750));
        invoiceResponse = await fetch(ZCREDIT_INVOICE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...invoicePayload, TransactionId: candidate }),
        });
        invoiceResult = await invoiceResponse.json().catch(() => ({}));
        const candidateFailed =
          !invoiceResponse.ok ||
          invoiceResult?.HasError === true ||
          (invoiceResult?.ReturnCode != null && Number(invoiceResult.ReturnCode) !== 0);
        if (!candidateFailed) {
          transactionId = candidate;
          break;
        }
        // Only an unknown transaction can be corrected by trying another
        // identifier. Other failures must not risk creating a duplicate.
        if (Number(invoiceResult?.ReturnCode) !== -80) break;
      }
      const invoiceFailed =
        !invoiceResponse?.ok ||
        invoiceResult?.HasError === true ||
        (invoiceResult?.ReturnCode != null && Number(invoiceResult.ReturnCode) !== 0);

      if (invoiceFailed) {
        await releaseInvoice(supabase, order.id);
        invoiceMessage = String(invoiceResult?.ReturnMessage ?? "") || "הפקת החשבונית נכשלה";
        console.error("pinpad-charge: invoice failed", {
          orderId: order.id,
          httpStatus: invoiceResponse?.status ?? null,
          code: invoiceResult?.ReturnCode,
          msg: invoiceResult?.ReturnMessage,
        });
      } else {
        invoiceCreated = true;
        invoiceEmailed = Boolean(parsed.data.invoiceEmail);
        invoiceNumber = pickInvoiceNumber(invoiceResult ?? {});
        const issuedAt = new Date().toISOString();
        const { error: invoiceUpdateError } = await supabase
          .from("orders")
          .update({
            payment_transaction_id: transactionId,
            invoice_number: invoiceNumber,
            invoice_issued_at: issuedAt,
          })
          .eq("id", order.id);
        if (invoiceUpdateError) {
          console.error("pinpad-charge: invoice persistence failed", {
            orderId: order.id,
            message: invoiceUpdateError.message,
          });
        }
        console.log("pinpad-charge: invoice created", {
          orderId: order.id,
          invoiceNumber,
          emailed: invoiceEmailed,
        });
      }
    }

    return json({
      success: true,
      partial: !isFinal,
      paidNow: sum,
      remaining: round2(remaining - sum),
      orderNumber: order.order_number ?? null,
      approvalNumber: result?.ApprovalNumber ?? null,
      card4: result?.Card4Digits ?? null,
      clientReceipt: result?.ClientReciept ?? null,
      invoiceCreated,
      invoiceEmailed,
      invoiceNumber,
      invoiceMessage,
    });
  } catch (e) {
    console.error("pinpad-charge error", e);
    return json({ error: "server_error" }, 500);
  }
});
