/* TipPhone PWA service worker — cache-first shell for instant resume */
const CACHE = "tiphone-v3";
const PRECACHE = [
  "/api/tiphone",
  "/tiphone/manifest.webmanifest",
  "/tiphone/icon-192.png",
  "/tiphone/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

/** Serve cache immediately, refresh in background. */
function staleWhileRevalidate(request) {
  return caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(request);
    const network = fetch(request)
      .then((res) => {
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      })
      .catch(() => null);

    if (cached) {
      void network;
      return cached;
    }
    const fresh = await network;
    if (fresh) return fresh;
    return caches.match("/api/tiphone");
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache API calls to Django
  if (url.pathname.includes("/api/v") || url.hostname !== self.location.hostname) {
    return;
  }

  // Instant shell for PWA open / resume from home screen
  if (request.mode === "navigate" || url.pathname.startsWith("/api/tiphone")) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Cache-first for static tiphone + Next assets
  if (url.pathname.startsWith("/tiphone/") || url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
  }
});
