// service-worker.js — Billiga Pizzor PWA
// Versioned caching with three strategies:
//   - Navigation (HTML): network-first, cache fallback
//   - JSON data:          network-first so coordinates/prices are always fresh
//   - Static assets:      cache-first, network fallback

const CACHE_VERSION = 'v13';
const STATIC_CACHE  = `billigapizzor-static-${CACHE_VERSION}`;
const DATA_CACHE    = `billigapizzor-data-${CACHE_VERSION}`;

// Assets to precache on install so the app works offline immediately.
const PRECACHE_ASSETS = [
    '/',
    '/pizzerior',
    '/om-oss',
    '/integritetspolicy',
    '/css/index.css',
    '/css/om-oss.css',
    '/js/script.js',
    '/manifest.json',
    '/images/Billiga_Pizzor_Logo.svg',
    '/images/Billiga_Pizzor_banner.png',
    '/images/android-chrome-192x192.png',
    '/images/android-chrome-512x512.png',
    '/images/favicon.ico',
    '/images/favicon-32x32.png',
];

const DATA_PATHS = ['/data/'];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(STATIC_CACHE)
            .then(async (cache) => {
                // Local dev can return 404 for pretty routes like /faq.
                // Cache each asset individually so one failed request does not abort install.
                await Promise.all(
                    PRECACHE_ASSETS.map(async (url) => {
                        try {
                            const response = await fetch(url, { cache: 'no-cache' });
                            if (response && response.ok) {
                                await cache.put(url, response.clone());
                            }
                        } catch {
                            // Ignore single-asset failures during install (common in local dev).
                        }
                    })
                );
            })
            .then(() => self.skipWaiting())
    );
});

// ─── Activate ───────────────────────────────────────────────────────────────
// Remove caches from previous versions so stale assets don't persist.
self.addEventListener('activate', (event) => {
    const validCaches = new Set([STATIC_CACHE, DATA_CACHE]);

    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((key) => !validCaches.has(key))
                        .map((key) => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
    );
});

// ─── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only handle GET requests from the same origin.
    if (request.method !== 'GET') return;
    if (!request.url.startsWith(self.location.origin)) return;

    const pathname = new URL(request.url).pathname;

    // JSON data → network-first so coordinates and prices are always current.
    if (DATA_PATHS.some((p) => pathname.startsWith(p))) {
        event.respondWith(networkFirst(request, DATA_CACHE));
        return;
    }

    // HTML navigation → network-first so users always get the latest page.
    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request, STATIC_CACHE));
        return;
    }

    // JS/CSS should prefer network to avoid stale logic/styles lingering.
    if (pathname.endsWith('.js') || pathname.endsWith('.css')) {
        event.respondWith(networkFirst(request, STATIC_CACHE));
        return;
    }

    // Images / manifest / other static assets → cache-first for instant loads.
    event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// ─── Strategies ─────────────────────────────────────────────────────────────

/**
 * Cache-first: serve from cache if available, otherwise fetch and cache.
 * Best for versioned/fingerprinted static assets.
 */
async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return offlineAssetResponse();
    }
}

/**
 * Network-first: try the network, fall back to cache.
 * Best for HTML pages where freshness matters.
 */
async function networkFirst(request, cacheName) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;

        // Last resort: serve the cached root as an offline shell.
        const root = await caches.match('/');
        if (root) return root;

        return offlinePageResponse();
    }
}

/**
 * Stale-while-revalidate: serve from cache immediately, update in background.
 * Best for data that benefits from speed but also needs to stay current.
 */
async function staleWhileRevalidate(request, cacheName) {
    const cache  = await caches.open(cacheName);
    const cached = await cache.match(request);

    // Kick off a background network request regardless of cache hit.
    const networkPromise = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
    });

    // Serve cached version instantly if available; otherwise wait for network.
    return cached ?? networkPromise;
}

// ─── Offline fallbacks ──────────────────────────────────────────────────────

function offlinePageResponse() {
    const html = `<!doctype html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Offline – Billiga Pizzor</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#121212;color:#e0e0e0;
         display:flex;flex-direction:column;align-items:center;justify-content:center;
         min-height:100vh;margin:0;padding:24px;text-align:center}
    h1{font-size:2rem;margin-bottom:12px}
    p{color:#aaa;max-width:360px;line-height:1.6}
    a{color:#1f7a4c;text-decoration:none;font-weight:700}
  </style>
</head>
<body>
  <h1>🍕 Du är offline</h1>
  <p>Kontrollera din internetanslutning och försök igen.</p>
  <p><a href="/">Tillbaka till startsidan</a></p>
</body>
</html>`;

    return new Response(html, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}

function offlineAssetResponse() {
    return new Response('', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
    });
}
