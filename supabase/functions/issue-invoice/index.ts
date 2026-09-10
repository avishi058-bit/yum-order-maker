// Issues (or re-uses) the official Z-Credit invoice/receipt for a paid credit
// order and returns its data so the kitchen can print it on the bon printer.
//
// - If the order already has an invoice number, nothing new is issued.
// - Otherwise Transaction/CreateInvoiceReceipt is called with the terminal's
//   TransactionId, and the returned document number is stored on the order.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";

const INVOICE_URL =
  "https://pci.zcredit.co.il/ZCreditWS/api/Transaction/CreateInvoiceReceipt";

const TAX_RATE = 18;
const BUSINESS_ADDRESS = "ערבי הנחל 22";
const BUSINESS_CITY = "תושיה";

const BodySchema = z.object({
  orderId: z.string().uuid(),
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email().max(255).optional(),
});

function pickNumber(result: Record<string, unknown>): string | null {
  const keys = [
    "InvoiceReceiptNumber",
    "DocumentNumber",
    "InvoiceNumber",
    "ReceiptNumber",
    "DocNumber",
    "ReferenceNumber",
  ];
  for (const k of keys) {
    const v = result?.[k];
    if (v != null && String(v).trim() !== "" && String(v) !== "0") return String(v);
  }
  return null;
}

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

    // Kitchen-only action: require a signed-in staff user.
    const authHeader = req.headers.get("Authorization") ?? "";
    const anon = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await anon.auth.getUser();
    if (!userRes?.user) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userRes.user.id,
      _role: "admin",
    });
    const { data: isKitchen } = await supabase.rpc("has_role", {
      _user_id: userRes.user.id,
      _role: "kitchen",
    });
    if (!isAdmin && !isKitchen) return json({ error: "forbidden" }, 403);

    const { data: order } = await supabase
      .from("orders")
      .select(
        "id, order_number, total, payment_method, payment_transaction_id, created_at, customer_name, customer_phone, invoice_number, invoice_issued_at",
      )
      .eq("id", parsed.data.orderId)
      .maybeSingle();

    if (!order) return json({ error: "order_not_found" }, 404);
    if (order.payment_method !== "credit" || !order.payment_transaction_id) {
      return json({ error: "no_invoice_for_order" }, 409);
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

    const printable = {
      orderNumber: order.order_number,
      customerName: parsed.data.name || order.customer_name || "לקוח",
      customerPhone: order.customer_phone ?? "",
      total,
      taxRate: TAX_RATE,
      items: items.map((i) => ({
        name: i.ItemDescription,
        qty: i.ItemQuantity,
        price: i.ItemPrice,
      })),
    };

    // Already issued — return the stored document, don't create a second one.
    if (order.invoice_number) {
      return json({
        success: true,
        reissued: false,
        invoiceNumber: order.invoice_number,
        issuedAt: order.invoice_issued_at ?? order.created_at,
        ...printable,
      });
    }

    const payload = {
      TerminalNumber: TERMINAL.trim(),
      Password: PASSWORD.trim(),
      TransactionId: String(order.payment_transaction_id),
      ZCreditInvoiceReceipt: {
        Type: 1, // חשבונית מס קבלה
        TaxRate: TAX_RATE,
        RecepientName: printable.customerName,
        RecepientCompanyID: "",
        Address: BUSINESS_ADDRESS,
        City: BUSINESS_CITY,
        ZipCode: "",
        PhoneNum: printable.customerPhone,
        ReceipientEmail: parsed.data.email ?? "",
        EmailDocumentToReceipient: Boolean(parsed.data.email),
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
      console.error("issue-invoice: failed", {
        orderId: order.id,
        code: result?.ReturnCode,
        msg: result?.ReturnMessage,
      });
      return json({
        success: false,
        message: result?.ReturnMessage || "הפקת החשבונית נכשלה",
      });
    }

    const invoiceNumber = pickNumber(result ?? {});
    console.log("issue-invoice: created", {
      orderId: order.id,
      invoiceNumber,
      keys: Object.keys(result ?? {}),
    });

    const issuedAt = new Date().toISOString();
    await supabase
      .from("orders")
      .update({ invoice_number: invoiceNumber, invoice_issued_at: issuedAt })
      .eq("id", order.id);

    return json({
      success: true,
      reissued: true,
      invoiceNumber,
      issuedAt,
      ...printable,
    });
  } catch (e) {
    console.error("issue-invoice error", e);
    return json({ error: "server_error" }, 500);
  }
});
