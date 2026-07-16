// Payment session creator (Z-Credit).
// Security hardening: callback/success/cancel URLs are hard-coded server-side
// so a malicious client cannot redirect payment notifications to an attacker
// server or an unrelated domain. The callback also carries a shared secret
// query param that payment-callback verifies before touching an order.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZCREDIT_API_URL = "https://pci.zcredit.co.il/WebCheckout/api/WebCheckout/CreateSession";

const CartItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().default(""),
  price: z.number().nonnegative(),
  quantity: z.number().int().min(1).max(100),
});

const BodySchema = z.object({
  total: z.number().positive().max(1_000_000),
  items: z.array(CartItemSchema).min(1).max(100),
  customerName: z.string().max(200).optional().default(""),
  // customerPhone is now REQUIRED — used to prove the caller owns the order.
  customerPhone: z.string().min(6).max(30),
  orderId: z.string().uuid(),
});

// Normalize phone representations so "+972...", "972...", and "05..." all match.
function normalizePhone(p: string): string {
  return p.replace(/\D/g, "").replace(/^972/, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ZCREDIT_KEY = Deno.env.get("ZCREDIT_KEY");
    const CALLBACK_SECRET = Deno.env.get("ZCREDIT_CALLBACK_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "https://yum-order-maker.lovable.app";
    if (!ZCREDIT_KEY || !CALLBACK_SECRET || !SUPABASE_URL) {
      return new Response(JSON.stringify({ error: "server_misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "invalid_body", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const body = parsed.data;

    // Verify order exists, belongs to this caller (phone match), and total
    // matches. The phone check binds this session to the customer who placed
    // the order — without it any UUID guess could open a checkout session for
    // someone else's bill. Ownership + total mismatch both return the same
    // generic "order_not_found" so an attacker cannot distinguish the two.
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: order, error: ordErr } = await supabase
      .from("orders")
      .select("id, total, status, customer_phone")
      .eq("id", body.orderId)
      .maybeSingle();
    if (
      ordErr ||
      !order ||
      normalizePhone(order.customer_phone ?? "") !== normalizePhone(body.customerPhone) ||
      Math.abs(Number(order.total) - body.total) > 0.01
    ) {
      return new Response(JSON.stringify({ error: "order_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hardcode URLs server-side. Callback carries a secret token that
    // payment-callback verifies. Redirect URLs are locked to our app origin.
    const callbackUrl = `${SUPABASE_URL}/functions/v1/payment-callback?token=${encodeURIComponent(CALLBACK_SECRET)}`;
    const successUrl = `${PUBLIC_APP_URL}/order-confirmation/${body.orderId}`;
    const cancelUrl = `${PUBLIC_APP_URL}/checkout?cancelled=1`;

    const cartItems = body.items.map((item) => ({
      Amount: Number(item.price),
      Currency: "ILS",
      Name: item.name,
      Description: item.description || item.name,
      Quantity: Number(item.quantity),
      IsTaxFree: false,
    }));

    const zcreditBody = {
      Key: ZCREDIT_KEY,
      Local: "He",
      UniqueId: body.orderId,
      SuccessUrl: successUrl,
      CancelUrl: cancelUrl,
      CallbackUrl: callbackUrl,
      PaymentType: "regular",
      CreateInvoice: true,
      ShowCart: true,
      ThemeColor: "E85D2C",
      AdditionalText: `הזמנה עבור ${body.customerName} ${body.customerPhone}`.trim(),
      Customer: {
        Name: body.customerName,
        PhoneNumber: body.customerPhone,
        Email: "",
        Attributes: {
          HolderId: "optional",
          Name: "optional",
          PhoneNumber: "optional",
          Email: "optional",
        },
      },
      CartItems: cartItems,
      UseLightMode: false,
      BitButtonEnabled: true,
      ApplePayButtonEnabled: true,
      GooglePayButtonEnabled: true,
    };

    const response = await fetch(ZCREDIT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zcreditBody),
    });
    const result = await response.json();

    if (result.HasError || result.Data?.HasError) {
      console.error("Z-Credit error:", JSON.stringify(result));
      return new Response(JSON.stringify({
        error: result.Errors?.[0]?.MessageHe || result.Data?.ReturnMessage || "שגיאה ביצירת עמוד תשלום",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      sessionId: result.Data.SessionId,
      sessionUrl: result.Data.SessionUrl,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Payment error:", error);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
