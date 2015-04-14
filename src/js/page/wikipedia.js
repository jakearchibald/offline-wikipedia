var utils = require('./utils');

var base = 'https://wikipedia-cors.appspot.com/';
var apiBase = base + 'en.wikipedia.org/w/api.php?';
var viewBase = base + 'en.m.wikipedia.org/wiki/';

module.exports = {
  search(term) {
    return fetch(apiBase + utils.toQueryString({
      action: 'opensearch',
      search: term,
      format: 'json',
      redirects: 'resolve',
      limit: 4
    })).then(r => r.json()).then(([term, pageTitles, descriptions, urls]) => {
      return pageTitles.map((title, i) => {
        return {title, description: descriptions[i], id: /[^\/]+$/.exec(urls[i])[0]}
      });
    });
  },

  articleHtml(name) {
    return fetch(viewBase + name + '?action=render').then(r => r.text()).then(text => {
      return text.replace(/\/\/en\.wikipedia\.org\/wiki\//g, '?');
    });
  },

  articleMeta(name) {
    return fetch(apiBase + utils.toQueryString({
      action: 'query',
      titles: name,
      format: 'json',
      redirects: 'resolve',
      prop: 'extracts'
    })).then(r => r.json()).then(data => {
      var page = data.query.pages[Object.keys(data.query.pages)[0]];

      return {
        title: page.title,
        extract: page.extract
      };
    });
  }
};