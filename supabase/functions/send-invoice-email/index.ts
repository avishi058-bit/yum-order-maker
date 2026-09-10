// Issues a Z-Credit invoice/receipt (חשבונית מס קבלה) for a kiosk credit
// charge and emails it to the customer.
//
// Flow: pinpad-charge stores the terminal's TransactionId on the order ->
// this function calls Transaction/CreateInvoiceReceipt with that id, the
// order lines, and the customer's email (EmailDocumentToReceipient=true).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";

const INVOICE_URL =
  "https://pci.zcredit.co.il/ZCreditWS/api/Transaction/CreateInvoiceReceipt";

// Business details printed on the document.
const TAX_RATE = 18;
const BUSINESS_ADDRESS = "ערבי הנחל 22";
const BUSINESS_CITY = "תושיה";

const BodySchema = z.object({
  orderId: z.string().uuid(),
  email: z.string().trim().email().max(255),
  // Optional "לכבוד" name; falls back to the order's customer name.
  name: z.string().trim().max(100).optional(),
});

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const TERMINAL = Deno.env.get("ZCREDIT_TERMINAL_NUMBER");
    const PASSWORD =
      Deno.env.get("ZCREDIT_TERMINAL_PASSWORD") ?? Deno.env.get("ZCREDIT_WS_PASSWORD");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    if (!TERMINAL || !PASSWORD || !SUPABASE_URL) {
      return json({ error: "server_misconfigured" }, 500);
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid_body" }, 400);

    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Basic abuse guard: a handful of sends per order.
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      p_action: "invoice_email",
      p_key: parsed.data.orderId,
      p_max_attempts: 5,
      p_window: "01:00:00",
    });
    if (allowed === false) return json({ error: "rate_limited" }, 429);
    await supabase.rpc("record_rate_limit_attempt", {
      p_action: "invoice_email",
      p_key: parsed.data.orderId,
    });

    const { data: order } = await supabase
      .from("orders")
      .select(
        "id, order_number, total, payment_method, payment_transaction_id, created_at, customer_name, customer_phone",
      )
      .eq("id", parsed.data.orderId)
      .maybeSingle();

    if (!order) return json({ error: "order_not_found" }, 404);
    if (order.payment_method !== "credit" || !order.payment_transaction_id) {
      return json({ error: "no_invoice_for_order" }, 409);
    }
    // Only recent orders (24h) can be invoiced/re-sent.
    if (Date.now() - new Date(order.created_at).getTime() > 24 * 3600 * 1000) {
      return json({ error: "order_too_old" }, 409);
    }

    const { data: rows } = await supabase
      .from("order_items")
      .select("item_name, price, quantity")
      .eq("order_id", order.id);

    const items = (rows ?? [])
      .filter((r) => Number(r.price) > 0)
      .map((r) => ({
        ItemDescription: String(r.item_name ?? "פריט").slice(0, 100),
        ItemQuantity: Number(r.quantity) || 1,
        ItemPrice: Number(r.price),
        IsTaxFree: false,
      }));

    // Keep the document total identical to the amount actually charged.
    const linesSum = items.reduce((s, i) => s + i.ItemPrice * i.ItemQuantity, 0);
    const total = Number(order.total);
    const diff = Math.round((total - linesSum) * 100) / 100;
    if (items.length === 0) {
      items.push({
        ItemDescription: `הזמנה מס' ${order.order_number ?? ""}`.trim(),
        ItemQuantity: 1,
        ItemPrice: total,
        IsTaxFree: false,
      });
    } else if (Math.abs(diff) >= 0.01) {
      items.push({
        ItemDescription: diff > 0 ? "תוספות" : "הנחה",
        ItemQuantity: 1,
        ItemPrice: diff,
        IsTaxFree: false,
      });
    }

    const payload = {
      TerminalNumber: TERMINAL.trim(),
      Password: PASSWORD.trim(),
      TransactionId: String(order.payment_transaction_id),
      ZCreditInvoiceReceipt: {
        Type: 1, // חשבונית מס קבלה
        TaxRate: TAX_RATE,
        RecepientName: parsed.data.name || order.customer_name || "לקוח",
        RecepientCompanyID: "",
        Address: BUSINESS_ADDRESS,
        City: BUSINESS_CITY,
        ZipCode: "",
        PhoneNum: order.customer_phone ?? "",
        ReceipientEmail: parsed.data.email,
        EmailDocumentToReceipient: true,
        ReturnDocumentInResponse: false,
        Items: items,
      },
    };

    const res = await fetch(INVOICE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));

    const failed =
      result?.HasError === true ||
      (result?.ReturnCode != null && Number(result.ReturnCode) !== 0);

    if (failed) {
      console.error("send-invoice-email: invoice failed", {
        orderId: order.id,
        code: result?.ReturnCode,
        msg: result?.ReturnMessage,
      });
      return json({
        success: false,
        message: result?.ReturnMessage || "שליחת החשבונית נכשלה",
      });
    }

    console.log("send-invoice-email: invoice sent", { orderId: order.id });
    return json({ success: true });
  } catch (e) {
    console.error("send-invoice-email error", e);
    return json({ error: "server_error" }, 500);
  }
});
