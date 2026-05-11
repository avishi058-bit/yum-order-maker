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

// --- Schemas ---
const RegisterSchema = z.object({
  phone: z.string().min(9).max(15),
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

    // ─── Register: after OTP verified, save customer + return token ───
    if (action === 'register') {
      const parsed = RegisterSchema.safeParse(body)
      if (!parsed.success) return json({ error: 'נתונים לא תקינים' }, 400)

      const { phone, name, termsAccepted, marketingConsent } = parsed.data
      const deviceToken = generateToken()
      const now = new Date().toISOString()

      const { data: customer, error } = await supabase
        .from('customers')
        .upsert({
          phone,
          name,
          terms_accepted_at: now,
          marketing_consent: marketingConsent,
          marketing_consent_at: marketingConsent ? now : null,
          last_login_at: now,
          login_count: 1,
          device_token: deviceToken,
        }, { onConflict: 'phone' })
        .select('id, name, phone, marketing_consent, login_count')
        .single()

      if (error) {
        console.error('Register error:', error)
        return json({ error: 'שגיאה ברישום' }, 500)
      }

      return json({
        success: true,
        deviceToken,
        customer: {
          name: customer.name,
          phone: customer.phone,
          isReturning: false,
          loginCount: customer.login_count,
        },
      })
    }

    // ─── Auto-login: validate device token ───
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
      const phone = z.string().min(9).max(15).safeParse(body.phone)
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
      const phone = z.string().min(9).max(15).safeParse(body.phone)
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
        phone: z.string().min(9).max(15),
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
        .select('id, name, phone, marketing_consent, login_count, terms_accepted_at')
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
          .select('id, name, phone, marketing_consent, login_count')
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
          .select('id, name, phone, marketing_consent, login_count')
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

    return json({ error: 'Invalid action' }, 400)
  } catch (err) {
    console.error('customer-auth error:', err)
    return json({ error: 'שגיאה פנימית' }, 500)
  }
})
