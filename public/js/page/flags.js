var querystring = require('querystring');
var cookies = require('browser-cookies');

class Flags extends (require('../../../isojs/flags')) {
  set(key, val) {
    this._vals[key] = val;
  }

  stringify() {
    var obj = {};
    
    Object.keys(this._vals).forEach(key => {
      if (key == 'use-url-flags') return;
      if (this._vals[key]) obj[key] = 1;
    });
    
    return querystring.stringify(obj);
  }

  getQuerystring() {
    return '?' + 'use-url-flags&' + this.stringify();
  }

  setCookie(name) {
    cookies.set(name, this.stringify(), {expires: 365});
  }
}

module.exports = Flags;