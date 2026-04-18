const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio'

const normalizePhoneNumber = (value: string) => {
  const sanitized = value.trim().replace(/^whatsapp:/i, '').replace(/[\s-]/g, '')
  if (!sanitized) return null
  if (sanitized.startsWith('+')) return /^\+\d{8,15}$/.test(sanitized) ? sanitized : null
  if (sanitized.startsWith('00')) {
    const n = `+${sanitized.slice(2)}`
    return /^\+\d{8,15}$/.test(n) ? n : null
  }
  if (sanitized.startsWith('0')) {
    const n = `+972${sanitized.slice(1)}`
    return /^\+\d{8,15}$/.test(n) ? n : null
  }
  const n = `+${sanitized}`
  return /^\+\d{8,15}$/.test(n) ? n : null
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Verify caller is authenticated admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const token = authHeader.replace('Bearer ', '')
    const { data: userData } = await supabase.auth.getUser(token)
    if (!userData?.user) return json({ error: 'Unauthorized' }, 401)
    const { data: roleCheck } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle()
    if (!roleCheck) return json({ error: 'Forbidden' }, 403)

    // Fetch all pending subscribers
    const { data: subs, error: subsErr } = await supabase
      .from('reopen_notifications')
      .select('id, phone, name')
      .eq('notified', false)
    if (subsErr) return json({ error: subsErr.message }, 500)
    if (!subs || subs.length === 0) return json({ sent: 0 })

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY')
    const whatsappFrom = Deno.env.get('TWILIO_WHATSAPP_FROM')
    const twilioConfigured = !!(LOVABLE_API_KEY && TWILIO_API_KEY && whatsappFrom)
    const formattedFrom = whatsappFrom ? normalizePhoneNumber(whatsappFrom) : null

    let sent = 0
    const successIds: string[] = []

    for (const sub of subs) {
      const to = normalizePhoneNumber(sub.phone)
      if (!to) continue
      if (twilioConfigured && formattedFrom) {
        const greeting = sub.name ? `שלום ${sub.name}, ` : ''
        const body = `${greeting}האתר של הבקתה נפתח שוב להזמנות! 🎉\nלחצו להזמנה: https://yum-order-maker.lovable.app`
        try {
          const resp = await fetch(`${GATEWAY_URL}/Messages.json`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'X-Connection-Api-Key': TWILIO_API_KEY!,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To: `whatsapp:${to}`,
              From: `whatsapp:${formattedFrom}`,
              Body: body,
            }),
          })
          if (resp.ok) {
            sent++
            successIds.push(sub.id)
          } else {
            console.error('Twilio send failed', await resp.text())
          }
        } catch (e) {
          console.error('Twilio error', e)
        }
      } else {
        // Mark as notified anyway in dev mode
        successIds.push(sub.id)
      }
    }

    if (successIds.length > 0) {
      await supabase
        .from('reopen_notifications')
        .update({ notified: true })
        .in('id', successIds)
    }

    return json({ sent, total: subs.length })
  } catch (e) {
    console.error('notify-reopen error', e)
    return json({ error: 'Internal error' }, 500)
  }
})
