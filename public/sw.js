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
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    tag,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || "/",
      order_number: data.order_number,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // If a window with our origin is open, focus it and navigate
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
