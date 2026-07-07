// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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
    console.log('calculate-delivery-price body:', rawBody);

    const address = String(body?.address ?? '').trim();
    const latNum = Number(body?.lat);
    const lngNum = Number(body?.lng);
    const hasCoords = Number.isFinite(latNum) && Number.isFinite(lngNum);
    const lat = hasCoords ? latNum : null;
    const lng = hasCoords ? lngNum : null;
    if (!hasCoords && address.length < 5) {
      console.error('invalid_address, parsed body:', body);
      return new Response(JSON.stringify({ error: 'invalid_address', received: body }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If we got coords, reverse-geocode so we can echo a human-readable address
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
      return new Response(JSON.stringify({ error: 'routes_failed', status: routesRes.status, details }), {
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
    const durationStr: string = route.duration ?? '0s'; // e.g. "1234s"
    const durationSec = parseInt(String(durationStr).replace('s', ''), 10) || 0;

    const km = distanceMeters / 1000;
    const minutes = durationSec / 60;
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
    return new Response(JSON.stringify({ error: 'server_error', details: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
