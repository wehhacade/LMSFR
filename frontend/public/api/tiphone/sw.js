/* TipPhone PWA service worker — fresh shell online, cached shell offline */
const CACHE = "tiphone-v6";
const SHELL = "/api/tiphone";
const PRECACHE = [
  SHELL,
  "/api/tiphone/manifest.webmanifest",
  "/api/tiphone/icon-192.png",
  "/api/tiphone/icon-512.png",
  "/api/tiphone/pattern.svg",
];
/** Shell must come from the network unless it is slow/offline, so new deploys land. */
const SHELL_NETWORK_TIMEOUT_MS = 3000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirstShell(request) {
  const cache = await caches.open(CACHE);
  const cached = (await cache.match(request)) || (await cache.match(SHELL));

  const network = fetch(request).then((res) => {
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  });

  if (!cached) {
    try {
      return await network;
    } catch {
      return Response.error();
    }
  }

  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(null), SHELL_NETWORK_TIMEOUT_MS);
  });

  try {
    const fresh = await Promise.race([network, timeout]);
    if (fresh) return fresh;
  } catch {
    /* offline — fall through to cache */
  }
  void network.catch(() => null);
  return cached;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache API calls to Django
  if (url.pathname.includes("/api/v") || url.hostname !== self.location.hostname) {
    return;
  }

  if (
    request.mode === "navigate" ||
    url.pathname === SHELL ||
    url.pathname === `${SHELL}/`
  ) {
    event.respondWith(networkFirstShell(request));
    return;
  }

  // Hashed build assets are immutable, so cache-first is safe here.
  if (
    url.pathname.startsWith(`${SHELL}/`) ||
    url.pathname.startsWith("/_next/static/")
  ) {
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
