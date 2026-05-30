// LBM-Watcher service worker
// -----------------------------------------------------------------------------
// Macht die App offline-fähig und liefert sie schneller aus, indem die App-Shell
// (HTML, Manifest, Icons) lokal gecacht wird. Strategie:
//   - install  : App-Shell vorab in den Cache laden, sofort aktivieren
//   - activate : alte Cache-Versionen wegräumen
//   - fetch    : stale-while-revalidate — sofort aus Cache antworten und im
//                Hintergrund eine frische Kopie nachziehen.
//
// WICHTIG: Bei jedem Release VERSION hochzählen. Nur dadurch erkennt der Browser
// den neuen Cache-Namen und schmeißt die alte App-Shell weg. Sonst bekommen
// installierte Nutzer den alten Stand bis der Cache zufällig invalidiert wird.
// -----------------------------------------------------------------------------

const VERSION = 'v1.10.2';
const CACHE = 'lbm-watcher-' + VERSION;

// App-Shell: alles, was zum ersten Laden ohne Netz nötig ist.
// Pfade sind relativ zum SW-Scope (GitHub-Pages-Unterordner: /lbm-watcher/).
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()) // direkt aktiv werden, nicht auf Tab-Close warten
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()) // bestehende Tabs sofort übernehmen
  );
});

self.addEventListener('fetch', event => {
  // Nur GETs cachen — POST/PUT/etc. immer direkt ans Netz.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(event.request);
      const network = fetch(event.request)
        .then(resp => {
          // Nur erfolgreiche, lesbare Responses cachen.
          // (opaque/error/redirect lassen wir liegen — sonst vergiftet Cache.)
          if (resp && resp.status === 200 && (resp.type === 'basic' || resp.type === 'cors')) {
            cache.put(event.request, resp.clone());
          }
          return resp;
        })
        .catch(() => cached); // offline → was im Cache liegt
      return cached || network;
    })
  );
});
