const APP_CACHE = "nexus-map-app-v3";
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

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET") return;

  const isTile = url.hostname === "tile.openstreetmap.org" && url.pathname.endsWith(".png");

  if (isTile) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          return new Response("", { status: 503 });
        }
      }),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && request.url.startsWith(self.location.origin)) {
          caches.open(APP_CACHE).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") return caches.match("/index.html");
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
