/**
 * Nexus Map service worker.
 *
 * Strategies, kept deliberately separate:
 *   APP SHELL      cache-first with a versioned cache
 *   MAP TILES      cache-first, served from the offline-region cache
 *   SEARCH (GET)   network-first while online, cached copy when offline
 *   MUTATIONS      network only, never cached, never intercepted
 *
 * Nothing that isn't a successful (2xx, non-opaque) response is ever cached.
 */

// v8: v7 served HTML navigations cache-first, which pinned stale markup to
// build-hashed /_next/static chunk URLs. Once a rebuild changed those hashes
// the cached HTML asked for scripts that no longer existed, and every page
// rendered blank. Bumping the name drops those poisoned entries on activate.
const APP_CACHE = "nexus-map-app-v8";
const TILE_CACHE = "nexus-map-offline-tiles-v1";
const API_CACHE = "nexus-map-api-v1";

const APP_SHELL = ["/", "/manifest.webmanifest", "/pwa-icon.svg", "/favicon.svg"];
const SYNC_TAG = "nexus-sync-queue";

// Caches kept across activations; anything else is a stale version.
const KEEP = [APP_CACHE, TILE_CACHE, API_CACHE];

/** GET API paths worth serving from cache when offline. */
const CACHEABLE_API = [/\/api\/navigation\/search/, /\/api\/road-alerts/, /\/api\/places/];

/** Never cached, at any time: liveness probes and anything auth-related. */
const NEVER_CACHE = [/\/health/, /\/api\/auth/, /\/auth\/v1\//, /\/api\/ai\//];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) =>
      // addAll fails the whole install if one asset 404s, so add resiliently.
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !KEEP.includes(key)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

/** A response worth storing: a real, complete, successful same-origin-ish reply. */
function isCacheable(response) {
  return Boolean(response) && response.status === 200 && response.type !== "opaque";
}

/**
 * Caches a response copy. The clone MUST be created by the caller
 * synchronously, before the original is returned, or its body is already used.
 */
function putInCache(cacheName, request, responseClone) {
  return caches
    .open(cacheName)
    .then((cache) => cache.put(request, responseClone))
    .catch(() => {
      /* quota / eviction — non-fatal */
    });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // API mutations: network only. Never intercepted, never cached, never queued
  // here — the app queues writes itself, where it has the auth context.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (NEVER_CACHE.some((pattern) => pattern.test(url.pathname))) return;

  const isTile = url.hostname === "tile.openstreetmap.org" && url.pathname.endsWith(".png");
  const isApi = CACHEABLE_API.some((pattern) => pattern.test(url.pathname));

  // Cross-origin requests that are neither tiles nor cacheable API calls go
  // straight to the network, so the worker can never serve a stale error for
  // Supabase, analytics or the tile proxy.
  if (!isTile && !isApi && url.origin !== self.location.origin) return;

  // --- MAP TILES: cache-first (this is what makes a downloaded region work) ---
  if (isTile) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request, { cacheName: TILE_CACHE });
        if (cached) return cached;

        try {
          const response = await fetch(request);
          if (isCacheable(response)) {
            event.waitUntil(putInCache(TILE_CACHE, request, response.clone()));
          }
          return response;
        } catch {
          // Offline and not downloaded: report it as a miss rather than
          // pretending the tile exists.
          return new Response("", { status: 504, statusText: "Tile not available offline" });
        }
      })(),
    );
    return;
  }

  // --- SEARCH / read APIs: network-first, cached copy as the offline fallback ---
  if (isApi) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (isCacheable(response)) {
            event.waitUntil(putInCache(API_CACHE, request, response.clone()));
          }
          // Error responses (4xx/5xx) are passed through UNCACHED.
          return response;
        } catch {
          const cached = await caches.match(request, { cacheName: API_CACHE });
          if (cached) return cached;
          return new Response(
            JSON.stringify({ success: false, message: "You are offline and this data is not saved for offline use." }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }
      })(),
    );
    return;
  }

  // --- HTML NAVIGATIONS: network-first ---------------------------------
  // Markup must never come from cache while the network is reachable. The
  // HTML embeds build-hashed script URLs, so a cached copy outlives exactly
  // one rebuild before pointing at chunks that 404 — a blank page, and one
  // that survives a normal reload because the SW answers before the network.
  // Falling back to cache only on a genuine fetch failure keeps offline
  // navigation working, which is the reason the shell is cached at all.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (isCacheable(response)) {
            event.waitUntil(putInCache(APP_CACHE, request, response.clone()));
          }
          return response;
        } catch {
          const cached = await caches.match(request, { cacheName: APP_CACHE });
          if (cached) return cached;
          const shell = await caches.match("/", { cacheName: APP_CACHE });
          if (shell) return shell;
          return new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  // --- APP SHELL / assets: cache-first, refreshed in the background ---
  // Safe here because everything reaching this branch is either a static asset
  // with a content hash in its name or an icon that changes rarely.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { cacheName: APP_CACHE });

      const fromNetwork = fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            event.waitUntil(putInCache(APP_CACHE, request, response.clone()));
          }
          return response;
        })
        .catch(async () => {
          if (cached) return cached;
          if (request.mode === "navigate") {
            const shell = await caches.match("/", { cacheName: APP_CACHE });
            if (shell) return shell;
          }
          return new Response("Offline", { status: 503 });
        });

      // Serve the cached shell immediately when we have it; the network copy
      // refreshes the cache for next time.
      if (cached) {
        event.waitUntil(fromNetwork.catch(() => undefined));
        return cached;
      }
      return fromNetwork;
    })(),
  );
});

// Background Sync: when connectivity returns, ask any open client to flush the
// offline write-queue (the client holds the auth token and API logic).
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(notifyClients({ type: "nexus-sync-queue" }));
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "nexus-skip-waiting") self.skipWaiting();
});

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  for (const client of clients) client.postMessage(message);
}
