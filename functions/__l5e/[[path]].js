// Images uploaded through Lovable live on Lovable's asset storage at /__l5e/...
// and are referenced by src/**/*.asset.json. Since the site moved to Cloudflare
// Pages, that path no longer exists here, so we fetch it from the Lovable copy
// of the site and let Cloudflare cache it (the files never change: the id is
// in the path).
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;
  const upstream = await fetch(`https://habikta-burger.lovable.app${url.pathname}`, { cf: { cacheEverything: true, cacheTtl: 31536000 } });
  if (!upstream.ok) return new Response("not found", { status: upstream.status });
  const res = new Response(upstream.body, upstream);
  res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  await cache.put(request, res.clone());
  return res;
}
