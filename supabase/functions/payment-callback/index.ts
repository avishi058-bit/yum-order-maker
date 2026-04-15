import { corsHeaders } from '@supabase/supabase-js/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Z-Credit sends callback as POST with form data or JSON
    let data: any
    const contentType = req.headers.get('content-type') || ''
    
    if (contentType.includes('application/json')) {
      data = await req.json()
    } else if (contentType.includes('form')) {
      const formData = await req.formData()
      data = Object.fromEntries(formData.entries())
    } else {
      // Try to parse as JSON from query string
      const url = new URL(req.url)
      data = Object.fromEntries(url.searchParams.entries())
    }

    console.log('Payment callback received:', JSON.stringify(data))

    const orderId = data.UniqueId || data.uniqueId || data.uniqueid
    const isSuccess = data.HasError === false || data.HasError === 'false' || 
                      data.ReturnCode === 0 || data.ReturnCode === '0'

    if (orderId) {
      const newStatus = isSuccess ? 'new' : 'payment_failed'
      
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, payment_method: 'credit' })
        .eq('id', orderId)

      if (error) {
        console.error('Error updating order:', error)
      } else {
        console.log(`Order ${orderId} updated to status: ${newStatus}`)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Callback error:', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
