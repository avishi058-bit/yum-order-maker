// Emails the Z-Credit invoice/receipt for a kiosk (PinPad) credit charge.
//
// Flow: RegisterLoginToken (terminal credentials) -> SendEmailPostTransaction
// with the transaction ReferenceNumber stored on the order at charge time.
// Both are SOAP operations on the Z-Credit WS endpoint.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";

const SOAP_URL = "https://pci.zcredit.co.il/zcreditws.asmx";
// Stable client identifier — must be identical for both SOAP calls.
const CLIENT_UUID = "habikta-kiosk-01";

const BodySchema = z.object({
  orderId: z.string().uuid(),
  email: z.string().trim().email().max(255),
  // Optional "לכבוד" name for the invoice; falls back to the order's customer name.
  name: z.string().trim().max(100).optional(),
});

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const pick = (xml: string, tag: string) =>
  xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1] ?? "";

async function soap(action: string, inner: string) {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>${inner}</soap:Body>
</soap:Envelope>`;
  const res = await fetch(SOAP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"http://z-credit.com/${action}"`,
    },
    body,
  });
  return await res.text();
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
    const PASSWORD = Deno.env.get("ZCREDIT_TERMINAL_PASSWORD");
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
      .select("id, payment_method, payment_reference, created_at, customer_name")
      .eq("id", parsed.data.orderId)
      .maybeSingle();

    if (!order) return json({ error: "order_not_found" }, 404);
    if (order.payment_method !== "credit" || !order.payment_reference) {
      return json({ error: "no_invoice_for_order" }, 409);
    }
    // Only recent orders (24h) can be re-sent.
    if (Date.now() - new Date(order.created_at).getTime() > 24 * 3600 * 1000) {
      return json({ error: "order_too_old" }, 409);
    }

    // The invoice module may live on the web (WebCheckout) account rather than
    // the physical terminal, so try each credential pair we hold until one logs in.
    const WEB_KEY = Deno.env.get("ZCREDIT_KEY")?.trim() || "";
    const candidates: Array<{ label: string; terminal: string; password: string }> = [
      { label: "terminal", terminal: TERMINAL.trim(), password: PASSWORD.trim() },
    ];
    if (WEB_KEY) {
      candidates.push({ label: "terminal+webkey", terminal: TERMINAL.trim(), password: WEB_KEY });
      candidates.push({ label: "webkey", terminal: WEB_KEY, password: WEB_KEY });
    }

    let token = "";
    let lastCode = "";
    let lastMsg = "";
    for (const c of candidates) {
      const loginXml = await soap(
        "RegisterLoginToken",
        `<RegisterLoginToken xmlns="http://z-credit.com/">
        <TerminalNumber>${esc(c.terminal)}</TerminalNumber>
        <Password>${esc(c.password)}</Password>
        <UUID>${CLIENT_UUID}</UUID>
      </RegisterLoginToken>`,
      );
      const ok = pick(loginXml, "RegisterLoginTokenResult") === "true";
      const t = pick(loginXml, "LoginToken");
      if (ok && t) {
        console.log("send-invoice-email: login ok", { via: c.label });
        token = t;
        break;
      }
      lastCode = pick(loginXml, "Validation_Result_Code");
      lastMsg = pick(loginXml, "Validation_Result_Message");
      console.error("send-invoice-email: login failed", { via: c.label, code: lastCode, msg: lastMsg });
    }

    if (!token) {
      return json({
        success: false,
        message: lastMsg || "לא הצלחנו להתחבר לשירות החשבוניות",
      });
    }


    const invoiceName = parsed.data.name || order.customer_name || "";
    console.log("send-invoice-email: sending", { orderId: order.id, invoiceName });

    const sendXml = await soap(
      "SendEmailPostTransaction",
      `<SendEmailPostTransaction xmlns="http://z-credit.com/">
        <LoginToken>${esc(token)}</LoginToken>
        <UUID>${CLIENT_UUID}</UUID>
        <ReferenceNumber>${esc(String(order.payment_reference))}</ReferenceNumber>
        <MerchantEmail></MerchantEmail>
        <CustomerEmail>${esc(parsed.data.email)}</CustomerEmail>
      </SendEmailPostTransaction>`,
    );

    const sent = pick(sendXml, "SendEmailPostTransactionResult") === "true";
    if (!sent) {
      console.error("send-invoice-email: send failed", {
        code: pick(sendXml, "Validation_Result_Code"),
        msg: pick(sendXml, "Validation_Result_Message"),
      });
      return json({
        success: false,
        message: pick(sendXml, "Validation_Result_Message") || "שליחת החשבונית נכשלה",
      });
    }

    return json({ success: true });
  } catch (e) {
    console.error("send-invoice-email error", e);
    return json({ error: "server_error" }, 500);
  }
});
