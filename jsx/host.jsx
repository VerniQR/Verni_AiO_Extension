/* Verni AiO Extension - Premiere Pro ExtendScript entry point */
var AEDRNO = AEDRNO || {};
AEDRNO._moduleLoadErrors = [];

(function () {
  function _verniErrorText(e) {
    try {
      var out = '';
      try { out += e && e.name ? e.name + ': ' : ''; } catch (ignore1) {}
      try { out += e && e.message ? e.message : String(e); } catch (ignore2) { out += 'Nieznany błąd'; }
      try { if (e && e.line) { out += ' | line: ' + e.line; } } catch (ignore3) {}
      return out;
    } catch (ignore4) {
      return 'Nieznany błąd ładowania modułu.';
    }
  }

  function _verniBaseFolder() {
    try { return new File($.fileName).parent; } catch (e) { return null; }
  }

  function _verniLoadModule(baseFolder, relativePath) {
    try {
      var f = new File(baseFolder.fsName + '/' + relativePath);
      if (!f.exists) {
        AEDRNO._moduleLoadErrors.push('Brak modułu: ' + relativePath);
        return false;
      }
      $.evalFile(f);
      return true;
    } catch (e) {
      AEDRNO._moduleLoadErrors.push(relativePath + ' -> ' + _verniErrorText(e));
      return false;
    }
  }

  var base = _verniBaseFolder();
  if (!base) {
    AEDRNO._moduleLoadErrors.push('Nie udało się ustalić folderu host.jsx.');
    return;
  }

  _verniLoadModule(base, 'modules/project_organizer.jsx');
  _verniLoadModule(base, 'modules/timecode_sync.jsx');
  _verniLoadModule(base, 'modules/split_screen.jsx');
  _verniLoadModule(base, 'modules/transform_tools.jsx');
  _verniLoadModule(base, 'modules/copy_paste.jsx');
  _verniLoadModule(base, 'modules/auto_sync_un_nest_timer.jsx');
  _verniLoadModule(base, 'modules/media_offline_relink.jsx');
  _verniLoadModule(base, 'modules/multi_nest.jsx');
}());
