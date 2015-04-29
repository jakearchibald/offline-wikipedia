var Flags = require('./flags');
var utils = require('./utils');

class FlagsController {
  constructor() {
    // ui
    this._toastsView = require('./views/toasts');
    this._flagsForm = document.querySelector('.flags-form');
    this._flagsQuery = document.querySelector('.flags-query');
    this._flagsScript = document.querySelector('.flags-webpagetest-script');

    // view events
    this._flagsForm.addEventListener('submit', e => this._onFlagsSubmit(e));
    this._flagsForm.addEventListener('change', e => this._updateFlagsOutput());

    this._updateFlagsOutput();
  }

  _getFlags() {
    var checkboxes = utils.toArray(this._flagsForm.querySelectorAll('input[type=checkbox]'));
    var flags = new Flags();
    for (var checkbox of checkboxes) {
      flags.set(checkbox.name, checkbox.checked ? 1 : 0);
    }
    return flags;
  }

  _updateFlagsOutput(event) {
    var flags = this._getFlags();
    this._flagsQuery.textContent = flags.getQuerystring();
    this._flagsScript.textContent = flags.getWebPageTestScript();
  }

  _onFlagsSubmit(event) {
    event.preventDefault();
    this._getFlags().setCookie();
    this._toastsView.show("Flags updated", {duration: 2000});
  }
}

module.exports = FlagsController;