var wikipedia = require('./wikipedia');

var cacheCapable = 'caches' in window;

class HomeController {
  constructor() {
    // ui
    this._cachedArticlesView = new (require('./views/cached-articles'));
    this._toastsView = require('./views/toasts');

    // view events
    this._cachedArticlesView.on('delete', e => this._onDeleteCachedArticle(e));

    this._showCachedArticles();
  }

  async _onDeleteCachedArticle({id}) {
    await wikipedia.uncache(id);
    this._showCachedArticles();
  }

  async _showCachedArticles() {
    this._cachedArticlesView.update({
      items: await wikipedia.getCachedArticleData(),
      cacheCapable: cacheCapable
    });
  }
}

module.exports = HomeController;