// customer-auth: DISABLED.
//
// Customer identity, order history and favorites are stored on the customer's
// own device only (localStorage). The server no longer issues login tokens or
// returns any customer data by phone or token, so nobody can type someone
// else's phone number and see their details.
//
// Marketing consent is recorded only together with an order (create-order).
// Opt-out stays available via the public unsubscribe-marketing function.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  return new Response(JSON.stringify({ error: 'gone' }), {
    status: 410,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
