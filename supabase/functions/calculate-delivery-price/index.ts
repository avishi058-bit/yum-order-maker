// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_maps';
const ORIGIN_ADDRESS = 'דרך ערבי נחל 21, תושיה, ישראל';
const MULTIPLIER = 1.7;

// Round with 0.5 going DOWN. e.g. 12.5 -> 12, 12.51 -> 13, 12.49 -> 12
function roundHalfDown(x: number): number {
  const floor = Math.floor(x);
  const frac = x - floor;
  return frac > 0.5 ? floor + 1 : floor;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Rate limit by IP: 30 requests / 10 minutes.
    // Prevents abuse of the paid Google Maps API.
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_action: 'delivery_price',
      p_key: ip,
      p_max_attempts: 30,
      p_window: '10 minutes',
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: 'rate_limited', message: 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    await supabase.rpc('record_rate_limit_attempt', {
      p_action: 'delivery_price',
      p_key: ip,
      p_ip_address: ip,
    });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing Google Maps credentials' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.text();
    let body: any = {};
    try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { body = {}; }

    const address = String(body?.address ?? '').trim();
    const latNum = Number(body?.lat);
    const lngNum = Number(body?.lng);
    const hasCoords = Number.isFinite(latNum) && Number.isFinite(lngNum);
    const lat = hasCoords ? latNum : null;
    const lng = hasCoords ? lngNum : null;
    if (!hasCoords && address.length < 5) {
      return new Response(JSON.stringify({ error: 'invalid_address' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let resolvedAddress = address;
    if (hasCoords) {
      try {
        const geoRes = await fetch(
          `${GATEWAY_URL}/maps/api/geocode/json?latlng=${lat},${lng}&language=he&region=IL`,
          { headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'X-Connection-Api-Key': GOOGLE_MAPS_API_KEY } },
        );
        if (geoRes.ok) {
          const geo: any = await geoRes.json();
          resolvedAddress = geo?.results?.[0]?.formatted_address ?? `${lat},${lng}`;
        } else {
          resolvedAddress = `${lat},${lng}`;
        }
      } catch { resolvedAddress = `${lat},${lng}`; }
    }

    const destination = hasCoords
      ? { location: { latLng: { latitude: lat, longitude: lng } } }
      : { address };

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
      const details = await routesRes.text();
      console.error('Routes API failed', routesRes.status, details);
      return new Response(JSON.stringify({ error: 'routes_failed', status: routesRes.status }), {
        status: routesRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data: any = await routesRes.json();
    const route = data?.routes?.[0];
    if (!route) {
      return new Response(JSON.stringify({ error: 'no_route' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const distanceMeters: number = route.distanceMeters ?? 0;
    const durationStr: string = route.duration ?? '0s';
    const durationSec = parseInt(String(durationStr).replace('s', ''), 10) || 0;

    const km = distanceMeters / 1000;
    const minutes = durationSec / 60;

    if (minutes > 25) {
      return new Response(JSON.stringify({
        error: 'out_of_range',
        message: 'לצערנו איננו מגיעים לאזור זה. אנחנו מבצעים משלוחים עד 25 דקות נסיעה בלבד.',
        minutes: Math.round(minutes),
        km: Math.round(km * 10) / 10,
        address: resolvedAddress,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const raw = (minutes + km) * MULTIPLIER;
    const price = roundHalfDown(raw);

    return new Response(JSON.stringify({
      price,
      km: Math.round(km * 10) / 10,
      minutes: Math.round(minutes),
      raw: Math.round(raw * 100) / 100,
      address: resolvedAddress,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('calculate-delivery-price error', e);
    return new Response(JSON.stringify({ error: 'server_error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
