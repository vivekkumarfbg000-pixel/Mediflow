// Mediflow Connected Care Ecosystem v2.3 - PWA Service Worker
// Standard Stale-While-Revalidate static cache engine for 100% resilient offline clinical desks.

const CACHE_NAME = 'mediflow-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icons.svg',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap'
];

// 1. Install Event: Populate standard pre-cache buffers
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[PWA-SW] Pre-caching critical application shells...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// 2. Activate Event: Evict obsolete caches from local clients
self.addEventListener('activate', (event) => {
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
      return self.clients.claim();
    })
  );
});

// 3. Fetch Event: Intelligent Caching Strategy (Network-First for HTML, Stale-While-Revalidate for Assets)
self.addEventListener('fetch', (event) => {
  // Avoid intercepting direct remote API/Supabase calls or localhost hot reloading
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET' || url.pathname.includes('/api/v1') || url.pathname.includes('supabase')) {
    return;
  }

  const isNavigation = event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html';

  if (isNavigation) {
    // Network-First strategy for HTML/Navigation requests to ensure immediate updates to hashed bundles
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, cacheCopy);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Stale-While-Revalidate for other static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          // Defend against Vercel's SPA rewrites on missing files.
          // If a JS/CSS file is requested but returns text/html, do NOT cache or serve it!
          const contentType = networkResponse.headers.get('content-type') || '';
          const isAsset = url.pathname.includes('/assets/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css');
          if (isAsset && contentType.includes('text/html')) {
            console.warn(`[PWA-SW] Asset ${url.pathname} returned HTML instead of raw asset (Vercel SPA rewrite/404). Bypassing cache.`);
            return new Response('Asset not found', { status: 404, statusText: 'Not Found' });
          }

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

