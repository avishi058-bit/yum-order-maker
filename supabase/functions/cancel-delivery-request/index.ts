// Cancel a pending delivery request the customer just created.
// Requires the client_token that was returned at INSERT time — proves
// ownership. Anonymous UPDATE on delivery_requests is closed at the RLS
// level, so this function (running with the service role) is the only
// way for an unauthenticated customer to cancel their own request.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  id: z.string().uuid(),
  clientToken: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "invalid_body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Only cancel if still pending/claimed and the token matches.
    const { data, error } = await supabase
      .from("delivery_requests")
      .update({ status: "rejected" })
      .eq("id", parsed.data.id)
      .eq("client_token", parsed.data.clientToken)
      .in("status", ["pending", "claimed"])
      .select("id");

    if (error) {
      console.error("cancel-delivery-request error", error);
      return new Response(JSON.stringify({ error: "server_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: (data?.length ?? 0) > 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cancel-delivery-request unexpected", e);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
