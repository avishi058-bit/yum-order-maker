const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.22.4'
import { getClientIp } from '../_shared/clientIp.ts'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio'
const OTP_EXPIRY_MS = 5 * 60 * 1000

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

async function verifyTurnstileToken(token: string, remoteIp: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) {
    // Fail closed: without the secret we cannot tell humans from bots.
    console.error('TURNSTILE_SECRET_KEY not configured; rejecting request')
    return false
  }

  try {
    const params = new URLSearchParams()
    params.append('secret', secret)
    params.append('response', token)
    if (remoteIp && remoteIp !== 'unknown') params.append('remoteip', remoteIp)

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: params,
    })
    const data = await res.json()
    if (!data.success) {
      console.warn('Turnstile verification failed', data)
      return false
    }
    return true
  } catch (err) {
    console.error('Turnstile verification error', err)
    return false
  }
}

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
  phone: z.string().regex(/^05\d{8}$/, 'מספר הטלפון חייב להתחיל ב-05 ולהכיל 10 ספרות'),
  turnstileToken: z.string().min(1).max(2048),
})

const VerifySchema = z.object({
  phone: z.string().regex(/^05\d{8}$/, 'מספר הטלפון חייב להתחיל ב-05 ולהכיל 10 ספרות'),
  code: z.string().regex(/^\d{6}$/),
  turnstileToken: z.string().min(1).max(2048).optional(),
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

    // Trusted client IP (cannot be spoofed via x-forwarded-for).
    const clientIp = getClientIp(req)

    // Temporary IP block (24h) - expired blocks are ignored by is_ip_blocked.
    if (clientIp && clientIp !== 'unknown') {
      const { data: ipBlocked } = await supabase.rpc('is_ip_blocked', { p_ip: clientIp })
      if (ipBlocked === true) {
        return jsonResponse({ error: 'הגישה נחסמה עקב פעילות חשודה. יש לפנות לתמיכה.' }, 403)
      }
    }

    // Attack-mode detection: when the system is under active attack, everything is tightened.
    const { data: attackMode } = await supabase.rpc('is_attack_mode_active')
    const underAttack = attackMode === true

    // Phone block check (kept for existing entries; new brute-force events block IP instead).
    if (typeof body?.phone === 'string') {
      const { data: blocked } = await supabase
        .from('blocked_phones')
        .select('phone')
        .eq('phone', body.phone)
        .maybeSingle()
      if (blocked) {
        return jsonResponse({ error: 'המספר נחסם עקב פעילות חשודה. יש לפנות לתמיכה.' }, 403)
      }
    }

    if (action === 'send') {
      const parsed = SendSchema.safeParse(body)
      if (!parsed.success) {
        return jsonResponse({ error: 'מספר טלפון לא תקין או חסר אימות אבטחה' }, 400)
      }

      const { phone, turnstileToken } = parsed.data
      const turnstileOk = await verifyTurnstileToken(turnstileToken, clientIp)
      if (!turnstileOk) {
        return jsonResponse({ error: 'אימות האבטחה נכשל. נסה שוב.' }, 403)
      }

      const formattedPhone = normalizePhoneNumber(phone)
      if (!formattedPhone) {
        return jsonResponse({ error: 'מספר טלפון לא תקין' }, 400)
      }

      // Rate limit: max 3 send attempts per phone in 5 minutes.
      const { data: allowed, error: rateError } = await supabase.rpc(
        'check_otp_rate_limit',
        { p_phone: phone }
      )
      if (rateError || allowed === false) {
        console.warn('OTP rate limit exceeded for', phone, rateError)
        return jsonResponse({ error: 'יותר מדי ניסיונות. נסו שוב בעוד 5 דקות.' }, 429)
      }

      // Record this attempt so the count stays accurate.
      await supabase.rpc('record_rate_limit_attempt', {
        p_action: 'otp_send',
        p_key: phone,
        p_ip_address: clientIp === 'unknown' ? null : clientIp,
      })

      if (!twilioConfigured) {
        // Production hardening: no static bypass codes are ever inserted.
        // If Twilio is misconfigured, we fail loudly instead of silently
        // letting anyone in with a well-known code.
        console.error('OTP send failed: Twilio not configured')
        return jsonResponse({ error: 'שירות שליחת קודים אינו זמין כרגע. נסו שוב מאוחר יותר.' }, 503)
      } else {
        // Production: send a real OTP via WhatsApp.
        const formattedWhatsappFrom = normalizePhoneNumber(whatsappFrom!)
        if (!formattedWhatsappFrom) {
          console.error('TWILIO_WHATSAPP_FROM is invalid:', whatsappFrom)
          return jsonResponse({ error: 'מספר השולח בוואטסאפ לא מוגדר נכון' }, 500)
        }

        // Cryptographically secure 6-digit code (rejection sampling avoids bias).
        const buf = new Uint32Array(1)
        let n = 0
        do { crypto.getRandomValues(buf); n = buf[0] } while (n >= 4294000000)
        const code = String(n % 1000000).padStart(6, '0')

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

        // Only one code may be valid at a time: retire all previous codes.
        await supabase.from('verification_codes').update({ verified: true }).eq('phone', phone).eq('verified', false)
        await supabase.from('verification_codes').insert({
          phone,
          code,
          expires_at: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
        })
      }

      // Never reveal the customer's name before the phone is verified.
      return jsonResponse({ success: true, devMode: !twilioConfigured })

    } else if (action === 'verify') {
      const parsed = VerifySchema.safeParse(body)
      if (!parsed.success) {
        return jsonResponse({ error: 'קוד לא תקין' }, 400)
      }

      const { phone, code, turnstileToken } = parsed.data

      // During active attack mode, require a fresh Turnstile CAPTCHA on every
      // verify. Real customers pass ("I'm not a robot"); bots can't → blocked.
      // This also protects legitimate users from the tighter IP threshold.
      if (underAttack) {
        if (!turnstileToken) {
          return jsonResponse(
            { error: 'נדרש אימות אבטחה נוסף', requiresCaptcha: true },
            428
          )
        }
        const captchaOk = await verifyTurnstileToken(turnstileToken, clientIp)
        if (!captchaOk) {
          return jsonResponse(
            { error: 'אימות האבטחה נכשל. נסה שוב.', requiresCaptcha: true },
            428
          )
        }
      }

      // Three-tier defense for OTP verification:
      // Tier 1 (soft - human mistakes): 6 failed attempts per phone / 15 min → short wait.
      // Tier 2 (phone lockout): 15 failed attempts per phone / 2 hours → temporary block.
      // Tier 3 (IP block): 10 failed attempts per IP / 1 hour → 24h IP block.
      //   In attack mode, the IP threshold tightens to 5 (still allows for
      //   normal human error) and CAPTCHA gating (above) filters out bots.

      // Tier 3: temporary (24h) IP block. Threshold tightens to 5 in attack mode.
      if (clientIp && clientIp !== 'unknown') {
        const ipMaxAttempts = underAttack ? 5 : 10
        const { data: ipAllowed } = await supabase.rpc('check_rate_limit', {
          p_action: 'otp_verify',
          p_key: `ip:${clientIp}`,
          p_max_attempts: ipMaxAttempts,
          p_window: '1 hour',
        })
        if (ipAllowed === false) {
          await supabase.from('blocked_ips').upsert(
            {
              ip_address: clientIp,
              reason: underAttack
                ? `attack_mode_active: ${ipMaxAttempts}+ failed verifications`
                : `brute_force_otp: ${ipMaxAttempts}+ failed verifications from same IP in 1 hour`,
              blocked_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            },
            { onConflict: 'ip_address' }
          )
          console.warn('IP blocked for 24h:', clientIp, 'underAttack:', underAttack)

          // Attack-pattern detection: if 3+ IPs blocked in the last hour,
          // enable 24h attack mode (no subnet blocking).
          const { data: attackDetected } = await supabase.rpc('check_and_activate_attack_mode')
          if (attackDetected === true) {
            console.error('ATTACK PATTERN DETECTED - 24h high-alert mode ON')
          }

          return jsonResponse({ error: 'הגישה נחסמה עקב פעילות חשודה. יש לפנות לתמיכה.' }, 403)
        }
      }

      // Tier 2: temporary phone lockout (2h) - not permanent, avoids punishing innocent phone owners.
      const { data: hardAllowed } = await supabase.rpc('check_rate_limit', {
        p_action: 'otp_verify',
        p_key: phone,
        p_max_attempts: 15,
        p_window: '2 hours',
      })
      if (hardAllowed === false) {
        return jsonResponse({ error: 'המספר נחסם זמנית. נסו שוב בעוד שעתיים.' }, 429)
      }

      // Tier 1: soft short wait.
      const { data: softAllowed } = await supabase.rpc('check_rate_limit', {
        p_action: 'otp_verify',
        p_key: phone,
        p_max_attempts: 6,
        p_window: '15 minutes',
      })
      if (softAllowed === false) {
        return jsonResponse({ error: 'יותר מדי ניסיונות. נסו שוב בעוד 15 דקות.' }, 429)
      }

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
        // Record failure against BOTH phone and IP so both counters advance.
        await supabase.rpc('record_rate_limit_attempt', {
          p_action: 'otp_verify',
          p_key: phone,
          p_ip_address: clientIp,
        })
        if (clientIp && clientIp !== 'unknown') {
          await supabase.rpc('record_rate_limit_attempt', {
            p_action: 'otp_verify',
            p_key: `ip:${clientIp}`,
            p_ip_address: clientIp,
          })
        }
        return jsonResponse({ error: 'קוד שגוי או שפג תוקפו' }, 400)
      }

      await supabase.from('verification_codes').update({ verified: true }).eq('id', record.id)

      const { data: customer } = await supabase
        .from('customers')
        .select('name')
        .eq('phone', phone)
        .maybeSingle()
      return jsonResponse({ success: true, customerName: customer?.name || null })
    }

    return jsonResponse({ error: 'Invalid action' }, 400)
  } catch (error) {
    console.error('Error:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
