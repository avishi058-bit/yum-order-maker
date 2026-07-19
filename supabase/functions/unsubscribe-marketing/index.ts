// Public unsubscribe endpoint — Israeli Spam Law (תיקון 40) requires an
// immediate, no-login-required opt-out. Setting marketing_consent=false is
// non-destructive so accepting a bare phone is acceptable; we still
// rate-limit by IP to prevent abuse and log every event to consent_events.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.22.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const BodySchema = z.object({
  phone: z.string().regex(/^05\d{8}$/, 'מספר טלפון לא תקין'),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('cf-connecting-ip') ||
      'unknown'

    // Rate limit — 10 per hour per IP
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_action: 'unsubscribe',
      p_key: ip,
      p_max_attempts: 10,
      p_window: '1 hour',
    })
    if (allowed === false) {
      return json({ error: 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.' }, 429)
    }
    await supabase.rpc('record_rate_limit_attempt', {
      p_action: 'unsubscribe',
      p_key: ip,
      p_ip_address: ip,
    })

    const body = await req.json().catch(() => ({}))
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) return json({ error: 'מספר טלפון לא תקין' }, 400)

    const { phone } = parsed.data

    // Look up customer (may not exist — still respond success to avoid enumeration).
    const { data: customer } = await supabase
      .from('customers')
      .select('id, phone, marketing_consent')
      .eq('phone', phone)
      .maybeSingle()

    if (customer) {
      await supabase
        .from('customers')
        .update({ marketing_consent: false, marketing_consent_at: null })
        .eq('id', customer.id)

      // Only log an event if there was actually a consent to revoke.
      if (customer.marketing_consent) {
        await supabase.from('consent_events').insert({
          customer_id: customer.id,
          phone: customer.phone,
          consent_type: 'marketing',
          action: 'revoked',
          method: 'unsubscribe_page',
          ip_address: ip,
          user_agent: req.headers.get('user-agent'),
        })
      }
    }

    return json({ success: true })
  } catch (err) {
    console.error('unsubscribe error:', err)
    return json({ error: 'שגיאה פנימית' }, 500)
  }
})
