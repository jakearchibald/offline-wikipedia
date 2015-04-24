var querystring = require('querystring');
var RSVP = require('rsvp');
var request = require('request');
var requestPromise = RSVP.denodeify(request);
var replaceStream = require('replacestream');

var apiBase = 'https://en.wikipedia.org/w/api.php?';
var viewBase = 'https://en.m.wikipedia.org/wiki/';

module.exports = {
  apiBase,

  getMetaData(name) {
    return requestPromise(apiBase + querystring.stringify({
      action: 'query',
      titles: name,
      format: 'json',
      redirects: 'resolve',
      prop: 'extracts|revisions',
      explaintext: 1,
      exsentences: 1
    })).then(r => JSON.parse(r.body)).then(data => {
      var page = data.query.pages[Object.keys(data.query.pages)[0]];
      
      if ('missing' in page) {
        return {err: "Not found"};
      }

      return {
        title: page.title,
        extract: page.extract,
        urlId: page.title.replace(/\s/g, '_'),
        updated: page.revisions[0].timestamp
      };
    });
  },

  search(term) {
    return requestPromise(apiBase + querystring.stringify({
      action: 'opensearch',
      search: term,
      format: 'json',
      redirects: 'resolve',
      limit: 4
    })).then(r => JSON.parse(r.body)).then(([term, pageTitles, descriptions, urls]) => {
      return pageTitles.map((title, i) => {
        return {
          title,
          description: descriptions[i],
          id: /[^\/]+$/.exec(urls[i])[0]
        }
      });
    });
  },

  getArticle(name) {
    return requestPromise(viewBase + name + '?action=render')
      .then(r => r.body.replace(/\/\/en\.wikipedia\.org\/wiki\//g, '/wiki/'));
  },

  getArticleStream(name) {
    return request(viewBase + name + '?action=render').pipe(replaceStream('//en.wikipedia.org/wiki/', '/wiki/'));
  }
};