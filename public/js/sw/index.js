require('regenerator/runtime');
require('serviceworker-cache-polyfill');
var wikipedia = require('../shared/wikipedia');
var storage = require('../shared/storage');

var version = '24';
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
      ]).then(() => cache.match('/shell.html')).then(response => {
        // bit hacky, making the shell start & end from the shell just fetched
        return response.text().then(text => {
          const headerEnd = text.indexOf('<div class="article-header subheading">');
          const articleEnd = text.indexOf('<div class="background-load-offer card">');
          return Promise.all([
            cache.put('/shell-start.html', new Response(text.slice(0, headerEnd), response)),
            cache.put('/shell-end.html', new Response(text.slice(articleEnd), response))
          ]);
        });
      });
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
            && expectedCaches.indexOf(key) == -1) {
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
    if (requestURL.pathname.startsWith('/wiki/')) {
      if (/\.(middle.inc)$/.test(requestURL.pathname)) {
        return;
      }

      if (/\.(json|inc)$/.test(requestURL.pathname)) {
        if (dataTmpCache[requestURL.href]) {
          var response = dataTmpCache[requestURL.href];
          delete dataTmpCache[requestURL.href];
          event.respondWith(response);
        }
        return;
      }

      if (requestURL.search.includes('sw-stream')) {
        event.respondWith(streamArticle(requestURL));
        return;
      }

      // Get ahead of the pack by starting the json request now
      if (!requestURL.search.includes('no-prefetch')) {
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
      }

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

function streamArticle(url) {
  try {
    new ReadableStream({});
  }
  catch(e) {
    return new Response("Streams not supported");
  }
  const stream = new ReadableStream({
    start(controller) {
      const contentURL = new URL(url);
      contentURL.pathname += '.middle.inc';
      const startFetch = caches.match('/shell-start.html');
      const contentFetch = fetch(contentURL).catch(() => new Response("Failed, soz"));
      const endFetch = caches.match('/shell-end.html');

      function pushStream(stream) {
        const reader = stream.getReader();
        function read() {
          return reader.read().then(result => {
            if (result.done) return;
            controller.enqueue(result.value);
            return read();
          });
        }
        return read();
      }

      startFetch
        .then(response => pushStream(response.body))
        .then(() => contentFetch)
        .then(response => pushStream(response.body))
        .then(() => endFetch)
        .then(response => pushStream(response.body))
        .then(() => controller.close());
    }
  });

  return new Response(stream, {
    headers: {'Content-Type': 'text/html'}
  })
}

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