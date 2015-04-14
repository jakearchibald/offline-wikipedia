var debounce = require('debounce');
var wikipedia = require('./wikipedia');

class Controller {
  constructor() {
    // ui
    this.toolbarView = new (require('./views/toolbar'));
    this.searchResultsView = new (require('./views/search-results'));
    this.articleView = new (require('./views/article'));
    this.toastsView = new (require('./views/toasts'));

    // state
    this.lastSearchId = 0;

    // setup
    var debouncedSearch = debounce(e => this.onSearchInput(e), 150);
    
    this.toolbarView.on('searchInput', event => {
      if (!event.value) {
        this.onSearchInput(event);
        return;
      }
      debouncedSearch(event);
    });

    document.body.appendChild(this.toastsView.container);

    var articleName = location.search.slice(1);
    if (articleName) {
      this.showArticle(articleName);
    }
  }

  showError(err) {
    this.toastsView.show(err.message, {
      duration: 3000
    });
  }

  onSearchInput({value}) {
    var id = ++this.lastSearchId;

    if (!value) {
      this.searchResultsView.hide();
      return;
    }

    wikipedia.search(value).then(results => {
      return {results};
    }).catch(err => {
      return {err: "Search failed"};
    }).then(results => {
      requestAnimationFrame(_ => {
        if (id != this.lastSearchId) return;
        this.searchResultsView.update(results);
      });
    });
  }

  showArticle(name) {
    wikipedia.articleHtml(name).then(html => {
      this.articleView.updateContent({
        content: html
      });
    }).catch(err => {
      this.showError("Article loading failed");
    });

    wikipedia.articleMeta(name).then(data => {
      this.articleView.updateMeta(data);
    });
  }
}

module.exports = Controller;