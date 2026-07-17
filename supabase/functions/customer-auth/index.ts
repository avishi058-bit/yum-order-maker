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

const generateToken = () => {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

// Bump this whenever the wording of the marketing-consent checkbox changes.
// Stored on every consent event so we can prove what the customer actually saw.
const CONSENT_TEXT_VERSION = 'v1-2026-04-marketing-whatsapp'

// --- Schemas ---
const RegisterSchema = z.object({
  phone: z.string().regex(/^05\d{8}$/, 'מספר הטלפון חייב להתחיל ב-05 ולהכיל 10 ספרות'),
  name: z.string().min(1).max(100),
  termsAccepted: z.literal(true),
  marketingConsent: z.boolean(),
})

const AutoLoginSchema = z.object({
  deviceToken: z.string().min(32).max(128),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    const body = await req.json()

    // Rate limit sensitive actions by IP to block enumeration / bot abuse.
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('cf-connecting-ip') ||
      'unknown'
    const userAgent = req.headers.get('user-agent') || null

    // Insert a consent audit event. Best-effort — logging failure must NOT block the auth flow.
    const logConsent = async (opts: {
      customer_id?: string | null
      phone: string
      action: 'granted' | 'revoked'
      consent_type?: string
    }) => {
      try {
        await supabase.from('consent_events').insert({
          customer_id: opts.customer_id ?? null,
          phone: opts.phone,
          consent_type: opts.consent_type ?? 'marketing_whatsapp',
          action: opts.action,
          consent_text_version: CONSENT_TEXT_VERSION,
          ip_address: ip,
          user_agent: userAgent,
        })
      } catch (e) {
        console.error('consent-log failure:', e)
      }
    }

    const rateLimited: Record<string, { max: number; window: string }> = {
      register: { max: 5, window: '1 hour' },
      login: { max: 10, window: '1 hour' },
      'auto-login': { max: 60, window: '1 hour' },
      'link-from-order': { max: 5, window: '1 hour' },
      'set-favorite': { max: 30, window: '1 hour' },
      'update-name': { max: 10, window: '1 hour' },
      'update-marketing-consent': { max: 20, window: '1 hour' },
      'get-preferences': { max: 60, window: '1 hour' },
      logout: { max: 30, window: '1 hour' },
      'logout-all': { max: 10, window: '1 hour' },
    }
    const rl = action ? rateLimited[action] : null
    if (rl) {
      const rlAction = `customer-auth:${action}`
      const { data: allowed } = await supabase.rpc('check_rate_limit', {
        p_action: rlAction,
        p_key: ip,
        p_max_attempts: rl.max,
        p_window: rl.window,
      })
      if (allowed === false) {
        return json({ error: 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.' }, 429)
      }
      await supabase.rpc('record_rate_limit_attempt', {
        p_action: rlAction,
        p_key: ip,
        p_ip_address: ip,
      })
    }


    // ─── Register: after OTP verified, save customer + return token ───
    if (action === 'register') {
      const parsed = RegisterSchema.safeParse(body)
      if (!parsed.success) return json({ error: 'נתונים לא תקינים' }, 400)

      const { phone, name, termsAccepted, marketingConsent } = parsed.data
      const deviceToken = generateToken()
      const now = new Date().toISOString()

      // Check if phone already belongs to another name
      const { data: existing } = await supabase
        .from('customers')
        .select('id, name, login_count')
        .eq('phone', phone)
        .maybeSingle()

      const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
      if (existing && existing.name && norm(existing.name) !== norm(name)) {
        return json({
          error: 'מספר הטלפון הזה רשום על שם אחר',
          code: 'PHONE_TAKEN',
        }, 409)
      }

      let customer
      if (existing) {
        const { data: updated, error } = await supabase
          .from('customers')
          .update({
            name: existing.name || name,
            marketing_consent: marketingConsent,
            marketing_consent_at: marketingConsent ? now : null,
            terms_accepted_at: now,
            last_login_at: now,
            login_count: (existing.login_count || 0) + 1,
            device_token: deviceToken,
          })
          .eq('id', existing.id)
          .select('id, name, phone, marketing_consent, login_count')
          .single()
        if (error) {
          console.error('Register update error:', error)
          return json({ error: 'שגיאה ברישום' }, 500)
        }
        customer = updated
      } else {
        const { data: created, error } = await supabase
          .from('customers')
          .insert({
            phone,
            name,
            terms_accepted_at: now,
            marketing_consent: marketingConsent,
            marketing_consent_at: marketingConsent ? now : null,
            last_login_at: now,
            login_count: 1,
            device_token: deviceToken,
          })
          .select('id, name, phone, marketing_consent, login_count')
          .single()
        if (error) {
          console.error('Register insert error:', error)
          return json({ error: 'שגיאה ברישום' }, 500)
        }
        customer = created
      }

      return json({
        success: true,
        deviceToken,
        customer: {
          name: customer.name,
          phone: customer.phone,
          isReturning: !!existing,
          loginCount: customer.login_count,
        },
      })
    }
    if (action === 'auto-login') {
      const parsed = AutoLoginSchema.safeParse(body)
      if (!parsed.success) return json({ error: 'טוקן לא תקין' }, 400)

      const { deviceToken } = parsed.data
      const now = new Date().toISOString()

      // Find customer by device token
      const { data: customer, error: findError } = await supabase
        .from('customers')
        .select('id, name, phone, marketing_consent, login_count, last_login_at, favorite_items')
        .eq('device_token', deviceToken)
        .maybeSingle()

      if (findError || !customer) {
        return json({ error: 'לא נמצא', valid: false }, 401)
      }

      // Update login analytics
      await supabase
        .from('customers')
        .update({
          last_login_at: now,
          login_count: (customer.login_count || 0) + 1,
        })
        .eq('id', customer.id)

      return json({
        success: true,
        valid: true,
        customer: {
          name: customer.name,
          phone: customer.phone,
          isReturning: true,
          loginCount: (customer.login_count || 0) + 1,
          lastLoginAt: customer.last_login_at,
          favoriteItems: customer.favorite_items ?? null,
        },
      })
    }

    // ─── Login: returning user with phone (after OTP) ───
    if (action === 'login') {
      const phone = z.string().regex(/^05\d{8}$/, 'מספר הטלפון חייב להתחיל ב-05 ולהכיל 10 ספרות').safeParse(body.phone)
      if (!phone.success) return json({ error: 'מספר לא תקין' }, 400)

      const now = new Date().toISOString()
      const newToken = generateToken()

      const { data: customer, error } = await supabase
        .from('customers')
        .update({
          last_login_at: now,
          login_count: supabase.rpc ? undefined : undefined, // handled below
          device_token: newToken,
        })
        .eq('phone', phone.data)
        .select('id, name, phone, marketing_consent, login_count, last_login_at, favorite_items')
        .single()

      if (error || !customer) {
        return json({ error: 'משתמש לא נמצא' }, 404)
      }

      // Increment login count
      await supabase
        .from('customers')
        .update({ login_count: (customer.login_count || 0) + 1 })
        .eq('id', customer.id)

      return json({
        success: true,
        deviceToken: newToken,
        customer: {
          name: customer.name,
          phone: customer.phone,
          isReturning: true,
          loginCount: (customer.login_count || 0) + 1,
          lastLoginAt: customer.last_login_at,
          favoriteItems: customer.favorite_items ?? null,
        },
      })
    }

    // ─── Logout: clear device token ───
    if (action === 'logout') {
      const parsed = AutoLoginSchema.safeParse(body)
      if (!parsed.success) return json({ error: 'טוקן לא תקין' }, 400)

      await supabase
        .from('customers')
        .update({ device_token: null })
        .eq('device_token', parsed.data.deviceToken)

      return json({ success: true })
    }

    // ─── Logout all: clear token by phone ───
    if (action === 'logout-all') {
      const phone = z.string().regex(/^05\d{8}$/, 'מספר הטלפון חייב להתחיל ב-05 ולהכיל 10 ספרות').safeParse(body.phone)
      const token = z.string().min(32).safeParse(body.deviceToken)
      if (!phone.success || !token.success) return json({ error: 'נתונים לא תקינים' }, 400)

      // Verify the token belongs to this phone
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', phone.data)
        .eq('device_token', token.data)
        .maybeSingle()

      if (!customer) return json({ error: 'לא מורשה' }, 403)

      await supabase
        .from('customers')
        .update({ device_token: null })
        .eq('id', customer.id)

      return json({ success: true })
    }

    // ─── Link from order: silent customer creation/login during checkout ───
    // Used when a guest places an order. Upserts a customer record by phone
    // (preserving existing terms/marketing consent), issues a device token,
    // and returns it so the client auto-logs in for future visits.
    if (action === 'link-from-order') {
      const LinkSchema = z.object({
        phone: z.string().regex(/^05\d{8}$/, 'מספר הטלפון חייב להתחיל ב-05 ולהכיל 10 ספרות'),
        name: z.string().min(1).max(100),
      })
      const parsed = LinkSchema.safeParse(body)
      if (!parsed.success) return json({ error: 'נתונים לא תקינים' }, 400)

      const { phone, name } = parsed.data
      const deviceToken = generateToken()
      const now = new Date().toISOString()

      // Look for existing customer
      const { data: existing } = await supabase
        .from('customers')
        .select('id, name, phone, marketing_consent, login_count, terms_accepted_at, favorite_items')
        .eq('phone', phone)
        .maybeSingle()

      let customer
      if (existing) {
        const { data: updated, error } = await supabase
          .from('customers')
          .update({
            name: existing.name || name,
            device_token: deviceToken,
            last_login_at: now,
            login_count: (existing.login_count || 0) + 1,
            terms_accepted_at: existing.terms_accepted_at || now,
          })
          .eq('id', existing.id)
          .select('id, name, phone, marketing_consent, login_count, favorite_items')
          .single()
        if (error) {
          console.error('link-from-order update error:', error)
          return json({ error: 'שגיאה בשמירה' }, 500)
        }
        customer = updated
      } else {
        const { data: created, error } = await supabase
          .from('customers')
          .insert({
            phone,
            name,
            terms_accepted_at: now,
            marketing_consent: false,
            last_login_at: now,
            login_count: 1,
            device_token: deviceToken,
          })
          .select('id, name, phone, marketing_consent, login_count, favorite_items')
          .single()
        if (error) {
          console.error('link-from-order insert error:', error)
          return json({ error: 'שגיאה ביצירה' }, 500)
        }
        customer = created
      }

      return json({
        success: true,
        deviceToken,
        customer: {
          name: customer.name,
          phone: customer.phone,
          isReturning: !!existing,
          loginCount: customer.login_count,
          favoriteItems: customer.favorite_items ?? null,
        },
      })
    }

    // ─── Set favorite order: store the customer's "usual" order ───
    if (action === 'set-favorite') {
      const SetFavSchema = z.object({
        deviceToken: z.string().min(32).max(128),
        items: z.array(z.any()).max(50).nullable(),
      })
      const parsed = SetFavSchema.safeParse(body)
      if (!parsed.success) return json({ error: 'נתונים לא תקינים' }, 400)

      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('device_token', parsed.data.deviceToken)
        .maybeSingle()
      if (!customer) return json({ error: 'לא מורשה' }, 401)

      const { error } = await supabase
        .from('customers')
        .update({ favorite_items: parsed.data.items })
        .eq('id', customer.id)
      if (error) {
        console.error('set-favorite error:', error)
        return json({ error: 'שגיאה בשמירה' }, 500)
      }
      return json({ success: true })
    }

    // ─── Update name: change the logged-in customer's display name ───
    if (action === 'update-name') {
      const UpdateNameSchema = z.object({
        deviceToken: z.string().min(32).max(128),
        name: z.string().min(1).max(100),
      })
      const parsed = UpdateNameSchema.safeParse(body)
      if (!parsed.success) return json({ error: 'נתונים לא תקינים' }, 400)

      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('device_token', parsed.data.deviceToken)
        .maybeSingle()
      if (!customer) return json({ error: 'לא מורשה' }, 401)

      const { data: updated, error } = await supabase
        .from('customers')
        .update({ name: parsed.data.name.trim() })
        .eq('id', customer.id)
        .select('name, phone')
        .single()
      if (error) {
        console.error('update-name error:', error)
        return json({ error: 'שגיאה בעדכון השם' }, 500)
      }
      return json({ success: true, name: updated.name })
    }

    return json({ error: 'Invalid action' }, 400)
  } catch (err) {
    console.error('customer-auth error:', err)
    return json({ error: 'שגיאה פנימית' }, 500)
  }
})
