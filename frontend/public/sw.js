// Mediflow Connected Care Ecosystem v2.3 - PWA Service Worker
// Standard Stale-While-Revalidate static cache engine for 100% resilient offline clinical desks.

const CACHE_NAME = 'mediflow-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/index.css'
];

// 1. Install Event: Populate standard pre-cache buffers
self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[PWA-SW] Pre-caching critical application shells...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      return (self as any).skipWaiting();
    })
  );
});

// 2. Activate Event: Evict obsolete caches from local clients
self.addEventListener('activate', (event: any) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[PWA-SW] Evicting legacy pre-cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return (self as any).clients.claim();
    })
  );
});

// 3. Fetch Event: Stale-While-Revalidate caching pipeline
self.addEventListener('fetch', (event: any) => {
  // Avoid intercepting direct remote API/Supabase calls or localhost hot reloading
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET' || url.pathname.includes('/api/v1') || url.pathname.includes('supabase')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cacheCopy);
          });
        }
        return networkResponse;
      }).catch((err) => {
        console.warn('[PWA-SW] Outbound request failed, returning stale cache fallback.', err);
      });

      return cachedResponse || fetchPromise;
    })
  );
});
