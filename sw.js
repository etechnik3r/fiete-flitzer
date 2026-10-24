/* ===========================================================================
   Fiete Flitzer – Service Worker (sw.js)
   ---------------------------------------------------------------------------
   Macht das Spiel offline-fähig (PWA): alle Dateien werden beim Installieren
   in den Cache gelegt und danach cache-first ausgeliefert – wie bei allen
   JONFIE-STUDIOS-Spielen.

   WICHTIG: Bei jeder Änderung an den Spieldateien die VERSION hochzählen
   (gleich mit der ?v=NUMMER in index.html) – sonst liefert der Cache alt aus.
   ===========================================================================*/

var VERSION = "v3";
var CACHE_NAME = "fiete-flitzer-" + VERSION;

var DATEIEN = [
  "./",
  "index.html",
  "style.css?v=3",
  "config.js?v=3",
  "gelaende.js?v=3",
  "physik.js?v=3",
  "fahrt.js?v=3",
  "grafik.js?v=3",
  "klang.js?v=3",
  "spiel.js?v=3",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "fonts/baloo2-latin.woff2",
  "fonts/nunito-latin.woff2"
];

self.addEventListener("install", function (ereignis) {
  ereignis.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(DATEIEN); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (ereignis) {
  ereignis.waitUntil(
    caches.keys().then(function (namen) {
      return Promise.all(namen.map(function (name) {
        if (name !== CACHE_NAME) { return caches.delete(name); }
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (ereignis) {
  if (ereignis.request.method !== "GET") { return; }
  ereignis.respondWith(
    caches.match(ereignis.request).then(function (treffer) {
      if (treffer) { return treffer; }
      return fetch(ereignis.request).catch(function () {
        if (ereignis.request.mode === "navigate") { return caches.match("index.html"); }
      });
    })
  );
});
