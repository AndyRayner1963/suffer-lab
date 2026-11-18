// Service worker: keeps every file of the page as one versioned set, so the page opens with no
// connection.  A new version installs in the background; the page offers it with a bar at the top.
// Requests to api.github.com are never touched here: the data has its own store (js/gh.js).
const VERSION = "1.0.3";
const CACHE = 'sufferlab-app-' + VERSION;
const FILES = ["./", "app.css", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "index.html", "js/chart.js", "js/fitness.js", "js/gh.js", "js/gym.js", "js/hist.js", "js/list.js", "js/phone.js", "js/plot.js", "js/power.js", "js/records.js", "js/ride.js", "js/summary.js", "js/util.js", "js/weeks.js", "manifest.webmanifest", "phone.css", "version.js"];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('sufferlab-app-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      const page = await cache.match('index.html');
      if (page) return page;
    }
    return (await cache.match(req, { ignoreSearch: true })) || fetch(req);
  })());
});
