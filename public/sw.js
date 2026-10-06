/*
 * Service Worker für die Arbeitsbericht-App.
 * - Seiten: zuerst Netz, offline aus dem Cache (Berichte liegen ohnehin lokal in IndexedDB)
 * - Build-Dateien (_next/static), Logo, Icons: aus dem Cache
 * - /api/*: nie cachen
 * Bei Änderungen an dieser Datei CACHE_VERSION erhöhen.
 */
const CACHE_VERSION = "v2";
const CACHE = `mm-arbeitsbericht-${CACHE_VERSION}`;
const PRECACHE = [
  "/",
  "/bericht",
  "/ansicht",
  "/manifest.webmanifest",
  "/brand/mm-logo.png",
  "/icons/icon-192.png",
  // für PDFs ohne Netz
  "/fonts/MMBerichtSans-Regular.ttf",
  "/fonts/MMBerichtSans-Bold.ttf",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("mm-arbeitsbericht-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname === "/icon.png"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(url.pathname, copy));
          return response;
        })
        .catch(async () => (await caches.match(url.pathname)) || (await caches.match("/")) || Response.error()),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
