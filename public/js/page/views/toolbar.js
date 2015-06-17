class Toolbar extends (require('events').EventEmitter) {
  constructor() {
    super();

    this.container = document.querySelector('.toolbar');
    this.searchBar = this.container.querySelector('.search-bar');
    this.searchInput = this.container.querySelector('.search');
    this.lastSearchTerm = '';

    this.container.querySelector('.search-btn').addEventListener('click', e => this.onSearchBtnClick(e));
    this.container.querySelector('.back-btn').addEventListener('click', e => this.onBackBtnClick(e));
    this.searchInput.addEventListener('input', e => this.onSearchInput(e));

    // was this activated before JS loaded?
    if (this.searchBar.classList.contains('active')) {
      // wait for a microtask (so event handlers are ready)
      Promise.resolve().then(_ => this.onSearchInput());
    }
  }

  onSearchBtnClick(event) {
    // most of this is handled inline in base.dust
    this.lastSearchTerm = '';
  }

  onBackBtnClick(event) {
    // most of this is handled inline in base.dust
    this.emit('searchInput', {value: ''});
  }

  onSearchInput() {
    var value = this.searchInput.value.trim();

    if (value != this.lastSearchTerm) {
      this.lastSearchTerm = value;
      this.emit('searchInput', {value});
    }
  }
}

module.exports = Toolbar;