var template = require('./templates/search-results.hbs');
var utils = require('../utils');

class SearchResults {
  constructor() {
    this.container = document.querySelector('.search-results');
    this.items = [];
    this.activeIndex = -1;

    document.querySelector('.search').addEventListener('keydown', e => this.onSearchKeyDown(e));
  }

  onSearchKeyDown(event) {
    switch (event.keyCode) {
      case 13: // enter
        this.activate();
        event.preventDefault();
        break;
      case 38: // up
        this.previous();
        event.preventDefault();
        break;
      case 40: // down
        this.next();
        event.preventDefault();
        break;
    }
  }

  update(results) {
    this.activeIndex = -1;
    this.container.classList.add('active');
    this.container.innerHTML = template(results);
    this.items = utils.toArray(this.container.querySelectorAll('.search-result'));
  }

  hide() {
    this.container.classList.remove('active');
  }

  previous() {
    if (this.items[this.activeIndex]) {
      this.items[this.activeIndex].classList.remove('active');
    }

    this.activeIndex--;

    if (!this.items[this.activeIndex]) {
      this.activeIndex = this.items.length - 1;
    }

    this.items[this.activeIndex].classList.add('active');
  }

  next() {
    if (this.items[this.activeIndex]) {
      this.items[this.activeIndex].classList.remove('active');
    }

    this.activeIndex++;

    if (!this.items[this.activeIndex]) {
      this.activeIndex = 0;
    }

    this.items[this.activeIndex].classList.add('active');
  }

  activate() {
    var itemToActivate = this.items[this.activeIndex] || this.items[0];
    
    if (itemToActivate) {
      itemToActivate.querySelector('a').click();
    }
  }
}

module.exports = SearchResults;
