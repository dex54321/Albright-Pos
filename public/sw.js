// Minimal service worker. Android Chrome requires a registered service
// worker with a fetch handler before it will offer a real "Install app"
// prompt (a plain manifest alone only gets you a browser shortcut).
//
// This deliberately does NOT cache anything: a POS app must always see
// live stock, prices and balances, so every request just goes straight
// to the network as normal. This file exists purely to satisfy Chrome's
// installability check, not to add offline support.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
