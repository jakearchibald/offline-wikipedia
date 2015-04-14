class Controller {
  constructor() {
    this.toolbarView = new (require('./views/toolbar'));

    this.toolbarView.on('searchInput', e => this.onSearchInput(e));
  }

  onSearchInput({value}) {
    console.log(value);
  }
}

module.exports = Controller;