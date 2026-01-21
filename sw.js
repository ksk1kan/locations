/* FL Konum PWA Service Worker */
const CACHE_NAME = "fl-konum-cache";
const PRECACHE = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./manifest.webmanifest",
  "./offline.html",
  "./fl_logo.png",
  "./baf_logo.png",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png",
  "./locations.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Clean old caches if any (single name policy)
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    // notify clients to reload after activation
    event.waitUntil((async () => {
      const clients = await self.clients.matchAll({ type: "window" });
      for (const c of clients) c.postMessage({ type: "RELOAD" });
    })());
  }
});

// Helpers
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, res.clone());
  return res;
}

async function networkFirst(request) {
  try {
    const res = await fetch(request, { cache: "no-store" });
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("offline");
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Data file: network-first
  if (url.pathname.endsWith("/locations.json")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Navigation: try cache, fallback to offline page
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        const cached = await caches.match("./index.html");
        return cached || (await caches.match("./offline.html"));
      }
    })());
    return;
  }

  // Others: cache-first
  event.respondWith(cacheFirst(req));
});
