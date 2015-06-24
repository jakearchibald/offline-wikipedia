var srcset = require('srcset');
var storage = require('./storage');

var cachePrefix = "wikioffline-article-";

function getMetaRequest(name) {
  return new Request('/wiki/' + name + '.json', {
    credentials: 'include' // needed for flag cookies
  });
}

function getArticleRequest(name) {
  return new Request('/wiki/' + name + '.inc', {
    credentials: 'include' // needed for flag cookies
  });
}

class Article {
  constructor(name, {
    fromCache = false
  }={}) {
    var fetcher = fromCache ? caches.match.bind(caches) : fetch;
    this._metaPromise = fetcher(getMetaRequest(name));
    this._articlePromise = fetcher(getArticleRequest(name));

    this.ready = this._metaPromise.then(r => {
      if (!r) throw Error('No response');
    });

    var data = this.ready.then(_ => this._metaPromise).then(r => r.clone().json());

    this._html = undefined;

    this.meta = data.then(meta => {
      meta.updated = new Date(meta.updated);
      return meta;
    });

    this._cacheName = this.meta.then(data => cachePrefix + data.urlId);
  }

  async getHtml() {
    if (this._html === undefined) {
      this._html = await this._articlePromise.then(r => r.clone().text());
    }

    return this._html;
  }

  getHtmlResponse() {
    return this._articlePromise.then(r => r.clone());
  }

  async _createCacheArticleResponse() {
    var text = await this.getHtml();
    // workers don't have access to DPR
    var devicePixelRatio = self.devicePixelRatio || (await storage.get('devicePixelRatio')) || 2;

    // yes I'm parsing HTML with regex muahahaha
    // I'm flattening srcset to make it deterministic
    text = text.replace(/<img[^>]*>/ig, match => {
      // start with the image src as density 1
      var newSrc = (/src=(['"])(.*?)\1/i.exec(match) || [])[2];

      match = match.replace(/srcset=(['"])(.*?)\1/ig, (srcsetAll, _, srcsetInner) => {
        try {
          var parsedSrcset = srcset.parse(srcsetInner).sort((a, b) => {
            return a.density < b.density ? -1 : 1;
          });
          var lastDensity = 1;

          for (var srcSetItem of parsedSrcset) {
            if (devicePixelRatio > lastDensity) {
              newSrc = srcSetItem.url;
            }
            if (devicePixelRatio <= srcSetItem.density) {
              break;
            }
            lastDensity = srcSetItem.density;
          }
        }
        catch (e) {}

        return '';
      });

      if (newSrc) {
        match = match.replace(/src=(['"]).*?\1/ig, `src="${newSrc}"`);
      }

      return match;
    });

    return new Response(text, {
      headers: (await this._articlePromise).headers
    });
  }

  async cache() {
    var previouslyCached = await this.isCached();
    var cache = await caches.open(await this._cacheName);
    var imgRe = /<img[^>]*src=(['"])(.*?)\1[^>]*>/ig;
    var regexResult;
    var articleResponse = await this._createCacheArticleResponse();
    var htmlText = await articleResponse.clone().text();
    var imgSrcs = new Set();
    var urlId = (await this.meta).urlId;

    while (regexResult = imgRe.exec(htmlText)) {
      imgSrcs.add(regexResult[2]);
    }

    var cacheOpeations = [
      // get a fresh request, as it may have originally been redirected
      cache.put(getMetaRequest(urlId), (await this._metaPromise).clone()),
      cache.put(getArticleRequest(urlId), articleResponse)
    ];

    imgSrcs.forEach(url => {
      var request = new Request(url, {mode: 'no-cors'});
      cacheOpeations.push(
        // This is a workaround to https://code.google.com/p/chromium/issues/detail?id=477658
        // Once the bug is fixed, we can just do this:
        // fetch(request).then(response => cache.put(request, response))
        caches.match(request).then(response => response || fetch(request)).then(response => cache.put(request, response))
      );
    });

    return Promise.all(cacheOpeations).catch(err => {
      if (!previouslyCached) {
        this.uncache();
      }
      throw err;
    }).then(_ => undefined);
  }

  async uncache() {
    return caches.delete(await this._cacheName);
  }

  async isCached() {
    return caches.has(await this._cacheName);
  }
}

var wikipedia = {
  search(term) {
    return fetch('/search.json?s=' + term, {
      credentials: 'include' // needed for flag cookies
    }).then(r => r.json());
  },

  async article(name, {
    fromCache = false
  }={}) {
    if (fromCache && !('caches' in self)) return Promise.reject(Error("Caching not supported"));

    var article = new Article(name, {fromCache});
    await article.ready;
    return article;
  },

  async getCachedArticleData() {
    if (!('caches' in self)) return [];

    var articleNames = (await caches.keys())
      .filter(cacheName => cacheName.startsWith(cachePrefix))
      .map(cacheName => cacheName.slice(cachePrefix.length));

    return Promise.all(
      articleNames.map(async name => {
        var response = await caches.match(getMetaRequest(name));

        // seeing a bug where the response here is gone - not sure why
        // but I'll guard against it
        if (!response) {
          wikipedia.uncache(name);
          return false;
        };

        return response.json();
      })
    ).then(vals => vals.filter(val => val));
  },

  uncache(name) {
    return caches.delete(cachePrefix + name);
  }
};

module.exports = wikipedia;