/* Verni AiO Extension - Media Offline relink module */
var AEDRNO = AEDRNO || {};

(function () {
  function _moErr(e) {
    var out = '';
    try { if (e && e.name) { out += e.name + ': '; } } catch (ignore1) {}
    try { out += (e && e.message) ? e.message : String(e); } catch (ignore2) { out += 'Unknown error'; }
    try { if (e && e.line) { out += ' | line: ' + e.line; } } catch (ignore3) {}
    return out;
  }

  function _push(logs, msg) {
    try { logs.push(String(msg)); } catch (ignore) {}
  }

  function _lower(s) { return String(s || '').toLowerCase(); }

  function _normalizePath(s) { return String(s || '').replace(/\\/g, '/'); }

  function _basename(path) {
    var p = _normalizePath(path);
    var idx = p.lastIndexOf('/');
    return idx >= 0 ? p.substring(idx + 1) : p;
  }

  function _hasExt(name) {
    name = String(name || '');
    var slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
    var dot = name.lastIndexOf('.');
    return dot > slash && dot < name.length - 1;
  }

  function _fileExists(path) {
    try {
      if (!path) { return false; }
      return (new File(path)).exists;
    } catch (e) {
      return false;
    }
  }

  function _safeName(item) {
    try { if (item && item.name) { return String(item.name); } } catch (ignore) {}
    return '';
  }

  function _safeMediaPath(item) {
    try {
      if (item && item.getMediaPath) {
        var p = item.getMediaPath();
        if (p) { return String(p); }
      }
    } catch (ignore) {}
    return '';
  }

  function _isProbablyMediaProjectItem(item) {
    try {
      if (!item) { return false; }
      if (item.children && item.children.numItems !== undefined && item.children.numItems > 0) { return false; }
      if (item.getMediaPath) { return true; }
    } catch (ignore) {}
    return false;
  }

  function _isOfflineItem(item, mediaPath) {
    try {
      if (item && item.isOffline && item.isOffline()) { return true; }
    } catch (ignore1) {}
    try {
      if (mediaPath && !_fileExists(mediaPath)) { return true; }
    } catch (ignore2) {}
    return false;
  }

  function _walkProjectItems(rootItem, out, logs) {
    var stack = [];
    try { if (rootItem) { stack.push(rootItem); } } catch (ignore0) {}
    while (stack.length > 0) {
      var item = stack.pop();
      if (!item) { continue; }
      try {
        if (item.children && item.children.numItems !== undefined) {
          for (var i = 0; i < item.children.numItems; i++) {
            try { stack.push(item.children[i]); } catch (ignore1) {}
          }
        }
      } catch (ignore2) {}
      try {
        if (_isProbablyMediaProjectItem(item)) {
          var p = _safeMediaPath(item);
          if (_isOfflineItem(item, p)) {
            var n = p ? _basename(p) : _safeName(item);
            if (!_hasExt(n)) {
              // If Premiere only exposes a display name without extension, keep it,
              // but it will be matched less reliably.
              n = _safeName(item) || n;
            }
            if (n) {
              out.push({ item: item, name: n, key: _lower(n), oldPath: p, displayName: _safeName(item) });
            }
          }
        }
      } catch (e) {
        _push(logs, 'WARN project item skipped: ' + _moErr(e));
      }
    }
  }



  function _jsonEscape(s) {
    s = String(s == null ? '' : s);
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  }

  function _offlineListToJson(offline, logs) {
    var out = '{"ok":true,"offline":[';
    for (var i = 0; i < offline.length; i++) {
      if (i > 0) { out += ','; }
      out += '{"name":"' + _jsonEscape(offline[i].name) + '","key":"' + _jsonEscape(offline[i].key) + '","oldPath":"' + _jsonEscape(offline[i].oldPath) + '","displayName":"' + _jsonEscape(offline[i].displayName) + '"}';
    }
    out += '],"logs":[';
    for (var j = 0; j < logs.length; j++) {
      if (j > 0) { out += ','; }
      out += '"' + _jsonEscape(logs[j]) + '"';
    }
    out += ']}';
    return out;
  }

  function _parseJsonSafe(jsonText) {
    try {
      if (typeof JSON !== 'undefined' && JSON && JSON.parse) { return JSON.parse(String(jsonText || '{}')); }
    } catch (ignore1) {}
    try { return eval('(' + String(jsonText || '{}') + ')'); } catch (ignore2) {}
    return {};
  }

  function _addTarget(targetMap, offline) {
    if (!targetMap[offline.key]) { targetMap[offline.key] = []; }
    targetMap[offline.key].push(offline);
  }

  function _tryRelink(offline, fileObj, logs) {
    if (!offline || !offline.item || !fileObj) { return false; }
    var newPath = '';
    try { newPath = fileObj.fsName; } catch (ignore) {}
    if (!newPath) { return false; }
    try {
      if (offline.item.changeMediaPath) {
        var ret = offline.item.changeMediaPath(newPath, true);
        _push(logs, 'RELINK attempt: ' + offline.name + ' -> ' + newPath + ' | return=' + ret);
        try {
          if (offline.item.isOffline && offline.item.isOffline()) {
            _push(logs, 'WARN still offline after relink: ' + offline.name);
            return false;
          }
        } catch (ignore2) {}
        return true;
      }
      _push(logs, 'WARN item has no changeMediaPath(): ' + offline.name);
      return false;
    } catch (e) {
      _push(logs, 'ERROR relink failed: ' + offline.name + ' -> ' + newPath + ' | ' + _moErr(e));
      return false;
    }
  }

  AEDRNO.getOfflineMediaListForCEP = function () {
    var logs = [];
    var offline = [];
    try {
      _push(logs, 'Media Offline list scan START');
      if (!app || !app.project || !app.project.rootItem) {
        return '{"ok":false,"error":"No active Premiere project","offline":[],"logs":["Media Offline ERROR: no active Premiere project"]}';
      }
      _walkProjectItems(app.project.rootItem, offline, logs);
      _push(logs, 'Offline/missing project items detected: ' + offline.length);
      for (var i = 0; i < offline.length; i++) {
        _push(logs, 'MISSING: ' + offline[i].name + (offline[i].oldPath ? ' | old=' + offline[i].oldPath : ''));
      }
      return _offlineListToJson(offline, logs);
    } catch (e) {
      return '{"ok":false,"error":"' + _jsonEscape(_moErr(e)) + '","offline":[],"logs":["FATAL getOfflineMediaListForCEP: ' + _jsonEscape(_moErr(e)) + '"]}';
    }
  };

  AEDRNO.relinkOfflineMediaFromMap = function (candidateMapJson) {
    var logs = [];
    var offline = [];
    var targetMap = {};
    var relinked = 0;
    var failed = 0;
    var notFound = 0;
    var started = (new Date()).getTime();
    try {
      _push(logs, 'Media Offline Relink from CEP scan START');
      _walkProjectItems(app.project.rootItem, offline, logs);
      for (var i = 0; i < offline.length; i++) { _addTarget(targetMap, offline[i]); }
      var candidateMap = _parseJsonSafe(candidateMapJson);
      for (var k in targetMap) {
        if (!targetMap.hasOwnProperty(k)) { continue; }
        var list = targetMap[k];
        var newPath = candidateMap && candidateMap[k] ? String(candidateMap[k]) : '';
        if (!newPath) {
          for (var nf = 0; nf < list.length; nf++) {
            notFound++;
            _push(logs, 'NOT FOUND: ' + list[nf].name + (list[nf].oldPath ? ' | old=' + list[nf].oldPath : ''));
          }
          continue;
        }
        var fileObj = new File(newPath);
        if (!fileObj.exists) {
          for (var ex = 0; ex < list.length; ex++) {
            failed++;
            _push(logs, 'ERROR candidate no longer exists: ' + list[ex].name + ' -> ' + newPath);
          }
          continue;
        }
        for (var j = 0; j < list.length; j++) {
          if (_tryRelink(list[j], fileObj, logs)) { relinked++; }
          else { failed++; }
        }
      }
      var elapsed = (new Date()).getTime() - started;
      _push(logs, 'SUMMARY: offline=' + offline.length + ', relinked=' + relinked + ', notFound=' + notFound + ', failed=' + failed + ', elapsedMs=' + elapsed);
      _push(logs, 'Media Offline Relink from CEP scan END');
      return logs.join('\n');
    } catch (e) {
      _push(logs, 'FATAL relinkOfflineMediaFromMap: ' + _moErr(e));
      return logs.join('\n');
    }
  };

}());
