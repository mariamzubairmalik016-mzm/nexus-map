// Bumped so the old (broken) worker is replaced and its cache is cleaned up.
const APP_CACHE = "nexus-map-app-v4";
const TILE_CACHE = "nexus-map-offline-tiles-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/pwa-icon.svg", "/favicon.svg"];
const SYNC_TAG = "nexus-sync-queue";

// Caches we keep across activations; anything else is stale and removed.
const KEEP = [APP_CACHE, TILE_CACHE];

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
      await Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Safely cache a response copy. The clone MUST be created by the caller
// (synchronously, before the original is returned/consumed).
function putInCache(cacheName, request, responseClone) {
  return caches
    .open(cacheName)
    .then((cache) => cache.put(request, responseClone))
    .catch(() => {
      /* quota / opaque / eviction — non-fatal */
    });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Never cache or intercept non-GET requests (rule 7).
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isTile = url.hostname === "tile.openstreetmap.org" && url.pathname.endsWith(".png");

  // --- Map tiles: cache-first ---
  if (isTile) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(TILE_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const networkResponse = await fetch(request);
          // Clone immediately, before returning, and only cache OK responses.
          if (networkResponse.ok) {
            event.waitUntil(putInCache(TILE_CACHE, request, networkResponse.clone()));
          }
          return networkResponse;
        } catch {
          return new Response("", { status: 503 });
        }
      })(),
    );
    return;
  }

  // --- Everything else (same-origin app shell / assets): network-first ---
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Clone SYNCHRONOUSLY here, before returning the original — otherwise the
        // browser consumes the body before the async cache.put clones it.
        if (networkResponse.ok && url.origin === self.location.origin) {
          event.waitUntil(putInCache(APP_CACHE, request, networkResponse.clone()));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const shell = await caches.match("/index.html");
          if (shell) return shell;
        }
        return new Response("Offline", { status: 503 });
      }),
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
