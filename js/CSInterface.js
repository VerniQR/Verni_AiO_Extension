/* Lightweight CEP CSInterface wrapper used by Verni AiO Extension.
   It keeps the panel self-contained, but exposes the CEP APIs this extension uses. */
(function () {
  var SystemPath = {
    USER_DATA: 'userData',
    COMMON_FILES: 'commonFiles',
    MY_DOCUMENTS: 'myDocuments',
    APPLICATION: 'application',
    EXTENSION: 'extension',
    HOST_APPLICATION: 'hostApplication'
  };

  function cepAvailable() {
    return !!(window.__adobe_cep__);
  }

  function CSInterface() {}

  CSInterface.prototype.evalScript = function (script, callback) {
    if (cepAvailable() && window.__adobe_cep__.evalScript) {
      window.__adobe_cep__.evalScript(script, callback || function () {});
    } else if (callback) {
      callback('CEP runtime not available. Open this panel inside Premiere Pro.');
    }
  };

  CSInterface.prototype.getSystemPath = function (pathType) {
    if (cepAvailable() && window.__adobe_cep__.getSystemPath) {
      return window.__adobe_cep__.getSystemPath(pathType);
    }
    return '';
  };

  CSInterface.prototype.openURLInDefaultBrowser = function (url) {
    if (cepAvailable() && window.__adobe_cep__.openURLInDefaultBrowser) {
      return window.__adobe_cep__.openURLInDefaultBrowser(url);
    }
    return false;
  };

  window.CSInterface = CSInterface;
  window.SystemPath = window.SystemPath || SystemPath;
}());
