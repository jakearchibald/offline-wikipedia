var contentTemplate = require('./templates/article-content.hbs');
var headerTemplate = require('./templates/article-header.hbs');

class Article {
  constructor() {
    this.container = document.querySelector('.article-container');
    this._content = this.container.querySelector('.article-content');
    this._header = this.container.querySelector('.article-header');
  }

  updateContent(article) {
    this._content.innerHTML = contentTemplate(article);
  }
  updateMeta(data) {
    this._header.innerHTML = headerTemplate(data);
  }
}

module.exports = Article;