require("regenerator/runtime");

// remove caches, remove active-version
self.addEventListener('install', function(event) {
  event.waitUntil(async _ => {
    if (self.skipWaiting) {
      self.skipWaiting();
    }

    // remove caches beginning "svgomg-" that aren't in
    // expectedCaches
    var cacheNames = await caches.keys();
    for (var cacheName of cacheNames) {
      if (!/^wikioffline-/.test(cacheName)) continue;
      await caches.delete(cacheName);
    }
  }());
});
