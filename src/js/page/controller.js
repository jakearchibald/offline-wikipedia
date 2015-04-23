require('regenerator/runtime');

var debounce = require('debounce');
var wikipedia = require('./wikipedia');

class Controller {
  constructor() {
    // ui
    this._toolbarView = new (require('./views/toolbar'));
    this._searchResultsView = new (require('./views/search-results'));
    this._articleView = new (require('./views/article'));
    this._cachedArticlesView = new (require('./views/cached-articles'));
    this._toastsView = new (require('./views/toasts'));

    // view events
    this._toolbarView.on('searchInput', event => {
      if (!event.value) {
        this._onSearchInput(event);
        return;
      }
      debouncedSearch(event);
    });

    this._articleView.on('cacheChange', e => this._onCacheChange(e));
    this._cachedArticlesView.on('delete', e => this._onDeleteCachedArticle(e));

    // state
    this._lastSearchId = 0;
    this._article = null;

    // setup
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        reg.addEventListener('updatefound', _ => this._onUpdateFound(reg));
        navigator.serviceWorker.addEventListener('controllerchange', _ => this._onControllerChange());
        if (reg.waiting) this._onUpdateReady();
      });
    }

    var debouncedSearch = debounce(e => this._onSearchInput(e), 150);

    document.body.appendChild(this._toastsView.container);

    var articleName = /^\/wiki\/([^\/]+)/.exec(location.pathname);
    articleName = articleName && articleName[1];

    if (articleName) {
      this._loadArticle(articleName);
    }
    else {
      this._showCachedArticles();
    }
  }

  async _onDeleteCachedArticle({id}) {
    await wikipedia.uncache(id);
    this._showCachedArticles();
  }

  _onControllerChange() {
    location.reload();
  }

  _onCacheChange({value}) {
    if (value) {
      return this._article.cache().catch(err => this._showError(Error("Caching failed")));
    }
    this._article.uncache();
  }

  async _onUpdateReady() {
    var toast = this._toastsView.show("Update available", {
      buttons: ['reload', 'dismiss']
    });

    var newWorker = (await navigator.serviceWorker.getRegistration()).waiting;
    var answer = await toast.answer;

    if (answer == 'reload') {
      newWorker.postMessage('skipWaiting');
    }
  }

  _onUpdateFound(registration) {
    var newWorker = registration.installing;

    registration.installing.addEventListener('statechange', async _ => {
      // the very first activation!
      // tell the user stuff works offline
      if (newWorker.state == 'activated' && !navigator.serviceWorker.controller) {
        this._toastsView.show("Ready to work offline", {
          duration: 5000
        });
        return;
      }

      if (newWorker.state == 'installed' && navigator.serviceWorker.controller) {
        this._onUpdateReady();
      }
    });
  }

  async _showCachedArticles() {
    this._cachedArticlesView.update({
      items: await wikipedia.getCachedArticleData(),
      cacheCapable: 'caches' in window
    });
  }

  _showError(err) {
    this._toastsView.show(err.message, {
      duration: 3000
    });
  }

  async _onSearchInput({value}) {
    var id = ++this._lastSearchId;

    if (!value) {
      this._searchResultsView.hide();
      return;
    }

    var results;
    
    try {
      results = {results: await wikipedia.search(value)};
    }
    catch (e) {
      results = {err: "Search failed"};
    }

    requestAnimationFrame(_ => {
      if (id != this._lastSearchId) return;
      this._searchResultsView.update(results);
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

  if ('caches' in window) {
    data.cacheCapable = true;
    data.cached = await article.isCached();
  }

  var date = data.updated;
  var month = date.getMonth()+1 < 10 ? '0' + (date.getMonth()+1) : date.getMonth()+1;
  var day = date.getDate() < 10 ? '0' + date.getDate() : date.getDate();
  var hours = date.getHours() < 10 ? '0' + date.getHours() : date.getHours();
  var minutes = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
  data.updated = `${date.getFullYear()}/${month}/${day} ${hours}:${minutes}`;

  return data;
}

module.exports = Controller;