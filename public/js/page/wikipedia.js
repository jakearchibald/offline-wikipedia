var srcset = require('srcset');
var utils = require('./utils');

var cachePrefix = "wikioffline-article-";

class Article {
  constructor(articleRequest, articleResponse) {
    this._articleRequest = articleRequest;
    this._articleResponse = articleResponse;

    var data = articleResponse.clone().json();
    
    this.html = data.then(d => d.article);
    this.meta = data.then(data => {
      data.meta.updated = new Date(data.meta.updated);
      return data.meta;
    });

    this._cacheName = this.meta.then(data => cachePrefix + data.urlId);
  }

  async _createCacheResponse() {
    var response = await this._articleResponse.json();
    var text = response.article;

    // yes I'm parsing HTML with regex muahahaha
    // I'm flattening srcset to make it deterministic
    text = text.replace(/<img[^>]*>/ig, match => {
      var newSrc;

      match = match.replace(/srcset=(['"])(.*?)\1/ig, (srcsetAll, _, srcsetInner) => {
        try {
          var parsedSrcset = srcset.parse(srcsetInner).sort((a, b) => {
            return a.density < b.density ? -1 : 1;
          });
          var lastDensity = 0;

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

    response.article = text;
    
    return new Response(JSON.stringify(response), {
      headers: this._articleResponse.headers
    });
  }

  async cache() {
    var previouslyCached = await this.isCached();
    var cache = await caches.open(await this._cacheName);
    var imgRe = /<img[^>]*src=(['"])(.*?)\1[^>]*>/ig;
    var regexResult;
    var articleResponse = await this._createCacheResponse();
    var htmlText = (await articleResponse.clone().json()).article;
    var imgSrcs = new Set();

    while (regexResult = imgRe.exec(htmlText)) {
      imgSrcs.add(regexResult[2]);
    }

    var cacheOpeations = [
      // get a fresh article request, as it may have originally been redirected
      cache.put(wikipedia._getArticleRequest((await this.meta).urlId), articleResponse)
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
    });
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

  _getArticleRequest(name) {
    return new Request('/wiki/' + name + '.json', {
      credentials: 'include' // needed for flag cookies
    });
  },

  article(name, {
    fromCache = false
  }={}) {
    if (fromCache && !('caches' in window)) return Promise.reject(Error("Caching not supported"));

    var articleRequest = this._getArticleRequest(name);

    return (fromCache ? caches.match(articleRequest) : fetch(articleRequest))
      .then(articleResponse => {
        if (!articleResponse) throw Error('No response');
        return new Article(articleRequest, articleResponse);
      });
  },

  async getCachedArticleData() {
    if (!('caches' in window)) return [];

    var articleNames = (await caches.keys())
      .filter(cacheName => cacheName.indexOf(cachePrefix) === 0)
      .map(cacheName => cacheName.slice(cachePrefix.length));

    return Promise.all(
      articleNames.map(async name => {
        var response = await caches.match(this._getArticleRequest(name));

        // seeing a bug where the response here is gone - not sure why
        // but I'll guard against it
        if (!response) {
          wikipedia.uncache(name);
          return false;
        };

        return (await response.json()).meta;
      })
    ).then(vals => vals.filter(val => val));
  },

  uncache(name) {
    return caches.delete(cachePrefix + name);
  }
};

module.exports = wikipedia;