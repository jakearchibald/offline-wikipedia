var contentTemplate = require('../../../../shared-templates/article-content.hbs');
var headerTemplate = require('../../../../shared-templates/article-header.hbs');
var Spinner = require('./spinner');
var utils = require('../utils');

class Article extends (require('events').EventEmitter) {
  constructor() {
    super();
    this.container = document.querySelector('.article-container');
    this._content = this.container.querySelector('.article-content');
    this._header = this.container.querySelector('.article-header');
    this._spinner = new Spinner();
    this.container.appendChild(this._spinner.container);
    this.serverRendered = !!document.querySelector('.content.server-rendered');

    this._header.addEventListener('change', event => {
      if (event.target.name == 'cache') this.emit('cacheChange', {value: event.target.checked});
    });

    this._content.addEventListener('click', event => {
      var heading = utils.closest(event.target, 'h2');
      if (heading) this._onHeadingClick(heading);
    })
  }

  _onHeadingClick(heading) {
    var newDisplayVal = '';

    if (heading.classList.contains('active')) {
      heading.classList.remove('active');
    }
    else {
      heading.classList.add('active');
      newDisplayVal = 'block';
    }

    var element = heading;
    while ((element = element.nextElementSibling) && !element.matches('h2')) {
      element.style.display = newDisplayVal;
    }
  }

  updateContent(article) {
    this._content.innerHTML = contentTemplate(article);
  }

  updateMeta(data) {
    this.stopLoading();
    this._header.innerHTML = headerTemplate(data);
  }

  updateCachingAbility(cacheCapable) {
    this.container.querySelector('.cache-toggle').style.visibility = cacheCapable ? '' : 'hidden';
  }

  startLoading() {
    this._spinner.show(800);
  }

  stopLoading() {
    this._spinner.hide();
  }
}

module.exports = Article;