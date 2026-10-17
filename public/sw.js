// Lets the game install as an app and open offline. Always tries the network first so
// players get new versions straight away; the cache is only a fallback.
const CACHE = 'omc-v3';
const VERSION = 3; // shown on test notifications, to check which version a phone runs

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./') : undefined) || Response.error()),
      ),
  );
});

// Daily reminders, sent by scripts/reminders.mjs: show them, and open the game on tap.
self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { body: e.data ? e.data.text() : '' };
  }
  const at = (path) => new URL(path, self.registration.scope).href;
  e.waitUntil(
    self.registration.showNotification(data.title || 'One More Crypt', {
      body: (data.body || 'A new crypt is open.') + (data.test ? ` (app v${VERSION})` : ''),
      icon: at('icons/icon-192.png'),
      badge: at('icons/badge-96.png'),
      tag: data.tag || 'daily',
      renotify: true,
      data: { url: data.url || './' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});
