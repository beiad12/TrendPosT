// Minimal service worker: enables PWA installability + a light app-shell
// cache. Deliberately does NOT cache /api/* or /static/exports/* — trends,
// captions, and rendered images must always be fresh.
const CACHE_NAME = "trendpost-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isDynamic(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/static/");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || isDynamic(url)) {
    return; // let the network handle API calls, uploads, and rendered exports untouched
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const networkFetch = fetch(event.request)
        .then((res) => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
