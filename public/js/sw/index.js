require('babelify/node_modules/babel-core/node_modules/regenerator/runtime');
require('serviceworker-cache-polyfill');
var wikipedia = require('../shared/wikipedia');
var storage = require('../shared/storage');

var version = '22';
var prefix = 'wikioffline';
var staticCacheName = `${prefix}-static-v${version}`;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(staticCacheName).then(cache => {
      return cache.addAll([
        '/',
        '/shell.html',
        '/js/page.js',
        '/js/page-framework.js', // yeahhhh, we're caching waayyyyy more than we need, but keeps the request tests fair
        '/css/head-wiki.css', // don't need this when it's inlined, but helps when rendered with blocking CSS in settings
        '/css/wiki.css'
      ]);
    })
  );
});

var expectedCaches = [
  staticCacheName
];

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key.startsWith(prefix + '-')
            && !key.startsWith(`${prefix}-article-`)
            && !expectedCaches.includes(key)) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// This will vanish when the ServiceWorker closes,
// but that's cool, I want that.
var dataTmpCache = {};

self.addEventListener('fetch', event => {
  var requestURL = new URL(event.request.url);

  // catch the root request
  if (requestURL.origin == location.origin) {
    if (requestURL.pathname == '/') {
      event.respondWith(caches.match('/'));
      return;
    }
    if (requestURL.pathname == '/') {
      event.respondWith(caches.match('/shell.html'));
      return;
    }
    if (requestURL.pathname.startsWith('/wiki/')) {
      if (/\.(json|inc)$/.test(requestURL.pathname)) {
        if (dataTmpCache[requestURL.href]) {
          var response = dataTmpCache[requestURL.href];
          delete dataTmpCache[requestURL.href];
          event.respondWith(response);
        }
        return;
      }

      // Get ahead of the pack by starting the json request now
      var jsonURL = new URL(requestURL);
      jsonURL.pathname += '.json';
      jsonURL.search = '';
      var incURL = new URL(requestURL);
      incURL.pathname += '.inc';
      incURL.search = '';
      dataTmpCache[jsonURL.href] = fetch(jsonURL, {
        credentials: 'include' // needed for flag cookies
      });
      dataTmpCache[incURL.href] = fetch(incURL, {
        credentials: 'include' // needed for flag cookies
      });

      event.respondWith(caches.match('/shell.html'));
      return;
    }
  }

  // default fetch behaviour
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('sync', event => {
  // My use of storage here has race conditions. Meh.
  console.log("Good lord, a sync event");

  event.waitUntil(
    storage.get('to-bg-cache').then(toCache => {
      toCache = toCache || [];

      return Promise.all(toCache.map(async articleName => {
        var article = await wikipedia.article(articleName);
        await article.cache();
        registration.showNotification((await article.meta).title + " ready!", {
          icon: "/imgs/wikipedia-192.png",
          body: "View the article",
          data: (await article.meta).urlId
        });
      }));
    }).then(_ => {
      storage.set('to-bg-cache', []);
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  // assuming only one type of notification right now
  event.notification.close();
  clients.openWindow(`${location.origin}/wiki/${event.notification.data}`);
});

self.addEventListener('message', event => {
  if (event.data == 'skipWaiting') {
    self.skipWaiting();
  }
});