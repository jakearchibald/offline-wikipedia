var debounce = require('debounce');

class Controller {
  constructor() {
    this.toolbarView = new (require('./views/toolbar'));
    this.searchResultsView = new (require('./views/search-results'));
    this.articleView = new (require('./views/article'));

    this.wikipedia = new (require('./wikipedia'));

    this.lastSearchId = 0;

    var debouncedSearch = debounce(e => this.onSearchInput(e), 150);
    
    this.toolbarView.on('searchInput', event => {
      if (!event.value) {
        this.onSearchInput(event);
        return;
      }
      debouncedSearch(event);
    });

    var articleName = location.search.slice(1);
    if (articleName) {
      this.showArticle(articleName);
    }
  }

  onSearchInput({value}) {
    var id = ++this.lastSearchId;

    if (!value) {
      this.searchResultsView.hide();
      return;
    }

    this.wikipedia.search(value).then(results => {
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
    this.wikipedia.articleHtml(name).then(html => {
      this.articleView.updateContent({
        content: html
      });
    });

    this.wikipedia.articleMeta(name).then(data => {
      this.articleView.updateMeta(data);
    })
  }
}

module.exports = Controller;