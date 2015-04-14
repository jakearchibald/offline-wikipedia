var utils = require('./utils');

var base = 'https://wikipedia-cors.appspot.com/';
var apiBase = base + 'en.wikipedia.org/w/api.php?';

class Wikipedia {
  search(term) {
    return fetch(apiBase + utils.toQueryString({
      action: 'opensearch',
      search: term,
      format: 'json',
      redirects: 'resolve',
      limit: 4
    })).then(r => r.json()).then(([term, pageTitles, descriptions]) => {
      return pageTitles.map((title, i) => {
        return {title, description: descriptions[i]}
      });
    });
  }
}

module.exports = Wikipedia;