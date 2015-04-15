var srcset = require('srcset');
var utils = require('./utils');

var base = 'https://wikipedia-cors.appspot.com/';
var apiBase = base + 'en.wikipedia.org/w/api.php?';
var viewBase = base + 'en.m.wikipedia.org/wiki/';
var cachePrefix = "wikioffline-article-";

class Article {
  constructor(htmlRequest, htmlResponse, metaRequest, metaResponse) {
    this._htmlRequest = htmlRequest;
    this._htmlResponse = htmlResponse;
    this._metaRequest = metaRequest;
    this._metaResponse = metaResponse;
    
    this.html = this._htmlResponse.text().then(text => {
      return text.replace(/\/\/en\.wikipedia\.org\/wiki\//g, '?');
    });

    this.meta = metaResponse.clone().json().then(data => {
      var page = data.query.pages[Object.keys(data.query.pages)[0]];

      return {
        title: page.title,
        extract: page.extract,
        urlId: page.title.replace(/\s/g, '_'),
        updated: new Date(htmlResponse.headers.get('last-modified'))
      };
    });

    this._cacheName = this.meta.then(data => cachePrefix + data.urlId);
  }

  async _createCacheHtmlResponse() {
    var text = await this.html;

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
    })
    
    return new Response(text, {
      headers: this._htmlResponse.headers
    });
  }

  async cache() {
    var cache = await caches.open(await this._cacheName);
    var imgRe = /<img[^>]*src=(['"])(.*?)\1[^>]*>/ig;
    var regexResult;
    var htmlResponse = await this._createCacheHtmlResponse()
    var htmlText = await htmlResponse.clone().text();
    var imgSrcs = new Set();

    while (regexResult = imgRe.exec(htmlText)) {
      imgSrcs.add(regexResult[2]);
    }

    var cacheOpeations = [
      cache.put(this._htmlRequest, htmlResponse),
      cache.put(this._metaRequest, this._metaResponse.clone())
    ];

    imgSrcs.forEach(url => {
      var request = new Request(url, {mode: 'no-cors'});
      cacheOpeations.push(
        fetch(request).then(response => cache.put(request, response))
      );
    });

    return Promise.all(cacheOpeations);
  }

  async uncache() {
    return caches.delete(await this._cacheName);
  }

  async isCached() {
    return caches.has(await this._cacheName);
  }
}

module.exports = {
  search(term) {
    return fetch(apiBase + utils.toQueryString({
      action: 'opensearch',
      search: term,
      format: 'json',
      redirects: 'resolve',
      limit: 4
    })).then(r => r.json()).then(([term, pageTitles, descriptions, urls]) => {
      return pageTitles.map((title, i) => {
        return {title, description: descriptions[i], id: /[^\/]+$/.exec(urls[i])[0]}
      });
    });
  },

  article(name, {
    fromCache = false
  }={}) {
    var htmlRequest = new Request(viewBase + name + '?action=render');
    var metaRequest = new Request(apiBase + utils.toQueryString({
      action: 'query',
      titles: name,
      format: 'json',
      redirects: 'resolve',
      prop: 'extracts',
      explaintext: 1,
      exsentences: 1
    }));

    return Promise.all([
      fromCache ? caches.match(htmlRequest) : fetch(htmlRequest),
      fromCache ? caches.match(metaRequest) : fetch(metaRequest)
    ]).then(([htmlResponse, metaResponse]) => {
      if (!(htmlResponse && metaResponse)) throw Error('No response');
      return new Article(htmlRequest, htmlResponse, metaRequest, metaResponse);
    });
  }
};