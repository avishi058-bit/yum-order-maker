// Returns the invoice Z-Credit already issued for a paid credit order, so the
// kitchen can print it on the bon printer. Never creates a new document:
//
// - If the order already has the invoice number stored, it is returned.
// - Website orders: the number is looked up once (read-only) in the Z-Credit
//   payment-page session (GetSessionStatus) and stored on the order.
// - Otherwise a clear message is returned instead of an error.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";
import { buildInvoiceItems } from "../_shared/invoice.ts";
import { fetchSessionStatus } from "../_shared/zcreditSession.ts";

const TAX_RATE = 18;

const BodySchema = z.object({
  orderId: z.string().uuid(),
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email().max(255).optional(),
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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    if (!SUPABASE_URL) return json({ error: "server_misconfigured" }, 500);

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
        "id, total, payment_method, paid_at, payment_session_id, created_at, customer_name, customer_phone, invoice_number, invoice_issued_at, soldier_donation, donation_only",
      )
      .eq("id", parsed.data.orderId)
      .maybeSingle();

    if (!order) return json({ success: false, message: "ההזמנה לא נמצאה" });
    if (order.payment_method !== "credit" || !order.paid_at) {
      return json({ success: false, message: "חשבונית מודפסת רק להזמנה ששולמה באשראי" });
    }

    let invoiceNumber: string | null = order.invoice_number ?? null;
    let issuedAt: string | null = order.invoice_issued_at ?? null;

    // Website payment page: Z-Credit issued the invoice with the charge. Look
    // its number up once (read-only) and keep it on the order.
    const sessionId = String(order.payment_session_id ?? "");
    if (!invoiceNumber && sessionId && !sessionId.startsWith("pinpad:")) {
      const status = await fetchSessionStatus(sessionId);
      if (status.outcome === "paid" && status.documentNumber) {
        invoiceNumber = status.documentNumber;
        issuedAt = issuedAt ?? order.paid_at;
        await supabase
          .from("orders")
          .update({ invoice_number: invoiceNumber, invoice_issued_at: issuedAt })
          .eq("id", order.id)
          .is("invoice_number", null);
      }
    }

    if (!invoiceNumber) {
      console.warn("issue-invoice: no stored invoice number", { orderId: order.id });
      return json({
        success: false,
        message: "לא נמצא מספר חשבונית להזמנה הזו. אפשר להפיק העתק מהאתר של Z-Credit",
      });
    }

    const { data: rows } = await supabase
      .from("order_items")
      .select("item_name, price, quantity")
      .eq("order_id", order.id);
    const items = buildInvoiceItems(rows ?? [], order);

    return json({
      success: true,
      invoiceNumber,
      issuedAt: issuedAt ?? order.paid_at ?? order.created_at,
      customerName: order.customer_name || "לקוח",
      customerPhone: order.customer_phone ?? "",
      total: Number(order.total),
      taxRate: TAX_RATE,
      items: items.map((i) => ({ name: i.ItemDescription, qty: i.ItemQuantity, price: i.ItemPrice })),
    });
  } catch (e) {
    console.error("issue-invoice error", e);
    return json({ error: "server_error" }, 500);
  }
});
