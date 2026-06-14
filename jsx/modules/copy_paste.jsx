(function () {
  var COPY_PASTE_VERSION = '1.12.240';

  function _err(e) {
    var out = '';
    try { out = (e && e.message) ? e.message : String(e); } catch (ignore) { out = 'nieznany blad'; }
    try { if (e && e.line) { out += ' | line: ' + e.line; } } catch (ignore2) {}
    return out;
  }

  function _name(o) {
    try { return String(o.name || ''); } catch (e) {}
    return '';
  }

  function _ticks(obj) {
    try { return Number(obj.ticks); } catch (e0) {}
    try { return Math.round(Number(obj.seconds) * 254016000000); } catch (e1) {}
    try { return Number(obj); } catch (e2) {}
    return 0;
  }

  function _projectPath() {
    try { return String(app.project.path || ''); } catch (e) {}
    return '';
  }

  function _saveProject() {
    try {
      if (app.project && app.project.save) {
        app.project.save();
        return true;
      }
    } catch (e) {}
    return false;
  }

  function _selectedVideoClips(seq) {
    var arr = [];
    try {
      var sel = seq.getSelection();
      var len = sel ? (sel.length !== undefined ? sel.length : sel.numItems) : 0;
      for (var i = 0; i < len; i++) {
        var clip = sel[i];
        if (!clip) { continue; }
        try {
          if (clip.mediaType && String(clip.mediaType).toLowerCase() !== 'video') { continue; }
        } catch (e0) {}
        arr.push(clip);
      }
    } catch (e) {}
    return arr;
  }

  function _sortClips(arr) {
    arr.sort(function (a, b) {
      var at = 0, bt = 0, as = 0, bs = 0;
      try { at = Number(a.parentTrackIndex); } catch (e0) {}
      try { bt = Number(b.parentTrackIndex); } catch (e1) {}
      try { as = _ticks(a.start); } catch (e2) {}
      try { bs = _ticks(b.start); } catch (e3) {}
      if (at !== bt) { return at - bt; }
      if (as !== bs) { return as - bs; }
      return _name(a).localeCompare(_name(b));
    });
    return arr;
  }

  function _clipInfo(clip, index) {
    var out = {
      index: index,
      name: _name(clip),
      mediaType: '',
      track: 0,
      start: 0,
      end: 0,
      nodeId: ''
    };
    try { out.mediaType = String(clip.mediaType || ''); } catch (e0) {}
    try { out.track = Number(clip.parentTrackIndex) + 1; } catch (e1) {}
    try { out.start = _ticks(clip.start); } catch (e2) {}
    try { out.end = _ticks(clip.end); } catch (e3) {}
    try { out.nodeId = String(clip.nodeId || ''); } catch (e4) {}
    return out;
  }

  function _json(value) {
    try { return JSON.stringify(value); } catch (e) {}
    return '{}';
  }

  AEDRNO.getTextBlobSelectionInfo = function () {
    try {
      var seq = app.project.activeSequence;
      if (!seq) { return _json({ ok: false, error: 'Brak aktywnej sekwencji.' }); }
      var projectPath = _projectPath();
      if (!projectPath) { return _json({ ok: false, error: 'Najpierw zapisz projekt .prproj.' }); }
      _saveProject();
      var clips = _sortClips(_selectedVideoClips(seq));
      if (!clips || !clips.length) { return _json({ ok: false, error: 'Zaznacz grafike Type Tool na timeline.' }); }
      var out = [];
      for (var i = 0; i < clips.length; i++) { out.push(_clipInfo(clips[i], i)); }
      return _json({ ok: true, version: COPY_PASTE_VERSION, projectPath: projectPath, sequenceName: String(seq.name || ''), clips: out });
    } catch (e) {
      return _json({ ok: false, error: _err(e) });
    }
  };

  AEDRNO.reopenProjectAfterTextBlobPatch = function (projectPath) {
    var logs = [];
    try {
      var path = String(projectPath || '');
      if (!path) { return 'PasteText prproj patch: brak sciezki projektu do ponownego otwarcia.'; }
      var file = new File(path);
      if (!file.exists) { return 'PasteText prproj patch: plik projektu nie istnieje: ' + path; }

      try {
        if (app.project && app.project.closeDocument) {
          logs.push('closeDocument(0,0)=' + app.project.closeDocument(0, 0));
        } else {
          logs.push('closeDocument niedostepne.');
        }
      } catch (closeErr) {
        logs.push('closeDocument ERR: ' + closeErr);
      }

      try {
        if (app.openDocument) {
          logs.push('openDocument=' + app.openDocument(file.fsName, true, true, true, false));
          return 'PasteText prproj patch: projekt zostal zapisany na dysku i ponownie otwarty.\n' + logs.join('\n');
        }
      } catch (openErr) {
        logs.push('openDocument ERR: ' + openErr);
      }

      return 'PasteText prproj patch: plik projektu zostal zmieniony, ale nie udalo sie go automatycznie otworzyc. Zamknij projekt bez zapisu i otworz go ponownie recznie.\n' + logs.join('\n');
    } catch (e) {
      return 'PasteText prproj patch: blad reopen: ' + _err(e) + (logs.length ? ('\n' + logs.join('\n')) : '');
    }
  };
}());
