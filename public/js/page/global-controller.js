require('regenerator/runtime');

var debounce = require('debounce');
var wikipedia = require('./wikipedia');
var flags = require('./flags').parse();

class GlobalController {
  constructor() {
    // ui
    this._toolbarView = new (require('./views/toolbar'));
    this._searchResultsView = new (require('./views/search-results'));
    this._toastsView = require('./views/toasts');

    // view events
    this._toolbarView.on('searchInput', event => {
      if (!event.value) {
        this._onSearchInput(event);
        return;
      }
      debouncedSearch(event);
    });

    // state
    this._setupServiceWorker();
    this._lastSearchId = 0;

    // setup
    var debouncedSearch = debounce(e => this._onSearchInput(e), 150);
    
    // router
    if (location.pathname == '/') {
      new (require('./home-controller'));
    }
    else if (/^\/wiki\/[^\/]+/.test(location.pathname)) {
      new (require('./article-controller'));
    }
    else if (location.pathname == '/flags') {
      new (require('./flags-controller'));
    }
  }

  async _setupServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    if (flags.get('prevent-sw')) {
      var reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        console.log('ServiceWorker prevented due to flags');
        return;
      }
      console.log('ServiceWorker found & unregistered - refresh to load without');
      reg.unregister();
      return;
    }

    var reg = await navigator.serviceWorker.register('/sw.js')
    reg.addEventListener('updatefound', _ => this._onSwUpdateFound(reg));
    navigator.serviceWorker.addEventListener('controllerchange', _ => this._onSwControllerChange());
    if (reg.waiting) this._onSwUpdateReady();
  }

  _onSwControllerChange() {
    location.reload();
  }

  async _onSwUpdateReady() {
    var toast = this._toastsView.show("Update available", {
      buttons: ['reload', 'dismiss']
    });

    var newWorker = (await navigator.serviceWorker.getRegistration()).waiting;
    var answer = await toast.answer;

    if (answer == 'reload') {
      newWorker.postMessage('skipWaiting');
    }
  }

  _onSwUpdateFound(registration) {
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
        this._onSwUpdateReady();
      }
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
}

module.exports = GlobalController;