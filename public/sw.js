// Energy-Compliance Hub — Service Worker v3.2
// Strategy:
//   - /api/sensors/simulation   → PASS-THROUGH (no cache, control endpoint)
//   - /api/subscription/status  → PASS-THROUGH (no cache, volatile state)
//   - /api/auth/                → PASS-THROUGH (no cache, auth endpoints)
//   - /api/sensors/*            → Network Only + Last Cache (offline fallback for sensor data)
//   - /api/permits/*            → Network Only + Last Cache (real-time permit data)
//   - /api/*                    → Stale-While-Revalidate (offline data for docs, etc.)
//   - Scripts / _next/*         → Network First (always latest code)
//   - Images / Fonts            → Cache First (safe to cache long-term)
//   - HTML pages                → Network First (App Shell)

const CACHE_VERSION = 'ech-v3.2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const APP_SHELL_CACHE = `${CACHE_VERSION}-appshell`;
const SENSOR_CACHE = `${CACHE_VERSION}-sensors`;

// App Shell resources to pre-cache (Cache First)
const APP_SHELL_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// HTTP methods that can be cached (Cache API only supports GET)
const CACHEABLE_METHODS = ['GET', 'HEAD'];

// ═══════════════════════════════════════════════════════════════
// CONTROL ENDPOINTS — These return volatile state that must
// NEVER be cached. They control toggles, status flags, etc.
// If cached, the UI shows stale state (e.g., demo mode ON).
// ═══════════════════════════════════════════════════════════════
const NO_CACHE_PATHS = [
  '/api/sensors/simulation',   // Demo mode toggle state
  '/api/subscription/status',  // Trial/subscription state
  '/api/auth/',                // Authentication endpoints
];

function shouldNeverCache(url) {
  return NO_CACHE_PATHS.some(path => url.pathname.startsWith(path));
}

// Install — pre-cache App Shell and activate immediately
self.addEventListener('install', (event) => {
  console.log('[SW v3.2] Installing Service Worker...');

  // Skip waiting to force new version immediately
  self.skipWaiting();

  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => {
      console.log('[SW v3.2] Pre-caching App Shell');
      return cache.addAll(APP_SHELL_URLS).catch((err) => {
        console.warn('[SW v3.2] Some App Shell resources failed to cache:', err);
        return Promise.resolve();
      });
    })
  );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW v3.2] Activating Service Worker...');

  // Take control of all clients immediately
  event.waitUntil(
    self.clients.claim().then(() => {
      // Clean old caches
      return caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('ech-') && !name.includes(CACHE_VERSION))
            .map((name) => {
              console.log('[SW v3.1] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      });
    })
  );
});

// Fetch — route-based strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Never cache non-GET methods (POST, PUT, DELETE, etc.)
  if (!CACHEABLE_METHODS.includes(request.method)) {
    return; // Let the browser handle it normally
  }

  // ════════════════════════════════════════════════════════════
  // CONTROL ENDPOINTS: Never cache, always pass-through
  // These return volatile state (demo mode, subscription, auth)
  // that would cause stale UI if served from cache.
  // ════════════════════════════════════════════════════════════
  if (shouldNeverCache(url)) {
    return; // Let the browser handle it normally — no SW interception
  }

  // Strategy: Network Only for sensor routes (safety-critical)
  // Caches last known sensor data for offline viewing
  if (url.pathname.startsWith('/api/sensors')) {
    event.respondWith(networkOnlyWithLastCache(request, SENSOR_CACHE));
    return;
  }

  // Strategy: Network Only for permit routes (real-time permit data)
  // Caches last known permit data for offline viewing
  if (url.pathname.startsWith('/api/permits')) {
    event.respondWith(networkOnlyWithLastCache(request, SENSOR_CACHE));
    return;
  }

  // Strategy: Stale-While-Revalidate for GET API routes only
  // Serves cached data immediately, updates in background
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // Strategy: Network First for scripts and Next.js bundles (always get latest code)
  if (
    request.destination === 'script' ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // Strategy: Cache First for images and fonts (safe to cache long-term)
  if (
    request.destination === 'image' ||
    request.destination === 'style' ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff')
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Strategy: Network First for HTML pages (App Shell)
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request, APP_SHELL_CACHE));
    return;
  }

  // Default: Network First
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// === Caching Strategies ===

// Cache First: Serve from cache, fallback to network (GET only)
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network First: Try network, fallback to cache (GET only)
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    if (request.mode === 'navigate') {
      return new Response(offlinePage(), {
        headers: { 'Content-Type': 'text/html' },
      });
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network Only with last cache: For sensor data (safety-critical)
async function networkOnlyWithLastCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('X-Offline-Data', 'true');
      headers.set('X-Offline-Warning', 'Offline - cached data');

      const body = await cached.blob();
      return new Response(body, {
        status: 200,
        statusText: 'OK (Offline Cache)',
        headers,
      });
    }

    return new Response(
      JSON.stringify({
        error: 'Sin conexion',
        message: 'Datos del sensor no disponibles sin conexion a internet',
        offline: true,
      }),
      {
        status: 503,
        statusText: 'Sin Conexion',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Stale-While-Revalidate: Serve cache immediately, update in background (GET only)
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Always try to update in background
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => {
      // Must always return a Response — never undefined
      if (cached) return cached;
      return new Response(JSON.stringify({ error: 'offline', offline: true }), {
        status: 503,
        statusText: 'Sin Conexion',
        headers: { 'Content-Type': 'application/json' },
      });
    });

  // Return cached if available, otherwise wait for fetch
  if (cached) return cached;
  return fetchPromise;
}

// Simple offline page HTML
function offlinePage() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sin Conexion — Energy-Compliance Hub</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1rem;
    }
    .container { text-align: center; max-width: 400px; }
    .icon {
      width: 80px; height: 80px; margin: 0 auto 1.5rem;
      background: rgba(239, 68, 68, 0.15); border-radius: 50%;
      display: flex; align-items: center; justify-content: center; font-size: 2rem;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #f1f5f9; }
    p { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; margin-bottom: 1rem; }
    .badge {
      display: inline-block; background: rgba(245, 158, 11, 0.15); color: #f59e0b;
      padding: 0.5rem 1rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; margin-top: 1rem;
    }
    .retry-btn {
      margin-top: 1.5rem; padding: 0.75rem 2rem; background: #059669; color: white;
      border: none; border-radius: 0.5rem; font-size: 0.9rem; cursor: pointer; font-weight: 600;
    }
    .retry-btn:hover { background: #047857; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📡</div>
    <h1>Sin Conexion a Internet</h1>
    <p>No hay conexion disponible en este momento. Los datos que ingresaste se guardaran localmente y se sincronizaran automaticamente al recuperar la señal.</p>
    <div class="badge">Modo Offline Activo</div>
    <br>
    <button class="retry-btn" onclick="window.location.reload()">Reintentar Conexion</button>
  </div>
</body>
</html>`;
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_SENSOR_CACHE') {
    caches.delete(SENSOR_CACHE).then(() => {
      console.log('[SW v3.1] Sensor cache cleared');
    });
  }
});

// Background Sync
self.addEventListener('sync', (event) => {
  console.log('[SW v3.1] Background sync triggered:', event.tag);

  if (event.tag === 'sync-offline-data') {
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_STARTED' });
  });
  console.log('[SW v3.1] Offline data sync initiated');
}
