// SELF-DESTRUCT VERSION.
// The previous service worker caused styling to break on some pages, so
// this version's only job is to clean itself up: clear anything it may
// have cached, unregister itself, and reload any open tabs so the site
// goes back to loading normally with no service worker involved at all.
// It intentionally has NO fetch handler, so it never intercepts anything.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clientsList = await self.clients.matchAll({ type: "window" });
      for (const client of clientsList) client.navigate(client.url);
    })()
  );
});
