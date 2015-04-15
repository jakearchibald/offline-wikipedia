var contentTemplate = require('./templates/article-content.hbs');
var headerTemplate = require('./templates/article-header.hbs');

class Article extends (require('events').EventEmitter) {
  constructor() {
    super();
    this.container = document.querySelector('.article-container');
    this._content = this.container.querySelector('.article-content');
    this._header = this.container.querySelector('.article-header');

    this._header.addEventListener('change', event => {
      if (event.target.name == 'cache') this.emit('cacheChange', {value: event.target.checked});
    })
  }

  updateContent(article) {
    this._content.innerHTML = contentTemplate(article);
  }

  updateMeta(data) {
    this._header.innerHTML = headerTemplate(data);
  }
}

module.exports = Article;