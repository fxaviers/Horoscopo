const CACHE_NAME = 'horoscopo-v3';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/api.js',
  './js/astronomy.js',
  './js/daily-extras.js',
  './js/moon-svg.js',
  './js/storage.js',
  './js/translator.js',
  './js/zodiac.js',
  './data/horoscopo.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        const urls = ASSETS.map((asset) => new URL(asset, self.registration.scope).href);
        await Promise.all(
          urls.map(async (url) => {
            const response = await fetch(new Request(url, { cache: 'reload' }));
            if (!response.ok) {
              throw new Error(`Failed to precache ${url}: ${response.status}`);
            }
            await cache.put(url, response);
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && !key.startsWith('promptcam-'))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/data/horoscopo.json')) {
    const normalizedUrl = new URL('./data/horoscopo.json', self.registration.scope).href;
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            event.waitUntil(cache.put(normalizedUrl, networkResponse.clone()).catch(() => {}));
            return networkResponse;
          }
          const cached = await cache.match(normalizedUrl);
          return cached || networkResponse;
        } catch {
          const cached = await cache.match(normalizedUrl);
          if (cached) return cached;
          return Response.error();
        }
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
          event.waitUntil(cache.put(request, networkResponse.clone()).catch(() => {}));
        }
        return networkResponse;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;

        if (request.mode === 'navigate') {
          const fallbackUrl = new URL('./index.html', self.registration.scope).href;
          const fallback = await cache.match(fallbackUrl);
          if (fallback) return fallback;
        }

        return Response.error();
      }
    })
  );
});
