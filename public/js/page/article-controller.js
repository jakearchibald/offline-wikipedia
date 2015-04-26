var debounce = require('debounce');
var wikipedia = require('./wikipedia');
var wikiDisplayDate = require('../../../isojs/wiki-display-date');

var cacheCapable = 'caches' in window;

class ArticleController {
  constructor() {
    // ui
    this._articleView = new (require('./views/article'));
    this._toastsView = require('./views/toasts');

    // view events
    this._articleView.on('cacheChange', e => this._onCacheChange(e));

    // state
    this._article = null;
    this._urlArticleName = /^\/wiki\/([^\/]+)/.exec(location.pathname)[1];

    // setup
    if (this._articleView.serverRendered) {
      this._articleView.updateCachingAbility(cacheCapable);
    }
    else {
      this._loadArticle(this._urlArticleName);
    }
  }

  async _onCacheChange({value}) {
    if (!this._article) {
      this._article = await wikipedia.article(this._urlArticleName);
    }
    if (value) {
      return this._article.cache().catch(err => this._showError(Error("Caching failed")));
    }
    this._article.uncache();
  }

  _showError(err) {
    this._toastsView.show(err.message, {
      duration: 3000
    });
  }

  async _displayArticle(article) {
    var [data, content] = await Promise.all([article.meta, article.html]);
    var url = new URL(location);
    url.pathname = url.pathname.replace(/\/[^\/]+$/, '/' + data.urlId)
    data = await processData(article, data);
    document.title = data.title + ' - Offline Wikipedia';
    history.replaceState({}, document.title, url);
    this._article = article;
    this._articleView.updateMeta(data);
    this._articleView.updateContent({content});
  }

  async _loadArticle(name) {
    this._articleView.startLoading();
    var articleCachedPromise = wikipedia.article(name, {fromCache: true});
    var articleLivePromise   = wikipedia.article(name);

    var showedCachedContent = false;
    var cachedArticle, liveArticle;

    try {
      cachedArticle = await articleCachedPromise;
      await this._displayArticle(cachedArticle);
      showedCachedContent = true;
      console.log('displayed from cache');
    }
    catch (err) {}

    try {
      liveArticle = await articleLivePromise;

      if (showedCachedContent) {
        if ((await cachedArticle.meta).updated.valueOf() == (await liveArticle.meta).updated.valueOf()) {
          console.log('cached version is up to date');
          return;
        }
        console.log('found update, caching');
        await liveArticle.cache();
      }
      await this._displayArticle(await articleLivePromise);
      console.log('displayed from live');
    }
    catch (err) {
      if (!showedCachedContent) {
        this._showError(Error("Failed to load article"));
        this._articleView.stopLoading();
      }
    }
  }
}

async function processData(article, articleData) {
  var data = Object.create(articleData);

  if (cacheCapable) {
    data.cacheCapable = true;
    data.cached = await article.isCached();
  }

  data.updated = wikiDisplayDate(data.updated);
  return data;
}

module.exports = ArticleController;