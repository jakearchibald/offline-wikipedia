var contentTemplate = require('./templates/article-content.hbs');
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
    });
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

  updateContent(articleHtml) {
    this._content.innerHTML = contentTemplate({
      content: articleHtml
    });
  }

  // this is a super hacky experiment
  async streamContent(article) {
    var response = await article.getHtmlResponse();
    if (!response.body) {
      // not supported
      this.updateContent(await article.getHtml());
      return;
    }

    // Here comes the haaaaack!
    var fullContent = '';
    var buffer = '';
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var result;
    var awaitingInitialFlush = true;

    while (true) {
      var result = await reader.read();
      buffer += decoder.decode(result.value || new Uint8Array, {
        stream: !result.done
      });

      // so inefficient, but we don't have a better way to stream html
      if (result.done || (awaitingInitialFlush && buffer.length > 9000)) {
        fullContent += buffer;
        this._content.innerHTML = '<div id="content_wrapper" class="content card-content">STREAMED!!!' + fullContent + '</div>';
        awaitingInitialFlush = false;
        buffer = '';
      }

      if (result.done) break;
    }
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