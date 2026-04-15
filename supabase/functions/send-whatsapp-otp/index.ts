const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.22.4'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio'

const SendSchema = z.object({
  phone: z.string().min(9).max(15),
})

const VerifySchema = z.object({
  phone: z.string().min(9).max(15),
  code: z.string().length(4),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY')
  if (!TWILIO_API_KEY) {
    return new Response(JSON.stringify({ error: 'TWILIO_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    const body = await req.json()

    if (action === 'send') {
      const parsed = SendSchema.safeParse(body)
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'מספר טלפון לא תקין' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { phone } = parsed.data
      const code = String(Math.floor(1000 + Math.random() * 9000))

      // Store the code
      await supabase.from('verification_codes').insert({
        phone,
        code,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })

      // Format phone for Twilio (add +972 if starts with 0)
      let formattedPhone = phone.replace(/[-\s]/g, '')
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+972' + formattedPhone.slice(1)
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone
      }

      const whatsappFrom = Deno.env.get('TWILIO_WHATSAPP_FROM') || '+14155238886'
      const twilioResponse = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': TWILIO_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: `whatsapp:${formattedPhone}`,
          From: `whatsapp:${whatsappFrom}`,
          Body: `קוד האימות שלך מהבקתה: ${code}\nאין להעביר את הקוד לאף אחד`,
        }),
      })

      const twilioData = await twilioResponse.json()
      if (!twilioResponse.ok) {
        console.error('Twilio error:', twilioData)
        return new Response(JSON.stringify({ error: 'שגיאה בשליחת הקוד' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Check if customer exists
      const { data: customer } = await supabase
        .from('customers')
        .select('name')
        .eq('phone', phone)
        .maybeSingle()

      return new Response(JSON.stringify({ success: true, customerName: customer?.name || null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    } else if (action === 'verify') {
      const parsed = VerifySchema.safeParse(body)
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'קוד לא תקין' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { phone, code } = parsed.data

      const { data: record } = await supabase
        .from('verification_codes')
        .select('*')
        .eq('phone', phone)
        .eq('code', code)
        .eq('verified', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!record) {
        return new Response(JSON.stringify({ error: 'קוד שגוי או שפג תוקפו' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      await supabase.from('verification_codes').update({ verified: true }).eq('id', record.id)

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
