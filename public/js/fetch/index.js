require('whatwg-fetch');

var fetchPolfill = self.fetch;

// rough patch for https://github.com/github/fetch/issues/122
self.fetch = function(url, opts) {
  if (url.fetch) return url.fetch();
  return fetchPolfill(url, opts);
};

// this seems to deal with the lack of clone
Response.prototype.clone = function() {
  return this;
};