// Service Worker for Push Notifications — habakta order tracking
// Minimal scope: push events only. No caching (avoids stale content issues).

const SHOWN_TAGS = new Set();

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "הבקתה", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "הבקתה";
  const tag = data.tag || `order-${data.order_number || Date.now()}`;

  // Dedup — same tag within session won't show twice
  if (SHOWN_TAGS.has(tag)) return;
  SHOWN_TAGS.add(tag);
  setTimeout(() => SHOWN_TAGS.delete(tag), 60_000);

  const options = {
    body: data.body || "ההזמנה שלך מוכנה!",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/icon-96.png",
    image: data.image,
    tag,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    actions: Array.isArray(data.actions) ? data.actions : [],
    data: {
      url: data.url || "/",
      waze_url: data.waze_url,
      track_url: data.track_url,
      on_way_url: data.on_way_url,
      order_number: data.order_number,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  let targetUrl = d.url || "/";
  if (event.action === "waze" && d.waze_url) targetUrl = d.waze_url;
  else if (event.action === "track" && d.track_url) targetUrl = d.track_url;
  else if (event.action === "on_way" && d.on_way_url) targetUrl = d.on_way_url;

  const isExternal = /^https?:\/\//i.test(targetUrl) && !targetUrl.startsWith(self.location.origin);

  event.waitUntil(
    (async () => {
      if (isExternal) {
        await self.clients.openWindow(targetUrl);
        return;
      }
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        try {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(targetUrl);
          }
          return;
        } catch (_) { /* fallthrough */ }
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});
