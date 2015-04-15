require('regenerator/runtime');

var debounce = require('debounce');
var wikipedia = require('./wikipedia');

class Controller {
  constructor() {
    // ui
    this._toolbarView = new (require('./views/toolbar'));
    this._searchResultsView = new (require('./views/search-results'));
    this._articleView = new (require('./views/article'));
    this._toastsView = new (require('./views/toasts'));

    // state
    this._lastSearchId = 0;

    // setup
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then(reg => {
        reg.addEventListener('updatefound', _ => this._onUpdateFound(reg));
        navigator.serviceWorker.addEventListener('controllerchange', _ => this._onControllerChange());
      });
    }

    var debouncedSearch = debounce(e => this._onSearchInput(e), 150);
    
    this._toolbarView.on('searchInput', event => {
      if (!event.value) {
        this._onSearchInput(event);
        return;
      }
      debouncedSearch(event);
    });

    document.body.appendChild(this._toastsView.container);

    var articleName = location.search.slice(1);
    if (articleName) {
      this._showArticle(articleName);
    }
  }

  _onControllerChange() {
    location.reload();
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
        // otherwise, show the user an alert
        var toast = this._toastsView.show("Update available", {
          buttons: ['reload', 'dismiss']
        });

        var answer = await toast.answer;

        if (answer == 'reload') {
          newWorker.postMessage('skipWaiting');
        }
      }
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

  _showArticle(name) {
    var html;

    wikipedia.articleMeta(name)
      .then(data => this._articleView.updateMeta(data));

    wikipedia.articleHtml(name)
      .then(content => this._articleView.updateContent({content}))
      .catch(err => this._showError(Error("Article loading failed")));
  }
}

module.exports = Controller;