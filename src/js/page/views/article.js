var contentTemplate = require('./templates/article-content.hbs');
var headerTemplate = require('./templates/article-header.hbs');
var Spinner = require('./spinner');

class Article extends (require('events').EventEmitter) {
  constructor() {
    super();
    this.container = document.querySelector('.article-container');
    this._content = this.container.querySelector('.article-content');
    this._header = this.container.querySelector('.article-header');
    this._spinner = new Spinner();
    this.container.appendChild(this._spinner.container);

    this._header.addEventListener('change', event => {
      if (event.target.name == 'cache') this.emit('cacheChange', {value: event.target.checked});
    });
  }

  updateContent(article) {
    this._content.innerHTML = contentTemplate(article);
  }

  updateMeta(data) {
    this._spinner.hide();
    this._header.innerHTML = headerTemplate(data);
  }

  startLoading() {
    this._spinner.show(800);
  }
}

module.exports = Article;