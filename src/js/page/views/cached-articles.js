var template = require('./templates/cached-articles.hbs');

class CachedArticles extends (require('events').EventEmitter) {
  constructor() {
    super();
    this.container = document.querySelector('.cached-articles-container');
    this.container.addEventListener('click', event => this._onClick(event));
  }

  _onClick(event) {
    // Thankfully we can use this, because Canary!
    if (!event.target.closest) return;
    var button = event.target.closest('button');

    if (!button) return;

    this.emit('delete', {id: button.value});
  }

  update(data) {
    this.container.innerHTML = template(data);
  }
}

module.exports = CachedArticles;