var loadScripts = require("./load-scripts");
var polyfillsNeeded = [];

if (!window.Promise) { // IE :(
  polyfillsNeeded.push('js/promise-polyfill.js');
}

if (!window.fetch) {
  polyfillsNeeded.push('js/fetch.js');
}

// I'm sure user-agent sniffing will be fiiiiine
if (/(iPhone|iPad);/.test(navigator.userAgent)) {
  polyfillsNeeded.push('js/fastclick.js');
}

loadScripts(polyfillsNeeded, function() {
  var c = new (require('./controller'));
}, function() {
  console.error("Failed to load polyfills");
});
