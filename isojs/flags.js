var querystring = require('querystring');

class Flags {
  constructor(cookieVal = '', urlVal = '') {
    this._vals = querystring.parse(urlVal);

    if (!this.has('use-url-flags')) {
      this._vals = querystring.parse(cookieVal);
    }
  }

  get(key) {
    return this._vals[key];
  }

  getAll() {
    return this._vals;
  }

  has(key) {
    return key in this._vals;
  }
}

module.exports = Flags;