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

const BodySchema = z.object({
  orderId: z.string().uuid(),
});

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
    const PASSWORD = Deno.env.get("ZCREDIT_WS_PASSWORD");
    const PINPAD_ID = Deno.env.get("ZCREDIT_PINPAD_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    if (!TERMINAL || !PASSWORD || !PINPAD_ID || !SUPABASE_URL) {
      return json({ error: "server_misconfigured" }, 500);
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "invalid_body" }, 400);

    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error: ordErr } = await supabase
      .from("orders")
      .select("id, total, status, customer_name, order_number")
      .eq("id", parsed.data.orderId)
      .maybeSingle();

    if (ordErr || !order) return json({ error: "order_not_found" }, 404);
    if (order.status !== "pending_payment") {
      return json({ error: "order_not_payable" }, 409);
    }

    const sum = Number(order.total);
    if (!(sum > 0)) return json({ error: "invalid_amount" }, 400);

    const payload = {
      TerminalNumber: TERMINAL,
      Password: PASSWORD,
      // Routing the charge to the physical device: PINPAD prefix + device id.
      Track2: `PINPAD${PINPAD_ID}`,
      TransactionSum: sum,
      NumberOfPayments: 1,
      TransactionType: "01",
      CurrencyType: 1,
      CreditType: 1,
      J: 0,
      IsCustomerPresent: true,
      CustomerName: String(order.customer_name ?? "").replace(/[^\p{L}\p{N} ]/gu, ""),
      ItemDescription: `Order ${order.order_number ?? ""}`.trim(),
      TransactionUniqueID: order.id,
      TransactionUniqueIdForQuery: order.id,
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

    const { error: updErr } = await supabase
      .from("orders")
      .update({ status: "new", payment_method: "credit" })
      .eq("id", order.id)
      .eq("status", "pending_payment");
    if (updErr) console.error("pinpad-charge: order update failed", updErr);

    return json({
      success: true,
      orderNumber: order.order_number ?? null,
      approvalNumber: result?.ApprovalNumber ?? null,
      card4: result?.Card4Digits ?? null,
      clientReceipt: result?.ClientReciept ?? null,
    });
  } catch (e) {
    console.error("pinpad-charge error", e);
    return json({ error: "server_error" }, 500);
  }
});
