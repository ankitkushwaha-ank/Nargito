/* Nargito service worker.
 * Caches ONLY public static assets and the offline fallback page.
 * It never caches HTML documents, API responses, authentication responses, messages or admin pages. */
const VERSION = "nargito-static-v1";
const OFFLINE_URL = "/offline";
const STATIC_PATTERNS = [/^\/_next\/static\//, /^\/icons\//, /^\/brand\//, /\.(?:woff2?|css)$/];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.add(new Request(OFFLINE_URL, { cache: "reload" }))).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data && event.data.type === "CLEAR_CACHES") event.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin") || url.pathname.startsWith("/auth")) return; // never cache
  if (req.mode === "navigate") {
    // Network first; fall back to the offline page. Documents are not stored.
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || new Response("Offline", { status: 503 }))));
    return;
  }
  if (STATIC_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(
      caches.open(VERSION).then((cache) =>
        cache.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })),
      ),
    );
  }
});
