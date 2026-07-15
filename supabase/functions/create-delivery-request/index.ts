// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_maps';
const ORIGIN_ADDRESS = 'דרך ערבי נחל 21, תושיה, ישראל';
const MULTIPLIER = 1.7;

function roundHalfDown(x: number): number {
  const floor = Math.floor(x);
  const frac = x - floor;
  return frac > 0.5 ? floor + 1 : floor;
}

// Server-side price computation — MUST mirror calculate-delivery-price.
// This is the trusted source of truth for delivery pricing.
async function computePrice(opts: {
  lat: number | null;
  lng: number | null;
  address: string;
}): Promise<
  | { ok: true; price: number; resolvedAddress: string; km: number; minutes: number }
  | { ok: false; status: number; error: string; message?: string }
> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
    return { ok: false, status: 500, error: 'missing_maps_credentials' };
  }

  const hasCoords =
    opts.lat !== null &&
    opts.lng !== null &&
    Number.isFinite(opts.lat) &&
    Number.isFinite(opts.lng);

  if (!hasCoords && opts.address.length < 5) {
    return { ok: false, status: 400, error: 'invalid_address' };
  }

  let resolvedAddress = opts.address;
  if (hasCoords) {
    try {
      const geoRes = await fetch(
        `${GATEWAY_URL}/maps/api/geocode/json?latlng=${opts.lat},${opts.lng}&language=he&region=IL`,
        {
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'X-Connection-Api-Key': GOOGLE_MAPS_API_KEY,
          },
        },
      );
      if (geoRes.ok) {
        const geo: any = await geoRes.json();
        resolvedAddress = geo?.results?.[0]?.formatted_address ?? `${opts.lat},${opts.lng}`;
      } else {
        resolvedAddress = `${opts.lat},${opts.lng}`;
      }
    } catch {
      resolvedAddress = `${opts.lat},${opts.lng}`;
    }
  }

  const destination = hasCoords
    ? { location: { latLng: { latitude: opts.lat, longitude: opts.lng } } }
    : { address: opts.address };

  const routesRes = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': GOOGLE_MAPS_API_KEY,
      'Content-Type': 'application/json',
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
    },
    body: JSON.stringify({
      origin: { address: ORIGIN_ADDRESS },
      destination,
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      languageCode: 'he',
      regionCode: 'IL',
    }),
  });

  if (!routesRes.ok) {
    return { ok: false, status: routesRes.status, error: 'routes_failed' };
  }

  const data: any = await routesRes.json();
  const route = data?.routes?.[0];
  if (!route) return { ok: false, status: 404, error: 'no_route' };

  const distanceMeters: number = route.distanceMeters ?? 0;
  const durationStr: string = route.duration ?? '0s';
  const durationSec = parseInt(String(durationStr).replace('s', ''), 10) || 0;

  const km = distanceMeters / 1000;
  const minutes = durationSec / 60;

  if (minutes > 25) {
    return {
      ok: false,
      status: 400,
      error: 'out_of_range',
      message: 'לצערנו איננו מגיעים לאזור זה.',
    };
  }

  const raw = (minutes + km) * MULTIPLIER;
  const price = roundHalfDown(raw);
  return { ok: true, price, resolvedAddress, km, minutes };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Rate limit by IP: 10 delivery requests / 10 minutes per IP.
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_action: 'delivery_request_create',
      p_key: ip,
      p_max_attempts: 10,
      p_window: '10 minutes',
    });
    if (allowed === false) {
      return new Response(
        JSON.stringify({ error: 'rate_limited', message: 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    await supabase.rpc('record_rate_limit_attempt', {
      p_action: 'delivery_request_create',
      p_key: ip,
      p_ip_address: ip,
    });

    const body = await req.json().catch(() => ({}));

    // Basic validation
    const customer_name = String(body?.customer_name ?? '').trim();
    const customer_phone = String(body?.customer_phone ?? '').trim();
    const address = String(body?.address ?? '').trim();
    const zone_id: string | null = body?.zone_id ?? null;
    const zone_name = String(body?.zone_name ?? '').trim() || null;
    const latIn = body?.lat != null ? Number(body.lat) : null;
    const lngIn = body?.lng != null ? Number(body.lng) : null;

    if (customer_name.length < 1 || customer_name.length > 100) {
      return new Response(JSON.stringify({ error: 'invalid_name' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (customer_phone.length < 6 || customer_phone.length > 20) {
      return new Response(JSON.stringify({ error: 'invalid_phone' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (address.length < 3 || address.length > 300) {
      return new Response(JSON.stringify({ error: 'invalid_address' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Server-side price computation — client price is IGNORED.
    const priced = await computePrice({
      lat: latIn !== null && Number.isFinite(latIn) ? latIn : null,
      lng: lngIn !== null && Number.isFinite(lngIn) ? lngIn : null,
      address,
    });
    if (!priced.ok) {
      return new Response(JSON.stringify({ error: priced.error, message: priced.message }), {
        status: priced.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabase
      .from('delivery_requests')
      .insert({
        customer_name,
        customer_phone,
        address,
        zone_id,
        zone_name,
        price: priced.price,
        payout: priced.price,
        lat: latIn !== null && Number.isFinite(latIn) ? latIn : null,
        lng: lngIn !== null && Number.isFinite(lngIn) ? lngIn : null,
        status: 'pending',
      })
      .select('id, client_token, price')
      .single();

    if (error || !data) {
      console.error('create-delivery-request insert failed', error);
      return new Response(JSON.stringify({ error: 'insert_failed', details: error?.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('create-delivery-request error', e);
    return new Response(JSON.stringify({ error: 'server_error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
