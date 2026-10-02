// get-customer-orders: DISABLED.
// Order history is stored on the customer's device only. This endpoint never
// returns data; it stays deployed only so older cached app versions get an
// empty list instead of an error.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ orders: [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
