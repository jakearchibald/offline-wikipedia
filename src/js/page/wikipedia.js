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
    
    this.html = htmlResponse.clone().text().then(text => {
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

  async cache() {
    var cache = await caches.open(await this._cacheName);
    return Promise.all([
      cache.put(this._htmlRequest, this._htmlResponse.clone()),
      cache.put(this._metaRequest, this._metaResponse.clone())
    ]);
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