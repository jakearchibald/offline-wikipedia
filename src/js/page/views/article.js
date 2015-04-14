var contentTemplate = require('./templates/article-content.hbs');
var headerTemplate = require('./templates/article-header.hbs');

class Article {
  constructor() {
    this.container = document.querySelector('.article-container');
    this.content = this.container.querySelector('.article-content');
    this.header = this.container.querySelector('.article-header');
  }

  updateContent(article) {
    this.content.innerHTML = contentTemplate(article);
  }
  updateMeta(data) {
    this.header.innerHTML = headerTemplate(data);
  }
}

module.exports = Article;