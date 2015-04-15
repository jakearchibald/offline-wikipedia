var template = require('./templates/search-results.hbs');
var utils = require('../utils');

class SearchResults {
  constructor() {
    this.container = document.querySelector('.search-results');
    this._items = [];
    this._activeIndex = -1;

    document.querySelector('.search').addEventListener('keydown', e => this.onSearchKeyDown(e));
  }

  onSearchKeyDown(event) {
    switch (event.keyCode) {
      case 13: // enter
        this._activate();
        event.preventDefault();
        break;
      case 38: // up
        this._previous();
        event.preventDefault();
        break;
      case 40: // down
        this._next();
        event.preventDefault();
        break;
    }
  }

  update(results) {
    this._activeIndex = -1;
    this.container.classList.add('active');
    this.container.innerHTML = template(results);
    this._items = utils.toArray(this.container.querySelectorAll('.search-result'));
  }

  hide() {
    this.container.classList.remove('active');
  }

  _previous() {
    if (this._items[this._activeIndex]) {
      this._items[this._activeIndex].classList.remove('active');
    }

    this._activeIndex--;

    if (!this._items[this._activeIndex]) {
      this._activeIndex = this._items.length - 1;
    }

    this._items[this._activeIndex].classList.add('active');
  }

  _next() {
    if (this._items[this._activeIndex]) {
      this._items[this._activeIndex].classList.remove('active');
    }

    this._activeIndex++;

    if (!this._items[this._activeIndex]) {
      this._activeIndex = 0;
    }

    this._items[this._activeIndex].classList.add('active');
  }

  _activate() {
    var itemToActivate = this._items[this._activeIndex] || this._items[0];
    
    if (itemToActivate) {
      itemToActivate.querySelector('a').click();
    }
  }
}

module.exports = SearchResults;
