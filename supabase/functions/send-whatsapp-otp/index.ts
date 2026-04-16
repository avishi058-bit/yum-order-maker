const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.22.4'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio'
const OTP_EXPIRY_MS = 5 * 60 * 1000
const DEV_BYPASS_CODE = '1234'

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const normalizePhoneNumber = (value: string) => {
  const sanitized = value.trim().replace(/^whatsapp:/i, '').replace(/[\s-]/g, '')
  if (!sanitized) return null
  if (sanitized.startsWith('+')) {
    return /^\+\d{8,15}$/.test(sanitized) ? sanitized : null
  }
  if (sanitized.startsWith('00')) {
    const normalized = `+${sanitized.slice(2)}`
    return /^\+\d{8,15}$/.test(normalized) ? normalized : null
  }
  if (sanitized.startsWith('0')) {
    const normalized = `+972${sanitized.slice(1)}`
    return /^\+\d{8,15}$/.test(normalized) ? normalized : null
  }
  const normalized = `+${sanitized}`
  return /^\+\d{8,15}$/.test(normalized) ? normalized : null
}

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Check if WhatsApp/Twilio is configured
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY')
  const whatsappFrom = Deno.env.get('TWILIO_WHATSAPP_FROM')
  const twilioConfigured = !!(LOVABLE_API_KEY && TWILIO_API_KEY && whatsappFrom)

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    const body = await req.json()

    if (action === 'send') {
      const parsed = SendSchema.safeParse(body)
      if (!parsed.success) {
        return jsonResponse({ error: 'מספר טלפון לא תקין' }, 400)
      }

      const { phone } = parsed.data
      const formattedPhone = normalizePhoneNumber(phone)
      if (!formattedPhone) {
        return jsonResponse({ error: 'מספר טלפון לא תקין' }, 400)
      }

      if (twilioConfigured) {
        // Send real OTP via WhatsApp
        const formattedWhatsappFrom = normalizePhoneNumber(whatsappFrom!)
        if (!formattedWhatsappFrom) {
          console.error('TWILIO_WHATSAPP_FROM is invalid:', whatsappFrom)
          return jsonResponse({ error: 'מספר השולח בוואטסאפ לא מוגדר נכון' }, 500)
        }

        const code = String(Math.floor(1000 + Math.random() * 9000))

        const twilioResponse = await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'X-Connection-Api-Key': TWILIO_API_KEY!,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: `whatsapp:${formattedPhone}`,
            From: `whatsapp:${formattedWhatsappFrom}`,
            Body: `קוד האימות שלך מהבקתה: ${code}\nאין להעביר את הקוד לאף אחד`,
          }),
        })

        const twilioData = await twilioResponse.json()
        if (!twilioResponse.ok) {
          console.error('Twilio error:', twilioData)
          return jsonResponse({ error: 'שגיאה בשליחת הקוד' }, 500)
        }

        const { error: insertError } = await supabase.from('verification_codes').insert({
          phone,
          code,
          expires_at: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
        })

        if (insertError) {
          console.error('Failed to store verification code:', insertError)
          return jsonResponse({ error: 'שגיאה בשמירת קוד האימות' }, 500)
        }
      } else {
        // Dev mode: store bypass code 1234
        console.log(`[DEV MODE] OTP bypass active for ${phone}. Use code: ${DEV_BYPASS_CODE}`)
        
        const { error: insertError } = await supabase.from('verification_codes').insert({
          phone,
          code: DEV_BYPASS_CODE,
          expires_at: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
        })

        if (insertError) {
          console.error('Failed to store dev verification code:', insertError)
        }
      }

      // Check if customer exists
      const { data: customer } = await supabase
        .from('customers')
        .select('name')
        .eq('phone', phone)
        .maybeSingle()

      return jsonResponse({ 
        success: true, 
        customerName: customer?.name || null,
        devMode: !twilioConfigured,
      })

    } else if (action === 'verify') {
      const parsed = VerifySchema.safeParse(body)
      if (!parsed.success) {
        return jsonResponse({ error: 'קוד לא תקין' }, 400)
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
        return jsonResponse({ error: 'קוד שגוי או שפג תוקפו' }, 400)
      }

      await supabase.from('verification_codes').update({ verified: true }).eq('id', record.id)

      return jsonResponse({ success: true })
    }

    return jsonResponse({ error: 'Invalid action' }, 400)
  } catch (error) {
    console.error('Error:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
