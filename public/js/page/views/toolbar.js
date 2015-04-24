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
  }

  onSearchBtnClick(event) {
    this.searchInput.value = '';
    this.lastSearchTerm = '';
    this.searchBar.classList.add('active');
    this.searchInput.focus();
  }

  onBackBtnClick(event) {
    this.searchBar.classList.remove('active');
    this.emit('searchInput', {value: ''});
  }

  onSearchInput(event) {
    var value = this.searchInput.value.trim();

    if (value != this.lastSearchTerm) {
      this.lastSearchTerm = value;
      this.emit('searchInput', {value});
    }
  }
}

module.exports = Toolbar;