var toQueryString = require('./toQueryString');
var base = 'https://wikipedia-cors.appspot.com/';
var apiBase = base + 'en.wikipedia.org/w/api.php?';
var viewBase = base + 'en.m.wikipedia.org/wiki/';

module.exports = {
  apiBase,

  getSearchUrl(term) {
    return apiBase + toQueryString({
      action: 'opensearch',
      search: term,
      format: 'json',
      redirects: 'resolve',
      limit: 4
    });
  },

  getMetaUrl(name) {
    return apiBase + toQueryString({
      action: 'query',
      titles: name,
      format: 'json',
      redirects: 'resolve',
      prop: 'extracts',
      explaintext: 1,
      exsentences: 1
    });
  },

  processMetaJson(data) {
    var page = data.query.pages[Object.keys(data.query.pages)[0]];

    return {
      title: page.title,
      extract: page.extract,
      urlId: page.title.replace(/\s/g, '_'),
      updated: new Date() // TODO: fix this date (can I get it from meta?)
    };
  },

  processArticleHtml(html) {
    return html.replace(/\/\/en\.wikipedia\.org\/wiki\//g, '/wiki/');
  },

  getArticleUrl(name) {
    return viewBase + name + '?action=render';
  }
};