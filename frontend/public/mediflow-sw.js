// mediflow-sw.js — Mediflow Service Worker v13.0
// Offline-First Cache Agent for ServiceWorkerCacheAgent class

const CACHE_NAME = 'mediflow-v13';
const STATIC_ASSETS = ['/', '/index.html'];

// Install: Pre-cache critical shell assets
self.addEventListener('install', (event) => {
  console.log('[mediflow-sw] Installing v13.0 cache...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch((err) =>
        console.warn('[mediflow-sw] Pre-cache partial failure (non-critical):', err)
      )
    )
  );
});

// Activate: Clean up stale caches and claim all clients
self.addEventListener('activate', (event) => {
  console.log('[mediflow-sw] Activating — cleaning stale caches...');
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for API/HTML, Cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // Skip live API calls — never cache Supabase, WABA, Cashfree
  const isApiCall =
    url.hostname.includes('supabase') ||
    url.hostname.includes('graph.facebook') ||
    url.hostname.includes('cashfree') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/rest/');
  if (isApiCall) return;

  // Cache-first for static JS/CSS/image/font assets
  const isStaticAsset = /\.(js|css|woff2?|ttf|svg|png|jpg|jpeg|webp|ico)$/.test(url.pathname);
  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first with offline fallback for HTML navigation
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match('/index.html').then((cached) => {
          if (cached) return cached;
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Mediflow - Offline</title>' +
            '<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#e2e8f0;}' +
            '.box{text-align:center;padding:2rem;border-radius:1rem;background:#1e293b;}h1{color:#38bdf8;margin:0 0 1rem;}' +
            'button{margin-top:1rem;padding:.75rem 2rem;background:#38bdf8;color:#0f172a;border:none;border-radius:.5rem;font-size:1rem;cursor:pointer;}</style></head>' +
            '<body><div class="box"><h1>Mediflow is Offline</h1>' +
            '<p>Please reconnect. Your data is safe and will sync automatically.</p>' +
            '<button onclick="window.location.reload()">Try Again</button></div></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
      )
  );
});

// Message: Handle SKIP_WAITING from ServiceWorkerCacheAgent.activateUpdate()
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[mediflow-sw] SKIP_WAITING received — activating new SW immediately');
    self.skipWaiting();
  }
});
