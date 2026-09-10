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

const ZCREDIT_WS_URL =
  "https://pci.zcredit.co.il/ZCreditWS/api/Transaction/CommitFullTransaction";
const ZCREDIT_INVOICE_URL =
  "https://pci.zcredit.co.il/ZCreditWS/api/Transaction/CreateInvoiceReceipt";
const TAX_RATE = 18;
const BUSINESS_ADDRESS = "ערבי הנחל 22";
const BUSINESS_CITY = "תושיה";

const BodySchema = z.object({
  orderId: z.string().uuid(),
  invoiceEmail: z.string().trim().email().max(255).optional(),
  invoiceName: z.string().trim().max(100).optional(),
});

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

    const { data: order, error: ordErr } = await supabase
      .from("orders")
      .select("id, total, status, customer_name, customer_phone, order_number")
      .eq("id", parsed.data.orderId)
      .maybeSingle();

    if (ordErr || !order) return json({ error: "order_not_found" }, 404);
    if (order.status !== "pending_payment") {
      return json({ error: "order_not_payable" }, 409);
    }

    const sum = Number(order.total);
    if (!(sum > 0)) return json({ error: "invalid_amount" }, 400);

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

    const transactionIdValue =
      result?.TransactionId ??
      result?.TransactionID ??
      result?.TransactionUniqueID ??
      result?.UID ??
      null;
    const transactionId =
      transactionIdValue != null && String(transactionIdValue).trim() !== ""
        ? String(transactionIdValue)
        : null;

    const { error: updErr } = await supabase
      .from("orders")
      .update({
        status: "new",
        payment_method: "credit",
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

    if (!transactionId) {
      invoiceMessage = "המסוף אישר את החיוב אך לא החזיר מזהה עסקה להפקת חשבונית";
      console.error("pinpad-charge: missing transaction id", {
        orderId: order.id,
        responseKeys: Object.keys(result ?? {}),
      });
    } else {
      const { data: rows } = await supabase
        .from("order_items")
        .select("item_name, price, quantity")
        .eq("order_id", order.id);
      const items = (rows ?? [])
        .filter((row) => Number(row.price) > 0)
        .map((row) => ({
          ItemDescription: String(row.item_name ?? "פריט").slice(0, 100),
          ItemQuantity: Number(row.quantity) || 1,
          ItemPrice: Number(row.price),
          IsTaxFree: false,
        }));
      const linesSum = items.reduce((sumValue, item) => sumValue + item.ItemPrice * item.ItemQuantity, 0);
      const difference = Math.round((sum - linesSum) * 100) / 100;
      if (items.length === 0) {
        items.push({
          ItemDescription: `הזמנה מס' ${order.order_number ?? ""}`.trim(),
          ItemQuantity: 1,
          ItemPrice: sum,
          IsTaxFree: false,
        });
      } else if (Math.abs(difference) >= 0.01) {
        items.push({
          ItemDescription: difference > 0 ? "תוספות" : "הנחה",
          ItemQuantity: 1,
          ItemPrice: difference,
          IsTaxFree: false,
        });
      }

      const invoiceResponse = await fetch(ZCREDIT_INVOICE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
            Items: items,
          },
        }),
      });
      const invoiceResult = await invoiceResponse.json().catch(() => ({}));
      const invoiceFailed =
        !invoiceResponse.ok ||
        invoiceResult?.HasError === true ||
        (invoiceResult?.ReturnCode != null && Number(invoiceResult.ReturnCode) !== 0);

      if (invoiceFailed) {
        invoiceMessage = invoiceResult?.ReturnMessage || "הפקת החשבונית נכשלה";
        console.error("pinpad-charge: invoice failed", {
          orderId: order.id,
          httpStatus: invoiceResponse.status,
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
          .update({ invoice_number: invoiceNumber, invoice_issued_at: issuedAt })
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
