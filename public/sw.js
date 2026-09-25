/* Cache only this public, data-free fallback. Never store workspace HTML,
   authentication callbacks, API responses, receipts, or signed URLs. */
const OFFLINE_CACHE = 'ouranos-offline-fallback-v1';
const OFFLINE_URL = '/offline.html';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then(cache => cache.add(new Request(OFFLINE_URL, {cache: 'reload'}))));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('ouranos-offline-fallback-') && key !== OFFLINE_CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(async () => {
    const cache = await caches.open(OFFLINE_CACHE);
    return await cache.match(OFFLINE_URL) || new Response('Ouranos is offline. Reconnect and reload to continue.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
  }));
});
