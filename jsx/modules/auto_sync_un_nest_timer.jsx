/* Auto-Sync plików pomiędzy BIN'em, a folderem systemowym */
AEDRNO = AEDRNO || {};
(function () {
  var BIN_TYPE = 2;

  function safeString(v) {
    try { return String(v || ''); } catch (e) { return ''; }
  }

  function normalizePath(p) {
    var s = safeString(p).replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/g, '');
    return s.toLowerCase();
  }

  function isBin(item) {
    try { return item && item.type === BIN_TYPE; } catch (e) { return false; }
  }

  function findChildBin(parent, name) {
    if (!parent || !parent.children) { return null; }
    for (var i = 0; i < parent.children.numItems; i++) {
      var child = parent.children[i];
      if (isBin(child) && child.name === name) { return child; }
    }
    return null;
  }

  function ensureRootBin(name, report) {
    var root = app.project.rootItem;
    var bin = findChildBin(root, name);
    if (bin) { return bin; }
    try {
      bin = root.createBin(name);
      if (report) { report.created = true; }
      return bin;
    } catch (e) {
      if (report) { report.error = 'Nie udało się utworzyć BIN-u: ' + e; }
      return null;
    }
  }

  function getMediaPath(item) {
    try {
      if (item && item.getMediaPath) { return item.getMediaPath() || ''; }
    } catch (e) {}
    return '';
  }

  function collectBinMediaPaths(parent, map) {
    if (!parent || !parent.children) { return; }
    for (var i = 0; i < parent.children.numItems; i++) {
      var child = parent.children[i];
      if (isBin(child)) {
        collectBinMediaPaths(child, map);
      } else {
        var p = normalizePath(getMediaPath(child));
        if (p) { map[p] = true; }
      }
    }
  }

  function collectItemsByPath(parent, pathMap, out) {
    if (!parent || !parent.children) { return; }
    for (var i = 0; i < parent.children.numItems; i++) {
      var child = parent.children[i];
      if (isBin(child)) {
        collectItemsByPath(child, pathMap, out);
      } else {
        var p = normalizePath(getMediaPath(child));
        if (p && pathMap[p]) { out.push(child); }
      }
    }
  }


  function collectAllMediaItems(parent, out) {
    if (!parent || !parent.children) { return; }
    for (var i = 0; i < parent.children.numItems; i++) {
      var child = parent.children[i];
      if (isBin(child)) {
        collectAllMediaItems(child, out);
      } else {
        out.push(child);
      }
    }
  }

  function fileBaseNameNoExt(path) {
    var s = safeString(path).replace(/\\/g, '/');
    var name = s.substring(s.lastIndexOf('/') + 1);
    var dot = name.lastIndexOf('.');
    if (dot > 0) { name = name.substring(0, dot); }
    return safeString(name).toLowerCase();
  }

  function itemBaseNameNoExt(item) {
    var p = getMediaPath(item);
    if (p) { return fileBaseNameNoExt(p); }
    var n = item && item.name ? safeString(item.name) : '';
    var dot = n.lastIndexOf('.');
    if (dot > 0) { n = n.substring(0, dot); }
    return n.toLowerCase();
  }

  function collectBinMediaBaseNames(parent, map) {
    if (!parent || !parent.children) { return; }
    for (var i = 0; i < parent.children.numItems; i++) {
      var child = parent.children[i];
      if (isBin(child)) {
        collectBinMediaBaseNames(child, map);
      } else {
        var b = itemBaseNameNoExt(child);
        if (b) { map[b] = true; }
      }
    }
  }

  function collectDuplicateLikeItemsForDiskFiles(parent, diskBaseMap, out) {
    if (!parent || !parent.children) { return; }
    for (var i = 0; i < parent.children.numItems; i++) {
      var child = parent.children[i];
      if (isBin(child)) {
        collectDuplicateLikeItemsForDiskFiles(child, diskBaseMap, out);
      } else {
        var b = itemBaseNameNoExt(child);
        if (b && diskBaseMap[b]) { out.push(child); }
      }
    }
  }

  function collectItemsByBaseName(parent, outMap) {
    if (!parent || !parent.children) { return; }
    for (var i = 0; i < parent.children.numItems; i++) {
      var child = parent.children[i];
      if (isBin(child)) {
        collectItemsByBaseName(child, outMap);
      } else {
        var b = itemBaseNameNoExt(child);
        if (b) {
          if (!outMap[b]) { outMap[b] = []; }
          outMap[b].push(child);
        }
      }
    }
  }

  function relinkProjectItemToPath(item, newPath) {
    try {
      if (!item || !newPath) { return false; }
      if (item.changeMediaPath) {
        var ok = item.changeMediaPath(newPath, 1);
        return ok === true || ok === 0 || ok === undefined;
      }
    } catch (e1) {}
    try {
      if (item && item.setOfflineMediaPath) {
        var ok2 = item.setOfflineMediaPath(newPath);
        return ok2 === true || ok2 === 0 || ok2 === undefined;
      }
    } catch (e2) {}
    return false;
  }


  function supportedFile(path) {
    var s = safeString(path).toLowerCase();
    if (!s || s.charAt(0) === '.') { return false; }
    return /\.(mov|mp4|m4v|mxf|avi|mpg|mpeg|webm|wmv|mts|m2ts|wav|mp3|aif|aiff|aac|flac|jpg|jpeg|png|tif|tiff|psd|gif|bmp|heic|heif|webp|pdf|ai|eps)$/i.test(s);
  }

  function decodeNamePart(name) {
    var s = safeString(name);
    try { s = decodeURIComponent(s); } catch (e1) {
      try { s = decodeURI(s); } catch (e2) {}
    }
    return s;
  }

  function cleanRelDir(path) {
    var s = safeString(path).replace(/\\/g, '/').replace(/\/+$/g, '');
    if (!s || s === '.' || s === '/') { return ''; }
    var parts = s.split('/');
    var clean = [];
    for (var i = 0; i < parts.length; i++) {
      var part = decodeNamePart(parts[i]);
      if (part && part !== '.' && part !== '..') { clean.push(part); }
    }
    return clean.join('/');
  }

  function splitRelDir(relDir) {
    relDir = cleanRelDir(relDir);
    if (!relDir) { return []; }
    var raw = relDir.split('/');
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var part = safeString(raw[i]);
      if (part && part !== '.' && part !== '..') { out.push(part); }
    }
    return out;
  }


  function isSystemMetadataName(name, isFolder) {
    name = decodeNamePart(name || '');
    var lower = safeString(name).toLowerCase();
    if (!lower) { return true; }

    // macOS AppleDouble/resource-fork metadata, visible on Windows as fake media files.
    if (lower.indexOf('._') === 0) { return true; }

    // macOS / Windows metadata files that should never be imported to Premiere.
    if (lower === '.ds_store' || lower === 'thumbs.db' || lower === 'desktop.ini') { return true; }
    if (lower === '.localized' || lower === 'icon' || lower === 'icon?') { return true; }

    // Hidden/system folders commonly created on external drives.
    if (isFolder) {
      if (lower === '__macosx' || lower === '.spotlight-v100' || lower === '.trashes' || lower === '.fseventsd') { return true; }
      if (lower === 'system volume information' || lower === '$recycle.bin') { return true; }
    }

    // General hidden dot files/folders are normally metadata/config, not montage media.
    if (lower.charAt(0) === '.') { return true; }

    return false;
  }

  function ensureBinPath(parent, relDir, colorLabel) {
    var parts = splitRelDir(relDir);
    var current = parent;
    for (var i = 0; i < parts.length; i++) {
      var child = findChildBin(current, parts[i]);
      if (!child) {
        try { child = current.createBin(parts[i]); } catch (e) { return current; }
      }
      setColorLabelSafe(child, colorLabel);
      current = child;
    }
    return current;
  }

  function collectDiskFiles(folder, out, includeSubfolders, relDir) {
    // includeSubfolders steruje tylko strukturą BIN-ów, nie samym skanowaniem.
    // Włącz: pliki z podfolderów trafiają do BIN-ów według struktury folderów.
    // Wyłącz: pliki z podfolderów też są skanowane, ale trafiają płasko do głównego BIN-u.
    relDir = includeSubfolders ? cleanRelDir(relDir) : '';
    var entries;
    try { entries = folder.getFiles(); } catch (e) { return; }
    for (var i = 0; entries && i < entries.length; i++) {
      var entry = entries[i];
      try {
        if (entry instanceof Folder) {
          var childName = decodeNamePart(entry.displayName || entry.name);
          if (isSystemMetadataName(childName, true)) { continue; }
          var childRel = includeSubfolders ? (relDir ? (relDir + '/' + childName) : childName) : '';
          collectDiskFiles(entry, out, includeSubfolders, childRel);
        } else if (entry instanceof File) {
          var fileName = decodeNamePart(entry.displayName || entry.name);
          if (isSystemMetadataName(fileName, false)) { continue; }
          var path = entry.fsName || entry.fullName;
          if (supportedFile(path)) { out.push({ path: path, relDir: includeSubfolders ? relDir : '' }); }
        }
      } catch (ignore) {}
    }
  }

  function getColorLabelSafe(item) {
    try {
      if (item && item.getColorLabel) {
        var v = item.getColorLabel();
        var n = Number(v);
        if (!isNaN(n)) { return n; }
      }
    } catch (e) {}
    return null;
  }

  function setColorLabelSafe(item, colorLabel) {
    try {
      var n = Number(colorLabel);
      if (isNaN(n) || n < 0) { return false; }
      if (!item || !item.setColorLabel) { return false; }

      // Undo guard: Premiere zapisuje setColorLabel jako osobną akcję w historii
      // nawet wtedy, gdy kolor wizualnie już jest taki sam. Dlatego najpierw
      // czytamy aktualny label i nie wykonujemy setColorLabel bez potrzeby.
      var current = getColorLabelSafe(item);
      if (current !== null && current === n) { return false; }

      item.setColorLabel(n);
      return true;
    } catch (e) {}
    return false;
  }


  AEDRNO.selectFolderDialog = function () {
    try {
      var f = Folder.selectDialog('Wskaż nową ścieżkę folderu Auto-Sync');
      if (f && f.exists) { return f.fsName || f.fullName || ''; }
    } catch (e) {
      return '__CANCEL__';
    }
    return '__CANCEL__';
  };

  AEDRNO.syncSystemFolder = function (folderPath, binName, colorLabel, includeSubfolders, relinkMode, forceColorApply) {
    if (!app || !app.project || !app.project.rootItem) {
      return 'Auto-Sync: Nie widzę otwartego projektu Premiere.';
    }

    folderPath = safeString(folderPath);
    binName = safeString(binName) || 'Auto-Sync';
    includeSubfolders = includeSubfolders === true || safeString(includeSubfolders) === 'true';
    relinkMode = relinkMode === true || safeString(relinkMode) === 'true';
    forceColorApply = forceColorApply === true || safeString(forceColorApply) === 'true';
    var folder = new Folder(folderPath);
    if (!folder.exists) {
      return 'Auto-Sync: folder nie istnieje albo Premiere nie ma do niego dostępu: ' + folderPath;
    }

    var report = { created: false, error: '' };
    var targetBin = ensureRootBin(binName, report);
    if (!targetBin) { return report.error || ('Auto-Sync: nie udało się znaleźć/stworzyć BIN-u: ' + binName); }
    if (report.created || forceColorApply) { setColorLabelSafe(targetBin, colorLabel); }

    var existing = {};
    collectBinMediaPaths(targetBin, existing);
    var existingBaseNames = {};
    collectBinMediaBaseNames(targetBin, existingBaseNames);

    var diskFiles = [];
    collectDiskFiles(folder, diskFiles, includeSubfolders, "");

    var diskBaseMap = {};
    for (var db = 0; db < diskFiles.length; db++) {
      var bname = fileBaseNameNoExt(diskFiles[db].path);
      if (bname) { diskBaseMap[bname] = true; }
    }

    var relinkedExisting = 0;
    var removedDuplicates = 0;
    if (relinkMode) {
      var byBase = {};
      collectItemsByBaseName(targetBin, byBase);
      for (var rb = 0; rb < diskFiles.length; rb++) {
        var diskForRelink = diskFiles[rb];
        var relinkBase = fileBaseNameNoExt(diskForRelink.path);
        var candidates = byBase[relinkBase] || [];
        for (var rc = 0; rc < candidates.length; rc++) {
          var currentPath = normalizePath(getMediaPath(candidates[rc]));
          var newPathNorm = normalizePath(diskForRelink.path);
          if (currentPath !== newPathNorm && relinkProjectItemToPath(candidates[rc], diskForRelink.path)) {
            relinkedExisting++;
            break;
          }
        }
      }
      existing = {};
      collectBinMediaPaths(targetBin, existing);
      existingBaseNames = {};
      collectBinMediaBaseNames(targetBin, existingBaseNames);
    }

    var newFiles = [];
    var newMap = {};
    for (var i = 0; i < diskFiles.length; i++) {
      var diskItem = diskFiles[i];
      var key = normalizePath(diskItem.path);
      var baseKey = fileBaseNameNoExt(diskItem.path);
      var alreadyThere = existing[key];
      var suppressByBase = (!relinkMode && existingBaseNames[baseKey]);
      if (key && !alreadyThere && !suppressByBase && !newMap[key]) {
        newFiles.push(diskItem);
        newMap[key] = true;
      }
    }

    var imported = 0;
    var failed = 0;
    if (newFiles.length) {
      var groups = {};
      var groupOrder = [];
      for (var g = 0; g < newFiles.length; g++) {
        var rel = includeSubfolders ? cleanRelDir(newFiles[g].relDir) : '';
        if (!groups[rel]) { groups[rel] = []; groupOrder.push(rel); }
        groups[rel].push(newFiles[g].path);
      }

      for (var go = 0; go < groupOrder.length; go++) {
        var relDir = groupOrder[go];
        var importBin = includeSubfolders ? ensureBinPath(targetBin, relDir, colorLabel) : targetBin;
        var paths = groups[relDir];
        var groupImported = 0;
        try {
          var ok = app.project.importFiles(paths, true, importBin, false);
          if (ok) { groupImported = paths.length; imported += paths.length; }
        } catch (batchError) {}

        if (groupImported === 0) {
          for (var n = 0; n < paths.length; n++) {
            try {
              if (app.project.importFiles([paths[n]], true, importBin, false)) { imported++; }
              else { failed++; }
            } catch (singleError) { failed++; }
          }
        }
      }
    }

    if (Number(colorLabel) >= 0) {
      // Normalny auto-tick nie może co 5 sekund przemalowywać całego BIN-u, bo
      // Premiere zasypuje wtedy historię akcjami "Change Project Item Label Color...".
      // Przy zwykłym Auto-Sync kolorujemy tylko nowo zaimportowane pliki.
      // Pełne przemalowanie istniejących itemów robimy wyłącznie po ręcznej zmianie
      // koloru w panelu, kiedy main.js przekazuje forceColorApply=true.
      if (forceColorApply || newFiles.length) {
        var allItemsForColor = [];
        collectAllMediaItems(targetBin, allItemsForColor);
        for (var c = 0; c < allItemsForColor.length; c++) {
          var mediaPathForColor = normalizePath(getMediaPath(allItemsForColor[c]));
          if (forceColorApply || (mediaPathForColor && newMap[mediaPathForColor])) {
            setColorLabelSafe(allItemsForColor[c], colorLabel);
          }
        }
      }
    }

    var msg = 'Auto-Sync folderu: ' + binName + '\n';
    if (report.created) { msg += 'Utworzono BIN: ' + binName + '\n'; }
    msg += 'Folder: ' + folderPath + '\n';
    msg += 'Synchronizacja podfolderów: ' + (includeSubfolders ? 'Włącz' : 'Wyłącz') + '\n';
    msg += 'Pliki na dysku: ' + diskFiles.length + '\n';
    if (relinkMode) { msg += 'Ponowne wskazanie folderu: zaktualizowano ścieżki istniejących mediów: ' + relinkedExisting + '\n'; }
    msg += 'Dodano pliki: ' + imported + ' / nowe: ' + newFiles.length;
    if (failed) { msg += ' / błędy: ' + failed; }
    if (!newFiles.length && !report.created) { msg += '\nBrak nowych plików.'; }
    return msg;
  };

  /* ── UN NEST helpers v1.12.10 ── */
  function debugPush(arr, msg) {
    try { if (arr) { arr.push(String(msg)); } } catch (e) {}
  }

  function _ssTicks(timeObj) {
    try {
      if (timeObj && timeObj.ticks !== undefined && timeObj.ticks !== null) { return Number(timeObj.ticks) || 0; }
      if (timeObj && timeObj.seconds !== undefined && timeObj.seconds !== null) { return Math.round((Number(timeObj.seconds) || 0) * 254016000000); }
      if (typeof timeObj === 'number') { return Number(timeObj) || 0; }
      var n = Number(timeObj);
      if (!isNaN(n)) { return n; }
    } catch (e) {}
    return 0;
  }

  function makeTime(ticks) {
    var t = new Time();
    t.ticks = String(Math.round(Number(ticks) || 0));
    return t;
  }


  /* ── UN NEST: rozpakowanie zaznaczonej sekwencji NEST ── */
  function _unSeqByProjectItem(projectItem) {
    try {
      if (!projectItem || !app.project || !app.project.sequences) { return null; }
      for (var i = 0; i < app.project.sequences.numSequences; i++) {
        var seq = app.project.sequences[i];
        if (seq && seq.projectItem === projectItem) { return seq; }
      }
      // fallback po nazwie; używany tylko jeśli porównanie obiektu zawiedzie
      for (var j = 0; j < app.project.sequences.numSequences; j++) {
        var seq2 = app.project.sequences[j];
        try {
          if (seq2 && seq2.projectItem && seq2.projectItem.name === projectItem.name) { return seq2; }
        } catch (e2) {}
      }
    } catch (e) {}
    return null;
  }

  function _unFindTrackItemLocation(seq, targetClip) {
    try {
      var t, i, c, cnt;
      if (seq && seq.videoTracks) {
        for (t = 0; t < seq.videoTracks.numTracks; t++) {
          cnt = _unTrackItemCount(seq.videoTracks[t]);
          for (i = 0; i < cnt; i++) {
            c = _unClipAt(seq.videoTracks[t], i);
            try { if (c === targetClip) { return { type: 'V', index: t }; } } catch (e0) {}
          }
        }
      }
      if (seq && seq.audioTracks) {
        for (t = 0; t < seq.audioTracks.numTracks; t++) {
          cnt = _unTrackItemCount(seq.audioTracks[t]);
          for (i = 0; i < cnt; i++) {
            c = _unClipAt(seq.audioTracks[t], i);
            try { if (c === targetClip) { return { type: 'A', index: t }; } } catch (e1) {}
          }
        }
      }
    } catch (e) {}
    return { type: '', index: 0 };
  }

  function _unSelectedNestClip(seq, dbg) {
    try {
      var sel = seq.getSelection();
      if (!sel || !sel.length) { return null; }
      for (var i = 0; i < sel.length; i++) {
        var clip = sel[i];
        if (!clip || !clip.projectItem) { continue; }
        var nestedSeq = _unSeqByProjectItem(clip.projectItem);
        if (nestedSeq) {
          var loc = _unFindTrackItemLocation(seq, clip);
          var locTxt = loc && loc.type ? (loc.type + String((loc.index || 0) + 1)) : 'nieznana ścieżka';
          debugPush(dbg, 'Znaleziono zaznaczony NEST: "' + clip.name + '" -> sekwencja "' + nestedSeq.name + '" na ' + locTxt);
          return { clip: clip, nestedSeq: nestedSeq, projectItem: clip.projectItem, location: loc };
        }
      }
    } catch (e) { debugPush(dbg, 'Błąd odczytu zaznaczenia timeline: ' + e); }
    return null;
  }

  function _unTrackItemCount(track) {
    try { return track.clips ? track.clips.numItems : 0; } catch (e) {}
    return 0;
  }

  function _unClipAt(track, index) {
    try { return track.clips[index]; } catch (e) {}
    return null;
  }


  function _unTimelineEndTicks(clip) {
    var st = 0;
    var en = 0;
    try { st = _ssTicks(clip.start); } catch (e0) { st = 0; }
    try { en = _ssTicks(clip.end); } catch (e1) { en = 0; }
    if (en > st) { return en; }
    var d = 0;
    try { d = _ssTicks(clip.duration); } catch (e2) { d = 0; }
    if (!d || d <= 0) {
      try { d = _ssTicks(clip.outPoint) - _ssTicks(clip.inPoint); } catch (e3) { d = 0; }
    }
    return st + (d > 0 ? d : 1);
  }

  function _unNestSourceWindow(nestClip, parentStart, dbg) {
    // Okno źródłowe mówi, który fragment sekwencji NEST jest faktycznie widoczny
    // w zaznaczonym klipie na głównej timeline. To jest kluczowe przy multicamach i długich nested sequences.
    var parentEnd = 0;
    var parentDur = 0;
    var sourceIn = 0;
    var sourceOut = 0;
    try { parentEnd = _ssTicks(nestClip.end); } catch (e0) { parentEnd = 0; }
    parentDur = parentEnd > parentStart ? (parentEnd - parentStart) : 0;
    if (!parentDur || parentDur <= 0) { parentDur = _unClipDurationTicks(nestClip); }
    try { sourceIn = _ssTicks(nestClip.inPoint); } catch (e1) { sourceIn = 0; }
    try { sourceOut = _ssTicks(nestClip.outPoint); } catch (e2) { sourceOut = 0; }
    if (!sourceOut || sourceOut <= sourceIn) {
      sourceOut = sourceIn + (parentDur > 0 ? parentDur : 1);
    }
    debugPush(dbg, 'Okno źródłowe NEST: in=' + sourceIn + ', out=' + sourceOut + ', duration=' + (sourceOut - sourceIn) + '.');
    return { sourceIn: sourceIn, sourceOut: sourceOut, duration: sourceOut - sourceIn };
  }


  function _unClipDurationTicks(clip) {
    // Uzywane tylko do inteligentnego zabezpieczania sciezek przed overwrite.
    // Staramy sie policzyc realny czas trwania klipu z NEST-a, z kilkoma fallbackami.
    var d = 0;
    try { d = _ssTicks(clip.duration); } catch (e0) { d = 0; }
    if (!d || d <= 0) {
      try { d = _ssTicks(clip.outPoint) - _ssTicks(clip.inPoint); } catch (e1) { d = 0; }
    }
    if (!d || d <= 0) {
      try { d = _ssTicks(clip.end) - _ssTicks(clip.start); } catch (e2) { d = 0; }
    }
    return d > 0 ? d : 0;
  }


  function _unRemoveClipNoRipple(clip, dbg) {
    try { clip.remove(0, 0); debugPush(dbg, 'Usunięto klip NEST z timeline.'); return true; } catch (e1) {}
    try { clip.remove(false, false); debugPush(dbg, 'Usunięto klip NEST z timeline.'); return true; } catch (e2) {}
    try { clip.remove(); debugPush(dbg, 'Usunięto klip NEST z timeline.'); return true; } catch (e3) { debugPush(dbg, 'Nie udało się usunąć klipu NEST z timeline: ' + e3); }
    return false;
  }

  function _unBoolish(value) {
    try {
      if (value === true || value === 1) { return true; }
      if (value === false || value === 0 || value === null || value === undefined) { return false; }
      var s = String(value).toLowerCase();
      return (s === 'true' || s === '1' || s === 'yes');
    } catch (e) {}
    return false;
  }


  function _unFindMatchingAudioBaseTrack(seq, nestClip, projectItem, parentStart, dbg) {
    // Dla NEST-ów audio-only zaznaczony TrackItem potrafi zgłaszać parentTrackIndex z video albo w ogóle nie mówić,
    // na której ścieżce audio leżał NEST. Szukamy więc odpowiadającego klipu NEST w audioTracks głównej sekwencji.
    try {
      var n = seq.audioTracks ? seq.audioTracks.numTracks : 0;
      var targetName = '';
      try { targetName = projectItem && projectItem.name ? String(projectItem.name) : ''; } catch (n0) {}
      var tolerance = 254016000000; // ok. 1 sekunda
      for (var a = 0; a < n; a++) {
        var tr = seq.audioTracks[a];
        var count = _unTrackItemCount(tr);
        for (var i = 0; i < count; i++) {
          var c = _unClipAt(tr, i);
          if (!c) { continue; }
          var sameItem = false;
          try { sameItem = (c.projectItem === projectItem); } catch (pi0) { sameItem = false; }
          if (!sameItem) {
            try { sameItem = (c.projectItem && targetName && c.projectItem.name === targetName); } catch (pi1) { sameItem = false; }
          }
          if (!sameItem) { continue; }
          var st = 0;
          try { st = _ssTicks(c.start); } catch (stErr) { st = 0; }
          if (Math.abs(st - parentStart) <= tolerance) {
            debugPush(dbg, 'Znaleziono odpowiadający klip NEST na audio tracku głównej sekwencji: A' + (a + 1));
            return a;
          }
        }
      }
    } catch (e) { debugPush(dbg, 'Nie udało się znaleźć audio base track NEST-a: ' + e); }
    return null;
  }


  function _unJsonEsc(s) {
    s = String(s === undefined || s === null ? '' : s);
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n');
  }

  function _unJsonValue(v) {
    if (v === null || v === undefined) { return 'null'; }
    if (typeof v === 'number') { return isFinite(v) ? String(Math.round(v)) : '0'; }
    if (typeof v === 'boolean') { return v ? 'true' : 'false'; }
    if (typeof v === 'string') { return '"' + _unJsonEsc(v) + '"'; }
    if (v instanceof Array) {
      var arr = [];
      for (var i = 0; i < v.length; i++) { arr.push(_unJsonValue(v[i])); }
      return '[' + arr.join(',') + ']';
    }
    var parts = [];
    for (var k in v) {
      try { if (v.hasOwnProperty && !v.hasOwnProperty(k)) { continue; } } catch (h) {}
      parts.push('"' + _unJsonEsc(k) + '":' + _unJsonValue(v[k]));
    }
    return '{' + parts.join(',') + '}';
  }

  function _unParseJson(s) {
    try { if (JSON && JSON.parse) { return JSON.parse(String(s || '')); } } catch (e0) {}
    try { return eval('(' + String(s || '') + ')'); } catch (e1) {}
    return null;
  }

  function _unFindSequenceByName(name) {
    try {
      if (!name || !app || !app.project || !app.project.sequences) { return null; }
      for (var i = 0; i < app.project.sequences.numSequences; i++) {
        var seq = app.project.sequences[i];
        try { if (seq && seq.name === name) { return seq; } } catch (e0) {}
      }
    } catch (e) {}
    return null;
  }


  function _unTryCall(obj, names, args) {
    if (!obj || !names) { return { ok: false, value: null, name: '' }; }
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      try {
        if (obj[n] === undefined || obj[n] === null) { continue; }
        if (typeof obj[n] === 'function') {
          var v = obj[n].apply(obj, args || []);
          return { ok: true, value: v, name: n };
        }
        if (!args || !args.length) {
          return { ok: true, value: obj[n], name: n };
        }
      } catch (e) {}
    }
    return { ok: false, value: null, name: '' };
  }


  function _unReadMulticamEnabled(clip) {
    var names = [
      'isMulticam', 'isMultiCam', 'isMulticamClip', 'isMultiCamClip',
      'isMulticamEnabled', 'isMultiCamEnabled', 'isMultiCamera', 'isMultiCameraEnabled',
      'isMultiCamOn', 'isMulticamOn', 'getIsMulticam', 'getIsMultiCam',
      'getIsMulticamEnabled', 'getIsMultiCamEnabled', 'getMulticamEnabled', 'getMultiCamEnabled',
      'multicam', 'multiCam', 'multicamEnabled', 'multiCamEnabled', 'multiCameraEnabled'
    ];
    var r = _unTryCall(clip, names, []);
    if (r.ok) { return _unBoolish(r.value); }
    try { if (clip && clip.projectItem) { var r2 = _unTryCall(clip.projectItem, names, []); if (r2.ok) { return _unBoolish(r2.value); } } } catch (e) {}
    return false;
  }

  function _unNameLooksLikeMulticam(value) {
    try { return /multi\s*cam|multicam|mutlicam|multi[-_ ]?camera/i.test(String(value || '')); } catch (e) {}
    return false;
  }

  function _unReadMulticamSignalVerbose(obj, label, dbg) {
    if (!obj) { return false; }
    var names = [
      'isMulticam', 'isMultiCam', 'isMulticamClip', 'isMultiCamClip',
      'isMulticamEnabled', 'isMultiCamEnabled', 'isMultiCamera', 'isMultiCameraEnabled',
      'isMultiCamOn', 'isMulticamOn', 'getIsMulticam', 'getIsMultiCam',
      'getIsMulticamEnabled', 'getIsMultiCamEnabled', 'getMulticamEnabled', 'getMultiCamEnabled',
      'multicam', 'multiCam', 'multicamEnabled', 'multiCamEnabled', 'multiCameraEnabled'
    ];
    try {
      var r = _unTryCall(obj, names, []);
      if (r.ok && _unBoolish(r.value)) {
        debugPush(dbg, 'Native UN NEST: multicam wykryty przez ' + (label || 'object') + '.' + r.name + ' => ' + r.value + '.');
        return true;
      }
    } catch (e0) {}
    try {
      if (obj.projectItem) {
        var r2 = _unTryCall(obj.projectItem, names, []);
        if (r2.ok && _unBoolish(r2.value)) {
          debugPush(dbg, 'Native UN NEST: multicam wykryty przez ' + (label || 'object') + '.projectItem.' + r2.name + ' => ' + r2.value + '.');
          return true;
        }
      }
    } catch (e1) {}
    return false;
  }

  function _unSequenceContainsMulticamSignal(seq, dbg) {
    try {
      if (!seq || !seq.videoTracks) { return false; }
      for (var vt = 0; vt < seq.videoTracks.numTracks; vt++) {
        var tr = seq.videoTracks[vt];
        var n = _unTrackItemCount(tr);
        for (var i = 0; i < n; i++) {
          var c = _unClipAt(tr, i);
          if (!c) { continue; }
          if (_unReadMulticamSignalVerbose(c, 'nestedSeq.V' + (vt + 1) + '.clip' + i, dbg)) { return true; }
          try { if (c.projectItem && _unNameLooksLikeMulticam(c.projectItem.name)) { debugPush(dbg, 'Native UN NEST: zrodlowa sekwencja zawiera klip/projektItem z nazwa multicam: "' + c.projectItem.name + '".'); return true; } } catch (n0) {}
        }
      }
    } catch (e) { debugPush(dbg, 'Native UN NEST: nie udalo sie sprawdzic zawartosci NEST-a pod multicam: ' + e); }
    return false;
  }

  function _unDetectNativeMulticamNest(nestClip, nestedSeq, dbg) {
    // Premiere nie zawsze udostepnia ten sam znacznik multicam w kazdej wersji.
    // Dlatego sprawdzamy kilka API/properties, a na koncu bezpieczny fallback po nazwie.
    try { if (_unReadMulticamSignalVerbose(nestClip, 'nestClip', dbg)) { return true; } } catch (e0) {}
    try { if (nestClip && nestClip.projectItem && _unReadMulticamSignalVerbose(nestClip.projectItem, 'nestClip.projectItem', dbg)) { return true; } } catch (e1) {}
    try { if (_unReadMulticamSignalVerbose(nestedSeq, 'nestedSeq', dbg)) { return true; } } catch (e2) {}
    try { if (nestedSeq && nestedSeq.projectItem && _unReadMulticamSignalVerbose(nestedSeq.projectItem, 'nestedSeq.projectItem', dbg)) { return true; } } catch (e3) {}
    try { if (_unSequenceContainsMulticamSignal(nestedSeq, dbg)) { return true; } } catch (e4) {}

    var n1 = '', n2 = '', n3 = '';
    try { n1 = String(nestClip && nestClip.name || ''); } catch (e5) {}
    try { n2 = String(nestClip && nestClip.projectItem && nestClip.projectItem.name || ''); } catch (e6) {}
    try { n3 = String(nestedSeq && nestedSeq.name || ''); } catch (e7) {}
    if (_unNameLooksLikeMulticam(n1) || _unNameLooksLikeMulticam(n2) || _unNameLooksLikeMulticam(n3)) {
      debugPush(dbg, 'Native UN NEST: zabezpieczenie - nazwa wskazuje na multicam (clip="' + n1 + '", projectItem="' + n2 + '", seq="' + n3 + '"). Nie usuwam sekwencji z Project Panelu.');
      return true;
    }
    return false;
  }

  function _unNativeShouldDeleteSourceSequence(nestClip, nestedSeq, dbg) {
    // Po natywnym UN NEST usuwamy z Project Panelu tylko zwykle sekwencje NEST.
    // Jezeli zaznaczony NEST jest multicamem albo zrodlowa sekwencja wyglada jak multicam, zostaje w projekcie.
    var isMulticamNest = false;
    try { isMulticamNest = !!_unDetectNativeMulticamNest(nestClip, nestedSeq, dbg); } catch (e0) { isMulticamNest = false; }
    if (isMulticamNest) {
      debugPush(dbg, 'Native UN NEST: NEST jest multicamem / multicam source sequence - NIE usuwam go z Project Panelu.');
      return false;
    }
    debugPush(dbg, 'Native UN NEST: to zwykly NEST bez multicam - po udanym wklejeniu usune sekwencje z Project Panelu.');
    return true;
  }

  function _unTryDeleteSourceSequenceAfterNative(seq, info, dbg) {
    try {
      if (info && info.isMulticamNest) {
        debugPush(dbg, 'Native UN NEST: payload oznaczony jako multicam - NIE usuwam sekwencji z Project Panelu.');
        return false;
      }
      if (!info || !info.deleteProjectSequenceAfterPaste) {
        debugPush(dbg, 'Native UN NEST: pomijam usuwanie sekwencji z Project Panelu, bo to multicam albo flaga delete=false.');
        return false;
      }
      if (!seq) { debugPush(dbg, 'Native UN NEST: brak sekwencji zrodlowej do usuniecia z Project Panelu.'); return false; }
      var seqName = '';
      try { seqName = String(seq.name || info.nestedSequenceName || ''); } catch (n0) { seqName = String(info.nestedSequenceName || ''); }
      if (!seqName) { debugPush(dbg, 'Native UN NEST: brak nazwy sekwencji zrodlowej do usuniecia.'); return false; }
      var piNameForDelete = '';
      try { piNameForDelete = String(info.nestProjectItemName || ''); } catch (pin0) {}
      var clipNameForDelete = '';
      try { clipNameForDelete = String(info.nestClipName || ''); } catch (pin1) {}
      var payloadSeqNameForDelete = '';
      try { payloadSeqNameForDelete = String(info.nestedSequenceName || ''); } catch (pin2) {}
      if (_unNameLooksLikeMulticam(seqName) || _unNameLooksLikeMulticam(piNameForDelete) || _unNameLooksLikeMulticam(clipNameForDelete) || _unNameLooksLikeMulticam(payloadSeqNameForDelete)) {
        debugPush(dbg, 'Native UN NEST: dodatkowy bezpiecznik przed delete - nazwa wskazuje multicam/mutlicam (seq="' + seqName + '", projectItem="' + piNameForDelete + '", clip="' + clipNameForDelete + '"). NIE usuwam sekwencji z Project Panelu.');
        return false;
      }
      try {
        if (_unDetectNativeMulticamNest(null, seq, dbg)) {
          debugPush(dbg, 'Native UN NEST: dodatkowy bezpiecznik przed delete - refetch sekwencji nadal wskazuje multicam. NIE usuwam sekwencji z Project Panelu.');
          return false;
        }
      } catch (detectDeleteErr) {}
      var ok = false;

      // Kluczowa poprawka v1.12.136:
      // app.project.deleteSequence() w Premiere oczekuje obiektu Sequence, nie nazwy string.
      // W v1.12.101 podawalismy seqName, co dawalo: Error: Illegal Parameter type.
      try {
        if (app && app.project && app.project.deleteSequence) {
          ok = app.project.deleteSequence(seq);
          debugPush(dbg, 'Native UN NEST: proba usuniecia zwyklego NEST-a z Project Panelu przez app.project.deleteSequence(Sequence: "' + seqName + '") => ' + ok + '.');
          if (ok === true || ok === 1) { return true; }
        }
      } catch (d0) { debugPush(dbg, 'Native UN NEST: app.project.deleteSequence(Sequence: "' + seqName + '") blad: ' + d0); }

      // Awaryjnie probujemy jeszcze raz po odnalezieniu sekwencji po ID/nazwie, bo po openSequence() referencja
      // potrafi byc stara albo niepelna. Dalej przekazujemy obiekt Sequence, nigdy string.
      try {
        var seq2 = _unFindSequenceByIdOrName(info && info.nestedSequenceId, seqName);
        if (seq2 && seq2 !== seq && app && app.project && app.project.deleteSequence) {
          ok = app.project.deleteSequence(seq2);
          debugPush(dbg, 'Native UN NEST: druga proba deleteSequence po refetch Sequence: "' + seqName + '" => ' + ok + '.');
          if (ok === true || ok === 1) { return true; }
        }
      } catch (d0b) { debugPush(dbg, 'Native UN NEST: druga proba deleteSequence po refetch blad: ' + d0b); }

      // Fallbacki dla roznych wersji Premiere. Nie konczymy sukcesem przy deleteBin(), bo logi pokazaly,
      // ze potrafi zwrocic true, ale nie usuwac zwyklej sekwencji z Project Panelu.
      try {
        if (seq.projectItem && seq.projectItem.remove) {
          seq.projectItem.remove();
          debugPush(dbg, 'Native UN NEST: fallback projectItem.remove() wykonany dla zwyklego NEST-a.');
          return true;
        }
      } catch (d1) { debugPush(dbg, 'Native UN NEST: projectItem.remove() zwyklego NEST-a blad: ' + d1); }
      try {
        if (seq.projectItem && seq.projectItem.deleteItem) {
          seq.projectItem.deleteItem();
          debugPush(dbg, 'Native UN NEST: fallback projectItem.deleteItem() wykonany dla zwyklego NEST-a.');
          return true;
        }
      } catch (d2) { debugPush(dbg, 'Native UN NEST: projectItem.deleteItem() zwyklego NEST-a blad: ' + d2); }
      try {
        if (seq.projectItem && seq.projectItem.deleteBin) {
          seq.projectItem.deleteBin();
          debugPush(dbg, 'Native UN NEST: fallback projectItem.deleteBin() wykonany, ale to moze nie usuwac zwyklej sekwencji.');
        }
      } catch (d3) { debugPush(dbg, 'Native UN NEST: deleteBin zwyklego NEST-a blad: ' + d3); }
      debugPush(dbg, 'Native UN NEST: UWAGA - nie udalo sie potwierdzic usuniecia zwyklego NEST-a z Project Panelu.');
    } catch (e) { debugPush(dbg, 'Native UN NEST: blad usuwania zwyklego NEST-a z Project Panelu: ' + e); }
    return false;
  }


  function _unFindCommandIdVerbose(names, dbg, label) {
    var out = [];
    try {
      if (!app || !app.findMenuCommandId || !names) { return { id: 0, tried: out.join(', ') }; }
      for (var i = 0; i < names.length; i++) {
        var nm = names[i];
        var id = 0;
        try { id = app.findMenuCommandId(nm); } catch (e0) { id = 0; }
        out.push(nm + '=' + id);
        if (id && id > 0) {
          debugPush(dbg, 'Cofnij UN NEST: znaleziono komendę ' + (label || '') + ': "' + nm + '" => ' + id + '.');
          return { id: id, name: nm, tried: out.join(', ') };
        }
      }
    } catch (e) { debugPush(dbg, 'Cofnij UN NEST: błąd szukania command id ' + (label || '') + ': ' + e); }
    debugPush(dbg, 'Cofnij UN NEST: nie znaleziono command id ' + (label || '') + '. Próby: ' + out.join(', '));
    return { id: 0, name: '', tried: out.join(', ') };
  }


  function _unTryPremiereUndoOnce(dbg) {
    try {
      if (app && typeof app.undo === 'function') {
        try { app.undo(); return true; } catch (e0) { debugPush(dbg, 'History Undo: app.undo() nie zadziałało: ' + e0); }
      }
      try { if (app && app.enableQE) { app.enableQE(); } } catch (qe0) {}
      try {
        if (qe && qe.project && typeof qe.project.undo === 'function') {
          qe.project.undo();
          return true;
        }
      } catch (e1) { debugPush(dbg, 'History Undo: qe.project.undo() nie zadziałało: ' + e1); }
      var undoCmd = _unFindCommandIdVerbose(['Undo', 'Cofnij'], dbg, 'Undo');
      try {
        if (undoCmd && undoCmd.id && app && app.executeCommand) {
          app.executeCommand(undoCmd.id);
          return true;
        }
      } catch (e2) { debugPush(dbg, 'History Undo: app.executeCommand(' + undoCmd.id + ') nie zadziałało: ' + e2); }
      try {
        if (app && app.executeCommand) {
          app.executeCommand(16);
          return true;
        }
      } catch (e3) { debugPush(dbg, 'History Undo: awaryjne executeCommand(16) nie zadziałało: ' + e3); }
    } catch (e) { debugPush(dbg, 'History Undo: błąd próby undo: ' + e); }
    return false;
  }


  function _unHistoryNamesForRestore(info) {
    var names = {};
    function add(v) {
      try {
        v = String(v || '');
        if (v) { names[v] = true; }
      } catch (e) {}
    }
    try { add(info.nestedSequenceName); } catch (e0) {}
    try { add(info.nestProjectItemName); } catch (e1) {}
    try { if (info.nestState) { add(info.nestState.clipName); add(info.nestState.projectItemName); } } catch (e2) {}
    return names;
  }

  function _unHistoryClipMatchesNames(clip, names) {
    try {
      var cn = String((clip && clip.name) || '');
      if (cn && names[cn]) { return true; }
    } catch (e0) {}
    try {
      var pn = String((clip && clip.projectItem && clip.projectItem.name) || '');
      if (pn && names[pn]) { return true; }
    } catch (e1) {}
    return false;
  }

  function _unHistoryFindClipOnTrack(seq, trackType, trackIndex, names, targetTicks) {
    var tolerance = 254016000000;
    try {
      var isAudio = String(trackType || 'V') === 'A';
      var tracks = isAudio ? seq.audioTracks : seq.videoTracks;
      if (!seq || !tracks || !tracks[trackIndex]) { return null; }
      var tr = tracks[trackIndex];
      var n = _unTrackItemCount(tr);
      for (var i = 0; i < n; i++) {
        var c = _unClipAt(tr, i);
        if (!c) { continue; }
        var st = 0;
        try { st = _ssTicks(c.start); } catch (s0) { st = 0; }
        if (Math.abs(st - targetTicks) > tolerance) { continue; }
        if (_unHistoryClipMatchesNames(c, names)) { return c; }
      }
    } catch (e) {}
    return null;
  }

  function _unHistoryFindClipOnVideoTrack(seq, trackIndex, names, targetTicks) {
    return _unHistoryFindClipOnTrack(seq, 'V', trackIndex, names, targetTicks);
  }


  function _unHistoryJobStillExistsOnTrack(seq, job, isVideo) {
    var tolerance = 254016000000;
    try {
      var trackIndex = isVideo ? Number(job.targetV) : Number(job.targetA);
      var tr = isVideo ? (seq.videoTracks && seq.videoTracks[trackIndex]) : (seq.audioTracks && seq.audioTracks[trackIndex]);
      if (!tr || !tr.clips) { return false; }
      var n = _unTrackItemCount(tr);
      for (var i = 0; i < n; i++) {
        var c = _unClipAt(tr, i);
        if (!c) { continue; }
        var st = 0;
        try { st = _ssTicks(c.start); } catch (s0) { st = 0; }
        if (Math.abs(st - Number(job.targetTicks || 0)) > tolerance) { continue; }
        var cn = '';
        var pn = '';
        try { cn = String(c.name || ''); } catch (n0) {}
        try { pn = c.projectItem ? String(c.projectItem.name || '') : ''; } catch (n1) {}
        var jn = String(job.name || '');
        var jin = String(job.itemName || '');
        if ((jn && (cn === jn || pn === jn)) || (jin && (pn === jin || cn === jin))) { return true; }
      }
    } catch (e) {}
    return false;
  }

  function _unHistoryExpandedClipsRemain(seq, info) {
    try {
      var vjobs = info.videoJobs || [];
      for (var v = 0; v < vjobs.length; v++) {
        if (_unHistoryJobStillExistsOnTrack(seq, vjobs[v], true)) { return true; }
      }
      var ajobs = info.audioJobs || [];
      for (var a = 0; a < ajobs.length; a++) {
        if (_unHistoryJobStillExistsOnTrack(seq, ajobs[a], false)) { return true; }
      }
    } catch (e) {}
    return false;
  }

  function _unHistoryTargetRestored(info, dbg, verbose) {
    try {
      var seq = app && app.project ? app.project.activeSequence : null;
      if (!seq) { return false; }
      var names = _unHistoryNamesForRestore(info);
      var baseV = Math.max(0, Number(info.baseV) || 0);
      var baseA = Math.max(0, Number(info.baseA) || 0);
      var primary = String(info.primaryTrackType || 'V');
      var parentStart = Number(info.parentStart) || 0;
      var restoredClip = null;
      if (primary === 'A') { restoredClip = _unHistoryFindClipOnTrack(seq, 'A', baseA, names, parentStart); }
      if (!restoredClip) { restoredClip = _unHistoryFindClipOnVideoTrack(seq, baseV, names, parentStart); }
      if (!restoredClip && primary !== 'A') { restoredClip = _unHistoryFindClipOnTrack(seq, 'A', baseA, names, parentStart); }
      if (!restoredClip) { return false; }
      if (_unHistoryExpandedClipsRemain(seq, info)) { return false; }
      if (verbose) {
        var lbl = '';
        try { if (restoredClip.getColorLabel) { lbl = String(restoredClip.getColorLabel()); } } catch (l0) {}
        if (!lbl) { try { if (restoredClip.projectItem && restoredClip.projectItem.getColorLabel) { lbl = String(restoredClip.projectItem.getColorLabel()); } } catch (l1) {} }
        debugPush(dbg, 'History Undo: wykryto przywrócony oryginalny NEST na ' + (primary === 'A' ? ('A' + (baseA + 1)) : ('V' + (baseV + 1))) + ' @ ' + parentStart + (lbl ? ' | label=' + lbl : '') + '. Zatrzymuję cofanie, żeby nie cofnąć wcześniejszych zmian użytkownika.');
      }
      return true;
    } catch (e) { if (verbose) { debugPush(dbg, 'History Undo: błąd sprawdzania stanu przywrócenia: ' + e); } }
    return false;
  }

  AEDRNO.undoLastUnNestByHistory = function (payloadJson) {
    var dbg = [];
    dbg.push('=== UN NEST History Undo v1.12.190 Native Copy/Paste ===');
    try {
      var info = _unParseJson(payloadJson);
      if (!info) { dbg.push('Nie udało się odczytać danych cofania UN NEST.'); return dbg.join('\n'); }
      try {
        var parentSeqForUndo = _unFindSequenceByIdOrName(info.parentSequenceId, info.parentSequenceName);
        if (parentSeqForUndo) { _unOpenSequenceBest(parentSeqForUndo, dbg, 'sekwencja główna przed History Undo'); }
      } catch (openUndoSeqErr) { debugPush(dbg, 'History Undo: nie udało się aktywować sekwencji głównej przed cofnięciem: ' + openUndoSeqErr); }
      var steps = Math.max(1, Math.min(200, Number(info.undoSteps) || 0));
      dbg.push('Cofam ostatni UN NEST przez prawdziwe Undo Premiere. Kroki do cofnięcia: ' + steps + '.');
      dbg.push('To powinno przywrócić oryginalny TrackItem: multicam, aktywną kamerę i label color, bo nie odbudowujemy klipu od zera.');
      var ok = 0;
      var stoppedAtRestoredState = false;
      for (var i = 0; i < steps; i++) {
        if (_unTryPremiereUndoOnce(dbg)) { ok++; }
        else { break; }
        if (_unHistoryTargetRestored(info, dbg, true)) {
          stoppedAtRestoredState = true;
          break;
        }
      }
      dbg.push('History Undo zakończone: wykonano ' + ok + ' / ' + steps + ' kroków' + (stoppedAtRestoredState ? ' i zatrzymano po wykryciu przywróconego NEST-a.' : '.') );
      if (!stoppedAtRestoredState) { dbg.push('Jeśli cofnęło za mało albo za dużo, podeślij ten log — skorygujemy licznik undoSteps dla Twojego przypadku.'); }
      return dbg.join('\n');
    } catch (e) {
      dbg.push('BŁĄD History Undo UN NEST: ' + e);
      return dbg.join('\n');
    }
  };


  function _unOpenSequenceBest(seq, dbg, label) {
    if (!seq) { return false; }
    try {
      var seqId = '';
      try { seqId = String(seq.sequenceID || ''); } catch (e0) { seqId = ''; }
      if (seqId && app && app.project && app.project.openSequence) {
        try { app.project.openSequence(seqId); debugPush(dbg, 'Native UN NEST: otwarto sekwencję ' + (label || '') + ' przez app.project.openSequence(sequenceID).'); return true; } catch (o0) {}
      }
      try {
        if (seqId && app && app.project && app.project.openSequence) {
          app.project.openSequence(seqId, true);
          debugPush(dbg, 'Native UN NEST: otwarto sekwencję ' + (label || '') + ' przez app.project.openSequence(sequenceID,true).');
          return true;
        }
      } catch (o1) {}
      try {
        if (seq && seq.projectItem && seq.projectItem.openInTimeline) {
          seq.projectItem.openInTimeline();
          debugPush(dbg, 'Native UN NEST: otwarto sekwencję ' + (label || '') + ' przez projectItem.openInTimeline().');
          return true;
        }
      } catch (o2) {}
      try {
        if (app && app.project && app.project.openSequence) {
          app.project.openSequence(seq.name);
          debugPush(dbg, 'Native UN NEST: otwarto sekwencję ' + (label || '') + ' przez app.project.openSequence(name).');
          return true;
        }
      } catch (o3) {}
    } catch (e) { debugPush(dbg, 'Native UN NEST: błąd otwierania sekwencji ' + (label || '') + ': ' + e); }
    debugPush(dbg, 'Native UN NEST: nie udało się otworzyć sekwencji ' + (label || '') + '.');
    return false;
  }

  function _unSetPlayheadBest(seq, ticks, dbg, label) {
    try {
      var t = makeTime(ticks);
      if (seq && seq.setPlayerPosition) {
        try { seq.setPlayerPosition(String(Math.round(Number(ticks) || 0))); debugPush(dbg, 'Native UN NEST: ustawiono playhead ' + (label || '') + ' przez setPlayerPosition(ticks).'); return true; } catch (e0) {}
        try { seq.setPlayerPosition(t); debugPush(dbg, 'Native UN NEST: ustawiono playhead ' + (label || '') + ' przez setPlayerPosition(Time).'); return true; } catch (e1) {}
      }
      try {
        if (app && app.enableQE) { app.enableQE(); }
        var qseq = qe && qe.project ? qe.project.getActiveSequence() : null;
        if (qseq) {
          try { qseq.CTI.ticks = String(Math.round(Number(ticks) || 0)); debugPush(dbg, 'Native UN NEST: ustawiono playhead ' + (label || '') + ' przez QE CTI.ticks.'); return true; } catch (e2) {}
          try { qseq.setPlayerPosition(String(Math.round(Number(ticks) || 0))); debugPush(dbg, 'Native UN NEST: ustawiono playhead ' + (label || '') + ' przez QE setPlayerPosition.'); return true; } catch (e3) {}
        }
      } catch (qeErr) {}
    } catch (e) { debugPush(dbg, 'Native UN NEST: błąd ustawiania playheada ' + (label || '') + ': ' + e); }
    debugPush(dbg, 'Native UN NEST: nie udało się ustawić playheada ' + (label || '') + '.');
    return false;
  }


  function _unClearSequenceSelection(seq) {
    try {
      var i, t, n, c;
      if (seq && seq.videoTracks) {
        for (t = 0; t < seq.videoTracks.numTracks; t++) {
          n = _unTrackItemCount(seq.videoTracks[t]);
          for (i = 0; i < n; i++) { try { c = _unClipAt(seq.videoTracks[t], i); if (c && c.setSelected) { c.setSelected(0, 0); } } catch (e0) {} }
        }
      }
      if (seq && seq.audioTracks) {
        for (t = 0; t < seq.audioTracks.numTracks; t++) {
          n = _unTrackItemCount(seq.audioTracks[t]);
          for (i = 0; i < n; i++) { try { c = _unClipAt(seq.audioTracks[t], i); if (c && c.setSelected) { c.setSelected(0, 0); } } catch (e1) {} }
        }
      }
    } catch (e) {}
  }


  function _unRemoveNativePastedAudioForVideoOnly(seq, info, dbg) {
    var removed = 0;
    try {
      if (!seq || !seq.audioTracks || !info || String(info.primaryTrackType || 'V') === 'A') { return 0; }
      var parentStart = Number(info.parentStart) || 0;
      var duration = Math.max(1, (Number(info.sourceOut) || 0) - (Number(info.sourceIn) || 0));
      var parentEnd = parentStart + duration;
      var before = info.prePasteSnapshot || {};
      var hasSnapshot = false;
      try { for (var k in before) { if (before.hasOwnProperty(k)) { hasSnapshot = true; break; } } } catch (hk) { hasSnapshot = false; }
      for (var t = 0; t < seq.audioTracks.numTracks; t++) {
        var tr = seq.audioTracks[t];
        var cnt = _unTrackItemCount(tr);
        for (var i = cnt - 1; i >= 0; i--) {
          var c = _unClipAt(tr, i);
          if (!c) { continue; }
          var st = _ssTicks(c.start);
          var en = _unTimelineEndTicks(c);
          if (!(en > parentStart && st < parentEnd)) { continue; }
          var key = _unNativeTrackFingerprint('A', t, c);
          var isNew = hasSnapshot ? !before[key] : false;
          var selected = false;
          try { selected = !!c.isSelected(); } catch (sel) { selected = false; }
          if (isNew || (!hasSnapshot && selected)) {
            try { c.remove(0, 0); removed++; } catch (r0) { try { c.remove(false, false); removed++; } catch (r1) {} }
          }
        }
      }
      if (removed > 0) { debugPush(dbg, 'Native UN NEST: usunięto przypadkowo wklejone audio z NEST-a video/audio-video: ' + removed + '.'); }
    } catch (e) { debugPush(dbg, 'Native UN NEST: błąd usuwania przypadkowo wklejonego audio video-only: ' + e); }
    return removed;
  }

  function _unComponentCount(clip) {
    try { return clip && clip.components ? clip.components.numItems : 0; } catch (e) {}
    return 0;
  }

  function _unIsSequenceProjectItem(projectItem) {
    try { return !!_unSeqByProjectItem(projectItem); } catch (e) {}
    return false;
  }

  function _unAnalyzeNativeCopyPasteNeed(nestedSeq, nestWindow, baseV, baseA, dbg) {
    var out = { needed: false, safe: true, reasons: [], selectedCount: 0, partialCount: 0 };
    function addReason(r) { out.needed = true; out.reasons.push(r); }
    try {
      if (baseV !== 0 || baseA !== 0) {
        out.reasons.push('bazowa ścieżka nie jest V1/A1 — natywne wklejenie będzie testowane jako domyślna metoda');
      }
      var vt, at, i, c, st, en, cnt;
      if (nestedSeq.videoTracks) {
        for (vt = 0; vt < nestedSeq.videoTracks.numTracks; vt++) {
          cnt = _unTrackItemCount(nestedSeq.videoTracks[vt]);
          for (i = 0; i < cnt; i++) {
            c = _unClipAt(nestedSeq.videoTracks[vt], i);
            if (!c) { continue; }
            st = _ssTicks(c.start); en = _unTimelineEndTicks(c);
            if (nestWindow && !(en > nestWindow.sourceIn && st < nestWindow.sourceOut)) { continue; }
            out.selectedCount++;
            if (st < nestWindow.sourceIn || en > nestWindow.sourceOut) { out.partialCount++; }
            if (!c.projectItem) { addReason('klip bez projectItem na V' + (vt + 1) + ' (napisy/grafika/caption)'); }
            else if (_unIsSequenceProjectItem(c.projectItem)) { addReason('wewnętrzny NEST/sekwencja na V' + (vt + 1) + ': ' + (c.name || c.projectItem.name || '')); }
            else if (_unReadMulticamEnabled(c)) { addReason('aktywny multicam TrackItem na V' + (vt + 1)); }
            else if (_unComponentCount(c) > 3) { addReason('klip z nietypowymi efektami/parametrami na V' + (vt + 1) + ': ' + (c.name || '')); }
          }
        }
      }
      if (nestedSeq.audioTracks) {
        for (at = 0; at < nestedSeq.audioTracks.numTracks; at++) {
          cnt = _unTrackItemCount(nestedSeq.audioTracks[at]);
          for (i = 0; i < cnt; i++) {
            c = _unClipAt(nestedSeq.audioTracks[at], i);
            if (!c) { continue; }
            st = _ssTicks(c.start); en = _unTimelineEndTicks(c);
            if (nestWindow && !(en > nestWindow.sourceIn && st < nestWindow.sourceOut)) { continue; }
            out.selectedCount++;
            if (st < nestWindow.sourceIn || en > nestWindow.sourceOut) { out.partialCount++; }
            if (!c.projectItem) { addReason('klip audio bez projectItem na A' + (at + 1)); }
          }
        }
      }
      if (out.partialCount > 0) {
        out.reasons.push('widoczne okno przecina ' + out.partialCount + ' klipów — po Ctrl+V zrobię best-effort trim do okna NEST-a');
      }
    } catch (e) { out.safe = false; out.reasons.push('błąd analizy native copy/paste: ' + e); }
    if (out.needed) { debugPush(dbg, 'Native UN NEST: wykryto złożony NEST. Powody: ' + out.reasons.join(' | ')); }
    return out;
  }

  function _unCountVisibleNestedItems(nestedSeq, nestWindow, includeVideo, includeAudio) {
    var count = 0;
    try {
      var t, i, c, st, en, cnt;
      if (includeVideo !== false && nestedSeq && nestedSeq.videoTracks) {
        for (t = 0; t < nestedSeq.videoTracks.numTracks; t++) {
          cnt = _unTrackItemCount(nestedSeq.videoTracks[t]);
          for (i = 0; i < cnt; i++) {
            c = _unClipAt(nestedSeq.videoTracks[t], i);
            if (!c) { continue; }
            st = _ssTicks(c.start); en = _unTimelineEndTicks(c);
            if (!nestWindow || (en > nestWindow.sourceIn && st < nestWindow.sourceOut)) { count++; }
          }
        }
      }
      if (includeAudio !== false && nestedSeq && nestedSeq.audioTracks) {
        for (t = 0; t < nestedSeq.audioTracks.numTracks; t++) {
          cnt = _unTrackItemCount(nestedSeq.audioTracks[t]);
          for (i = 0; i < cnt; i++) {
            c = _unClipAt(nestedSeq.audioTracks[t], i);
            if (!c) { continue; }
            st = _ssTicks(c.start); en = _unTimelineEndTicks(c);
            if (!nestWindow || (en > nestWindow.sourceIn && st < nestWindow.sourceOut)) { count++; }
          }
        }
      }
    } catch (e) {}
    return count;
  }


  function _unVisibleNestedVideoTrackSpan(nestedSeq, nestWindow) {
    // Zwraca ile ścieżek video może zająć natywne Ctrl/Cmd+V, licząc od V1 źródłowego NEST-a.
    // Przykład: widoczne klipy na V1,V2,V3 => span=3, więc w sekwencji głównej trzeba chronić V2/V3.
    var maxTrack = -1;
    try {
      if (!nestedSeq || !nestedSeq.videoTracks) { return 0; }
      for (var t = 0; t < nestedSeq.videoTracks.numTracks; t++) {
        var cnt = _unTrackItemCount(nestedSeq.videoTracks[t]);
        for (var i = 0; i < cnt; i++) {
          var c = _unClipAt(nestedSeq.videoTracks[t], i);
          if (!c) { continue; }
          var st = _ssTicks(c.start);
          var en = _unTimelineEndTicks(c);
          if (nestWindow && !(en > nestWindow.sourceIn && st < nestWindow.sourceOut)) { continue; }
          if (t > maxTrack) { maxTrack = t; }
        }
      }
    } catch (e) {}
    return maxTrack >= 0 ? (maxTrack + 1) : 0;
  }

  function _unTrackOverlapsWindow(track, startTicks, endTicks) {
    try {
      var cnt = _unTrackItemCount(track);
      for (var i = 0; i < cnt; i++) {
        var c = _unClipAt(track, i);
        if (!c) { continue; }
        var st = _ssTicks(c.start);
        var en = _unTimelineEndTicks(c);
        if (en > startTicks && st < endTicks) { return true; }
      }
    } catch (e) {}
    return false;
  }

  function _unQeActiveSequenceBest(seq, dbg, label) {
    try {
      if (seq) { _unOpenSequenceBest(seq, dbg, label || 'sekwencja do QE'); }
      if (app && app.enableQE) { app.enableQE(); }
      if (qe && qe.project && qe.project.getActiveSequence) {
        try { return qe.project.getActiveSequence(0); } catch (e0) {}
        try { return qe.project.getActiveSequence(); } catch (e1) {}
      }
    } catch (e) { debugPush(dbg, 'UN NEST Video Protect: nie mogę pobrać QE active sequence: ' + e); }
    return null;
  }

  function _unAddVideoTracksAfterBest(seq, afterIndex, count, dbg) {
    // Premiere nie ma oficjalnego DOM do dodawania ścieżek, więc używamy QE best-effort.
    if (!seq || !count || count <= 0) { return false; }
    var before = 0;
    try { before = seq.videoTracks ? seq.videoTracks.numTracks : 0; } catch (b0) { before = 0; }
    var pos = Math.max(0, Number(afterIndex) || 0);
    var qseq = _unQeActiveSequenceBest(seq, dbg, 'sekwencja główna przed dodaniem ścieżek ochronnych');
    if (!qseq || !qseq.addTracks) {
      debugPush(dbg, 'UN NEST Video Protect: QE addTracks niedostępne, nie mogę automatycznie dodać pustej ścieżki ochronnej.');
      return false;
    }

    function refreshedCount() {
      try { return app.project.activeSequence.videoTracks.numTracks; } catch (r0) {}
      try { return seq.videoTracks.numTracks; } catch (r1) {}
      return 0;
    }

    function tryCall(label, fn) {
      try {
        fn();
        var after = refreshedCount();
        if (after >= before + count) {
          debugPush(dbg, 'UN NEST Video Protect: dodano ' + count + ' ścieżk' + (count === 1 ? 'ę' : 'i') + ' video po V' + (pos + 1) + ' metodą ' + label + '.');
          return true;
        }
        debugPush(dbg, 'UN NEST Video Protect: metoda ' + label + ' wykonana, ale liczba ścieżek video przed/po=' + before + '/' + after + '.');
      } catch (e) {
        debugPush(dbg, 'UN NEST Video Protect: metoda ' + label + ' nie zadziałała: ' + e);
      }
      return false;
    }

    if (tryCall('addTracks(count,pos,0,1,0,0,0,0)', function () { qseq.addTracks(count, pos, 0, 1, 0, 0, 0, 0); })) { return true; }
    if (tryCall('addTracks(count,pos,0,0,0,0,0,0)', function () { qseq.addTracks(count, pos, 0, 0, 0, 0, 0, 0); })) { return true; }
    if (tryCall('addTracks(count,pos,0,1,0)', function () { qseq.addTracks(count, pos, 0, 1, 0); })) { return true; }
    if (tryCall('addTracks(count,pos)', function () { qseq.addTracks(count, pos); })) { return true; }

    try {
      var okAny = false;
      for (var i = 0; i < count; i++) {
        try { qseq.addTracks(1, pos + i, 0, 1, 0, 0, 0, 0); okAny = true; } catch (e1) {}
      }
      var after2 = refreshedCount();
      if (okAny && after2 >= before + count) {
        debugPush(dbg, 'UN NEST Video Protect: dodano ścieżki ochronne pojedynczo, video przed/po=' + before + '/' + after2 + '.');
        return true;
      }
    } catch (e2) { debugPush(dbg, 'UN NEST Video Protect: fallback pojedynczego dodawania nie zadziałał: ' + e2); }
    return false;
  }

  function _unPrepareLocalVideoProtectionSelection(parentSeq, info, dbg) {
    // v1.12.136: nie dodajemy ścieżki w środku timeline, bo to podnosi cały timeline.
    // Zaznaczamy tylko klipy, które nachodzą czasowo na okno UN NEST-a, a panel CEP
    // przesuwa je natywnie Alt/Option+Up. Dzięki temu ruszają tylko klipy w tym miejscu.
    try {
      if (String(info.primaryTrackType || 'V') === 'A') { return false; }
      if (info.localVideoProtectionDone) { return false; }
      var baseV = Math.max(0, Number(info.baseV) || 0);
      var span = Math.max(0, Number(info.videoTrackSpan) || 0);
      info.localVideoProtectionDone = true;
      if (span <= 1) {
        debugPush(dbg, 'UN NEST Video Protect: źródło używa jednej ścieżki video, lokalna ochrona V2+ niepotrzebna.');
        return false;
      }
      var parentStart = Number(info.parentStart) || 0;
      var duration = Math.max(1, (Number(info.sourceOut) || 0) - (Number(info.sourceIn) || 0));
      var parentEnd = parentStart + duration;
      var protectFrom = baseV + 1;
      var protectTo = baseV + span - 1;
      var minOccupied = 999999;
      var names = [];
      var t;
      for (t = protectFrom; t <= protectTo; t++) {
        if (parentSeq && parentSeq.videoTracks && parentSeq.videoTracks[t] && _unTrackOverlapsWindow(parentSeq.videoTracks[t], parentStart, parentEnd)) {
          if (t < minOccupied) { minOccupied = t; }
          names.push('V' + (t + 1));
        }
      }
      if (!names.length) {
        debugPush(dbg, 'UN NEST Video Protect: ścieżki docelowe V' + (protectFrom + 1) + '-V' + (protectTo + 1) + ' są wolne w oknie NEST-a, niczego nie przesuwam.');
        return false;
      }

      var moveBy = Math.max(1, protectTo - minOccupied + 1);
      var numTracks = 0;
      try { numTracks = parentSeq && parentSeq.videoTracks ? parentSeq.videoTracks.numTracks : 0; } catch (nt0) { numTracks = 0; }
      var scanTo = minOccupied - 1;
      var freeRun = 0;
      for (t = minOccupied; t < numTracks; t++) {
        if (parentSeq.videoTracks[t] && _unTrackOverlapsWindow(parentSeq.videoTracks[t], parentStart, parentEnd)) {
          scanTo = t;
          freeRun = 0;
        } else {
          freeRun++;
          if (freeRun >= moveBy) { break; }
        }
      }

      var neededTopTracks = (scanTo + moveBy + 1) - numTracks;
      if (neededTopTracks > 0) {
        debugPush(dbg, 'UN NEST Video Protect: brakuje ' + neededTopTracks + ' pustej/ych ścieżki/ek na górze, dodaję je na samą górę bez przesuwania środka timeline.');
        _unAddVideoTracksAfterBest(parentSeq, Math.max(0, numTracks - 1), neededTopTracks, dbg);
      }

      _unClearSequenceSelection(parentSeq);
      var selected = 0;
      var selectedTracks = [];
      for (t = minOccupied; t <= scanTo; t++) {
        var tr = parentSeq.videoTracks && parentSeq.videoTracks[t] ? parentSeq.videoTracks[t] : null;
        if (!tr) { continue; }
        var cnt = _unTrackItemCount(tr);
        var trackSelected = false;
        for (var i = 0; i < cnt; i++) {
          var c = _unClipAt(tr, i);
          if (!c) { continue; }
          var st = _ssTicks(c.start);
          var en = _unTimelineEndTicks(c);
          if (!(en > parentStart && st < parentEnd)) { continue; }
          try { if (c.setSelected) { c.setSelected(1, 1); selected++; trackSelected = true; } } catch (selErr) { debugPush(dbg, 'UN NEST Video Protect: nie udało się zaznaczyć klipu na V' + (t + 1) + ': ' + selErr); }
        }
        if (trackSelected) { selectedTracks.push('V' + (t + 1)); }
      }

      if (selected <= 0) {
        debugPush(dbg, 'UN NEST Video Protect: wykryłem kolizję, ale nie udało się zaznaczyć lokalnych klipów do przesunięcia. Przerywam ochronę.');
        return false;
      }
      info.localVideoNudgeSteps = moveBy;
      info.localVideoProtectionSelectedCount = selected;
      info.localVideoProtectionTracks = selectedTracks.join(', ');
      info.videoTrackProtection = true;
      info.protectedVideoTrackInsertCount = 0;
      debugPush(dbg, 'UN NEST Video Protect: NEST potrzebuje ' + span + ' ścieżek video od V' + (baseV + 1) + '. Wykryto kolizję na ' + names.join(', ') + '. Zaznaczyłem tylko lokalne klipy w oknie NEST-a na ' + selectedTracks.join(', ') + ' (' + selected + ' klipów). Panel przesunie je o ' + moveBy + ' ścieżk' + (moveBy === 1 ? 'ę' : 'i') + ' w górę.');
      return true;
    } catch (e) { debugPush(dbg, 'UN NEST Video Protect: błąd lokalnej ochrony ścieżek: ' + e); }
    return false;
  }

  function _unSetSequenceInOutBest(seq, inTicks, outTicks, dbg, label) {
    var okIn = false;
    var okOut = false;
    try {
      var tin = makeTime(inTicks);
      var tout = makeTime(outTicks);
      if (seq) {
        try { if (seq.setInPoint) { seq.setInPoint(tin); okIn = true; } } catch (e0) {}
        try { if (!okIn && seq.setInPoint) { seq.setInPoint(String(Math.round(Number(inTicks) || 0))); okIn = true; } } catch (e1) {}
        try { if (!okIn) { seq.inPoint = tin; okIn = true; } } catch (e2) {}
        try { if (!okIn && seq.inPoint) { seq.inPoint.ticks = String(Math.round(Number(inTicks) || 0)); okIn = true; } } catch (e3) {}

        try { if (seq.setOutPoint) { seq.setOutPoint(tout); okOut = true; } } catch (e4) {}
        try { if (!okOut && seq.setOutPoint) { seq.setOutPoint(String(Math.round(Number(outTicks) || 0))); okOut = true; } } catch (e5) {}
        try { if (!okOut) { seq.outPoint = tout; okOut = true; } } catch (e6) {}
        try { if (!okOut && seq.outPoint) { seq.outPoint.ticks = String(Math.round(Number(outTicks) || 0)); okOut = true; } } catch (e7) {}
      }
      try {
        if (app && app.enableQE) { app.enableQE(); }
        var qseq = qe && qe.project && qe.project.getActiveSequence ? qe.project.getActiveSequence() : null;
        if (qseq) {
          try { if (!okIn && qseq.setInPoint) { qseq.setInPoint(String(Math.round(Number(inTicks) || 0))); okIn = true; } } catch (qe0) {}
          try { if (!okOut && qseq.setOutPoint) { qseq.setOutPoint(String(Math.round(Number(outTicks) || 0))); okOut = true; } } catch (qe1) {}
          try { if (!okIn && qseq.CTI) { qseq.CTI.ticks = String(Math.round(Number(inTicks) || 0)); } } catch (qe2) {}
        }
      } catch (qe) {}
    } catch (e) { debugPush(dbg, 'Native UN NEST: błąd ustawiania In/Out ' + (label || '') + ': ' + e); }
    debugPush(dbg, 'Native UN NEST: ustawianie In/Out ' + (label || '') + ' -> in=' + inTicks + ', out=' + outTicks + ' (' + (okIn ? 'in OK' : 'in brak') + ', ' + (okOut ? 'out OK' : 'out brak') + ').');
    return okIn && okOut;
  }

  function _unClearSequenceInOutBest(seq, dbg, label) {
    try {
      try { if (seq && seq.setInPoint) { seq.setInPoint('0'); } } catch (e0) {}
      try { if (seq && seq.setOutPoint) { seq.setOutPoint('0'); } } catch (e1) {}
      try { if (seq) { seq.inPoint = makeTime(0); } } catch (e2) {}
      try { if (seq) { seq.outPoint = makeTime(0); } } catch (e3) {}
      debugPush(dbg, 'Native UN NEST: wyczyszczono In/Out ' + (label || '') + ' best-effort.');
    } catch (e) {}
  }

  function _unTargetTracksBest(seq, dbg, label, includeVideo, includeAudio) {
    var attempts = 0;
    var ok = 0;
    var offAttempts = 0;
    var offOk = 0;
    function setTrack(tr, enabled) {
      if (!tr) { return; }
      var methods = ['setTargeted', 'setTargeting', 'setTarget', 'setTargetedForInsert'];
      for (var m = 0; m < methods.length; m++) {
        try {
          if (tr[methods[m]]) {
            if (enabled) { attempts++; } else { offAttempts++; }
            tr[methods[m]](enabled ? 1 : 0);
            if (enabled) { ok++; } else { offOk++; }
            return;
          }
        } catch (e0) {}
        try {
          if (tr[methods[m]]) {
            if (enabled) { attempts++; } else { offAttempts++; }
            tr[methods[m]](!!enabled);
            if (enabled) { ok++; } else { offOk++; }
            return;
          }
        } catch (e1) {}
      }
    }
    try {
      var t;
      if (seq && seq.videoTracks) {
        for (t = 0; t < seq.videoTracks.numTracks; t++) { setTrack(seq.videoTracks[t], !!includeVideo); }
      }
      if (seq && seq.audioTracks) {
        for (t = 0; t < seq.audioTracks.numTracks; t++) { setTrack(seq.audioTracks[t], !!includeAudio); }
      }
    } catch (e) {}
    debugPush(dbg, 'Native UN NEST: targetowanie tracków ' + (label || '') + ' best-effort: video=' + (!!includeVideo ? 'ON' : 'OFF') + ', audio=' + (!!includeAudio ? 'ON' : 'OFF') + ', on=' + ok + '/' + attempts + ', off=' + offOk + '/' + offAttempts + '.');
    return ok;
  }

  function _unNativePayload(parentSeq, nestedSeq, nestClip, parentStart, nestWindow, selected, baseV, baseA, primaryTrackType, dbg) {
    var payload = {
      parentSequenceName: '', parentSequenceId: '', nestedSequenceName: '', nestedSequenceId: '',
      nestProjectItemName: '', nestClipName: '', parentStart: Number(parentStart) || 0,
      sourceIn: nestWindow ? (Number(nestWindow.sourceIn) || 0) : 0,
      sourceOut: nestWindow ? (Number(nestWindow.sourceOut) || 0) : 0,
      selectedCount: selected || 0, baseV: 0, baseA: 0, primaryTrackType: String(primaryTrackType || 'V'), copyMode: 'sourceInOutRange',
      deleteProjectSequenceAfterPaste: false, isMulticamNest: false,
      videoTrackSpan: 0, protectedVideoTrackInsertCount: 0, originalVideoTrackCount: 0, videoTrackProtection: false, videoTrackProtectionInsertAfter: -1
    };
    try { payload.parentSequenceName = String(parentSeq && parentSeq.name || ''); } catch (e0) {}
    try { payload.parentSequenceId = String(parentSeq && parentSeq.sequenceID || ''); } catch (e1) {}
    try { payload.nestedSequenceName = String(nestedSeq && nestedSeq.name || ''); } catch (e2) {}
    try { payload.nestedSequenceId = String(nestedSeq && nestedSeq.sequenceID || ''); } catch (e3) {}
    try { payload.nestProjectItemName = String(nestClip && nestClip.projectItem && nestClip.projectItem.name || ''); } catch (e4) {}
    try { payload.nestClipName = String(nestClip && nestClip.name || ''); } catch (e5) {}
    try { payload.baseV = Math.max(0, Number(baseV) || 0); } catch (e6) { payload.baseV = 0; }
    try { payload.baseA = Math.max(0, Number(baseA) || 0); } catch (e6a) { payload.baseA = 0; }
    try { payload.isMulticamNest = !!_unDetectNativeMulticamNest(nestClip, nestedSeq, dbg); } catch (e7a) { payload.isMulticamNest = false; }
    try { payload.deleteProjectSequenceAfterPaste = payload.isMulticamNest ? false : !!_unNativeShouldDeleteSourceSequence(nestClip, nestedSeq, dbg); } catch (e7) { payload.deleteProjectSequenceAfterPaste = false; }
    try { payload.videoTrackSpan = Math.max(0, Number(_unVisibleNestedVideoTrackSpan(nestedSeq, nestWindow)) || 0); } catch (e8) { payload.videoTrackSpan = 0; }
    return _unJsonValue(payload);
  }

  function _unNativeUndoPayloadForHistory(info, deletedSourceSeq) {
    // v1.12.136: Native UN NEST działa etapami przez CEP (Ctrl+C/Ctrl+V + finalize),
    // więc payload do naszego przycisku cofania musi powstać dopiero po finalize.
    // Cofanie ma używać prawdziwego Undo Premiere, tak jak wcześniej, żeby wrócić
    // do punktu sprzed UN NEST i zachować multicam/kolory/kamerę.
    var out = {};
    try {
      if (info) {
        for (var k in info) {
          try { if (info.hasOwnProperty(k) && k !== 'prePasteSnapshot') { out[k] = info[k]; } } catch (copyErr) {}
        }
      }
    } catch (e0) {}
    try { out.parentSequenceName = String(out.parentSequenceName || ''); } catch (e1) {}
    try { out.parentSequenceId = String(out.parentSequenceId || ''); } catch (e2) {}
    try { out.nestedSequenceName = String(out.nestedSequenceName || ''); } catch (e3) {}
    try { out.nestProjectItemName = String(out.nestProjectItemName || out.nestedSequenceName || ''); } catch (e4) {}
    try { out.nestClipName = String(out.nestClipName || out.nestProjectItemName || out.nestedSequenceName || ''); } catch (e5) {}
    try { out.baseV = Math.max(0, Number(out.baseV) || 0); } catch (e6) { out.baseV = 0; }
    try { out.parentStart = Number(out.parentStart) || 0; } catch (e7) { out.parentStart = 0; }
    try { out.videoJobs = out.videoJobs || []; } catch (e8) { out.videoJobs = []; }
    try { out.audioJobs = out.audioJobs || []; } catch (e9) { out.audioJobs = []; }

    // Dajemy zapas, bo liczba wpisów historii różni się między Premiere i zależy od tego,
    // czy usuwaliśmy źródłową sekwencję z Project Panelu. Pętla i tak zatrzymuje się
    // automatycznie, gdy wykryje powrót oryginalnego NEST-a na timeline.
    try {
      out.undoSteps = deletedSourceSeq ? 30 : 24;
      if (Number(out.protectedVideoTrackInsertCount || 0) > 0) { out.undoSteps += 8; }
    } catch (e10) { out.undoSteps = 24; }
    out.undoMode = 'premiereHistoryNativeCopyPaste';
    out.createdBy = 'Verni AiO UN NEST v1.12.190';
    return _unJsonValue(out);
  }

  function _unFindSequenceByIdOrName(id, name) {
    try {
      if (!app || !app.project || !app.project.sequences) { return null; }
      var sid = String(id || '');
      for (var i = 0; i < app.project.sequences.numSequences; i++) {
        var seq = app.project.sequences[i];
        if (!seq) { continue; }
        try { if (sid && String(seq.sequenceID || '') === sid) { return seq; } } catch (e0) {}
        try { if (sid && String(seq.id || '') === sid) { return seq; } } catch (e1) {}
      }
      if (name) { return _unFindSequenceByName(String(name)); }
    } catch (e) {}
    return null;
  }

  function _unFindNestClipForNativeRestore(seq, info) {
    try {
      var baseV = Math.max(0, Number(info.baseV) || 0);
      var baseA = Math.max(0, Number(info.baseA) || 0);
      var primary = String(info.primaryTrackType || 'V');
      var start = Number(info.parentStart) || 0;
      var nameHint = String(info.nestClipName || info.nestProjectItemName || info.nestedSequenceName || '');
      var tolerance = 254016000000;

      function clipMatches(c) {
        if (!c) { return false; }
        var st = 0;
        try { st = _ssTicks(c.start); } catch (stErr) { st = 0; }
        if (Math.abs(st - start) > tolerance) { return false; }
        try { if (nameHint && String(c.name || '') === nameHint) { return true; } } catch (n0) {}
        try { if (nameHint && c.projectItem && String(c.projectItem.name || '') === nameHint) { return true; } } catch (n1) {}
        try { if (c.projectItem && String(c.projectItem.name || '') === String(info.nestProjectItemName || '')) { return true; } } catch (n2) {}
        try { if (String(c.name || '') === String(info.nestedSequenceName || '')) { return true; } } catch (n3) {}
        return false;
      }

      function searchTrack(track) {
        try {
          var cnt = _unTrackItemCount(track);
          for (var i = 0; i < cnt; i++) {
            var c = _unClipAt(track, i);
            if (clipMatches(c)) { return c; }
          }
        } catch (e0) {}
        return null;
      }

      // Najpierw ścieżka, na której faktycznie był zaznaczony NEST.
      if (primary === 'A' && seq && seq.audioTracks && seq.audioTracks[baseA]) {
        var a0 = searchTrack(seq.audioTracks[baseA]);
        if (a0) { return a0; }
      }
      if (primary !== 'A' && seq && seq.videoTracks && seq.videoTracks[baseV]) {
        var v0 = searchTrack(seq.videoTracks[baseV]);
        if (v0) { return v0; }
      }

      // Fallback: szukamy we wszystkich audio i video. To naprawia audio-only NEST-y,
      // bo wcześniejsza wersja szukała tylko na videoTracks i dlatego nic się nie działo.
      var t, found;
      if (seq && seq.audioTracks) {
        for (t = 0; t < seq.audioTracks.numTracks; t++) {
          found = searchTrack(seq.audioTracks[t]);
          if (found) { return found; }
        }
      }
      if (seq && seq.videoTracks) {
        for (t = 0; t < seq.videoTracks.numTracks; t++) {
          found = searchTrack(seq.videoTracks[t]);
          if (found) { return found; }
        }
      }
    } catch (e) {}
    return null;
  }


  function _unNativeTrackFingerprint(trackType, trackIndex, item) {
    try {
      var name = '';
      var itemName = '';
      try { name = String(item && item.name || ''); } catch (e0) {}
      try { itemName = String(item && item.projectItem && item.projectItem.name || ''); } catch (e1) {}
      return String(trackType || '') + ':' + String(trackIndex || 0) + ':' + String(_ssTicks(item && item.start)) + ':' + String(_unTimelineEndTicks(item)) + ':' + name + ':' + itemName;
    } catch (e) {}
    return '';
  }


  function _unNativeNewItemsCountSinceSnapshot(seq, snapshot, parentStart, parentEnd) {
    var count = 0;
    var byType = { V: 0, A: 0 };
    try {
      var hasSnapshot = false;
      try { for (var hk in (snapshot || {})) { if ((snapshot || {}).hasOwnProperty(hk)) { hasSnapshot = true; break; } } } catch (he) { hasSnapshot = false; }
      if (!hasSnapshot || !seq) { return { count: 0, video: 0, audio: 0, hasSnapshot: false }; }
      function scan(kind, tracks) {
        try {
          if (!tracks) { return; }
          for (var t = 0; t < tracks.numTracks; t++) {
            var tr = tracks[t];
            var cnt = _unTrackItemCount(tr);
            for (var i = 0; i < cnt; i++) {
              var c = _unClipAt(tr, i);
              if (!c) { continue; }
              var st = _ssTicks(c.start);
              var en = _unTimelineEndTicks(c);
              if (!(en > parentStart && st < parentEnd)) { continue; }
              var key = _unNativeTrackFingerprint(kind, t, c);
              if (key && !snapshot[key]) {
                count++;
                if (kind === 'V') { byType.V++; } else { byType.A++; }
              }
            }
          }
        } catch (scanErr) {}
      }
      scan('V', seq.videoTracks);
      scan('A', seq.audioTracks);
    } catch (e) {}
    return { count: count, video: byType.V, audio: byType.A, hasSnapshot: true };
  }

  function _unNativeTimelineSnapshot(seq) {
    var map = {};
    try {
      var t, i, c, cnt, key;
      if (seq && seq.videoTracks) {
        for (t = 0; t < seq.videoTracks.numTracks; t++) {
          cnt = _unTrackItemCount(seq.videoTracks[t]);
          for (i = 0; i < cnt; i++) {
            c = _unClipAt(seq.videoTracks[t], i);
            key = _unNativeTrackFingerprint('V', t, c);
            if (key) { map[key] = true; }
          }
        }
      }
      if (seq && seq.audioTracks) {
        for (t = 0; t < seq.audioTracks.numTracks; t++) {
          cnt = _unTrackItemCount(seq.audioTracks[t]);
          for (i = 0; i < cnt; i++) {
            c = _unClipAt(seq.audioTracks[t], i);
            key = _unNativeTrackFingerprint('A', t, c);
            if (key) { map[key] = true; }
          }
        }
      }
    } catch (e) {}
    return map;
  }

  function _unSetTrackItemStartEndBest(item, startTicks, endTicks, dbg, label) {
    var okStart = false;
    var okEnd = false;
    try {
      var st = makeTime(startTicks);
      var en = makeTime(endTicks);
      try { if (item && item.setStart) { item.setStart(st); okStart = true; } } catch (e0) {}
      try { if (!okStart && item && item.setStart) { item.setStart(String(Math.round(Number(startTicks) || 0))); okStart = true; } } catch (e1) {}
      try { if (!okStart && item) { item.start = st; okStart = true; } } catch (e2) {}
      try { if (!okStart && item && item.start) { item.start.ticks = String(Math.round(Number(startTicks) || 0)); okStart = true; } } catch (e3) {}
      try { if (item && item.setEnd) { item.setEnd(en); okEnd = true; } } catch (e4) {}
      try { if (!okEnd && item && item.setEnd) { item.setEnd(String(Math.round(Number(endTicks) || 0))); okEnd = true; } } catch (e5) {}
      try { if (!okEnd && item) { item.end = en; okEnd = true; } } catch (e6) {}
      try { if (!okEnd && item && item.end) { item.end.ticks = String(Math.round(Number(endTicks) || 0)); okEnd = true; } } catch (e7) {}
    } catch (e) { debugPush(dbg, 'Native UN NEST: trim pasted item błąd ' + (label || '') + ': ' + e); }
    if (okStart || okEnd) { debugPush(dbg, 'Native UN NEST: przycięto wklejony TrackItem ' + (label || '') + ' do okna NEST (' + (okStart ? 'start OK' : 'start brak') + ', ' + (okEnd ? 'end OK' : 'end brak') + ').'); }
    return okStart || okEnd;
  }

  function _unTrimNativePastedSelectionToParentWindow(seq, info, dbg) {
    var trimmed = 0;
    try {
      var parentStart = Number(info.parentStart) || 0;
      var duration = Math.max(1, (Number(info.sourceOut) || 0) - (Number(info.sourceIn) || 0));
      var parentEnd = parentStart + duration;
      var before = info.prePasteSnapshot || {};
      var hasSnapshot = false;
      try { for (var k in before) { if (before.hasOwnProperty(k)) { hasSnapshot = true; break; } } } catch (hk) { hasSnapshot = false; }
      var t, i, c, cnt, st, en, selected, key, isNew, touchesWindow;
      function shouldTouch(trackType, trackIndex, item, st0, en0) {
        touchesWindow = (en0 > parentStart && st0 < parentEnd);
        if (!touchesWindow) { return false; }
        key = _unNativeTrackFingerprint(trackType, trackIndex, item);
        isNew = hasSnapshot ? !before[key] : false;
        selected = false;
        try { selected = !!item.isSelected(); } catch (sel0) { selected = false; }
        // Najważniejsze zabezpieczenie: NIE dotykamy starych klipów po lewej/prawej.
        // Preferujemy snapshot sprzed Ctrl+V. Selekcja jest tylko fallbackiem, gdy snapshot nie istnieje.
        if (hasSnapshot) { return isNew; }
        return selected;
      }
      if (seq && seq.videoTracks) {
        for (t = 0; t < seq.videoTracks.numTracks; t++) {
          cnt = _unTrackItemCount(seq.videoTracks[t]);
          for (i = 0; i < cnt; i++) {
            c = _unClipAt(seq.videoTracks[t], i);
            if (!c) { continue; }
            st = _ssTicks(c.start); en = _unTimelineEndTicks(c);
            if (!shouldTouch('V', t, c, st, en)) { continue; }
            if (st < parentStart || en > parentEnd) {
              if (_unSetTrackItemStartEndBest(c, Math.max(st, parentStart), Math.min(en, parentEnd), dbg, 'V' + (t + 1))) { trimmed++; }
            }
          }
        }
      }
      if (seq && seq.audioTracks) {
        for (t = 0; t < seq.audioTracks.numTracks; t++) {
          cnt = _unTrackItemCount(seq.audioTracks[t]);
          for (i = 0; i < cnt; i++) {
            c = _unClipAt(seq.audioTracks[t], i);
            if (!c) { continue; }
            st = _ssTicks(c.start); en = _unTimelineEndTicks(c);
            if (!shouldTouch('A', t, c, st, en)) { continue; }
            if (st < parentStart || en > parentEnd) {
              if (_unSetTrackItemStartEndBest(c, Math.max(st, parentStart), Math.min(en, parentEnd), dbg, 'A' + (t + 1))) { trimmed++; }
            }
          }
        }
      }
      debugPush(dbg, 'Native UN NEST: bezpieczny trim po wklejeniu, przyciętych nowych elementów=' + trimmed + ', snapshot=' + (hasSnapshot ? 'tak' : 'nie') + ', okno=' + parentStart + '-' + parentEnd + '.');
    } catch (e) { debugPush(dbg, 'Native UN NEST: błąd bezpiecznego trim po wklejeniu: ' + e); }
    return trimmed;
  }

  function _unTryNativeCopyPasteUnNest(seq, nestedSeq, nestClip, parentStart, nestWindow, baseV, baseA, primaryTrackType, dbg) {
    try {
      debugPush(dbg, 'Native UN NEST: start domyślnego trybu copy/paste TrackItemów.');
      var parentSeq = seq;
      if (!_unOpenSequenceBest(nestedSeq, dbg, 'NEST źródłowy')) { return false; }
      _unClearSequenceSelection(nestedSeq);
      var copyVideo = (String(primaryTrackType || 'V') !== 'A');
      var copyAudio = !copyVideo;
      var selected = _unCountVisibleNestedItems(nestedSeq, nestWindow, copyVideo, copyAudio);
      if (selected <= 0) { debugPush(dbg, 'Native UN NEST: brak elementów do kopiowania w widocznym oknie.'); _unOpenSequenceBest(parentSeq, dbg, 'sekwencja główna'); return false; }
      _unSetPlayheadBest(nestedSeq, nestWindow.sourceIn || 0, dbg, 'NEST źródłowy');
      _unTargetTracksBest(nestedSeq, dbg, 'NEST źródłowy', copyVideo, copyAudio);
      if (copyVideo && !copyAudio) {
        debugPush(dbg, 'Native UN NEST: NEST ma typ video/audio-video, więc kopiuję tylko ścieżki VIDEO i pomijam audio z NEST-a, żeby nie nadpisać istniejącego audio na timeline.');
      } else {
        debugPush(dbg, 'Native UN NEST: NEST audio-only, więc kopiuję ścieżki AUDIO.');
      }
      var ioOk = _unSetSequenceInOutBest(nestedSeq, nestWindow.sourceIn || 0, nestWindow.sourceOut || (nestWindow.sourceIn + 1), dbg, 'NEST źródłowy');
      if (!ioOk) {
        debugPush(dbg, 'Native UN NEST: UWAGA - nie udało się pewnie ustawić In/Out w źródłowym NEST. Nie zaznaczam pełnych klipów, żeby nie wkleić długich multicamów i nie nadpisać prawej strony.');
      } else {
        debugPush(dbg, 'Native UN NEST: kopiowanie będzie wykonywane z zakresu In/Out źródłowego NEST-a, bez zaznaczania całych długich klipów.');
      }
      debugPush(dbg, 'Native UN NEST: ExtendScript nie ma dostępu do Copy w tej wersji Premiere, przechodzę do fallbacku klawiaturowego Ctrl+C/Ctrl+V z panelu CEP.');
      return '__UNNEST_NATIVE_COPY__' + _unNativePayload(parentSeq, nestedSeq, nestClip, parentStart, nestWindow, selected, baseV, baseA, primaryTrackType, dbg) + '__END_UNNEST_NATIVE_COPY__';
    } catch (e) {
      debugPush(dbg, 'Native UN NEST: błąd trybu copy/paste: ' + e);
      try { _unOpenSequenceBest(seq, dbg, 'sekwencja główna po błędzie'); } catch (ee) {}
      return false;
    }
  }

  AEDRNO.multiNestUndoPrepareOne = function (payloadJson) {
    var dbg = [];
    dbg.push('=== MULTI-NEST Undo: przygotowanie pojedynczego NEST-a przez Native UN NEST ===');
    try {
      var payload = _unParseJson(payloadJson);
      var item = payload && payload.item ? payload.item : payload;
      if (!item) { dbg.push('MULTI-NEST Undo: brak danych snapshotu dla NEST-a.'); return dbg.join('\n'); }

      var parentSeq = _unFindSequenceByIdOrName(item.parentSequenceId, item.parentSequenceName);
      if (!parentSeq) {
        dbg.push('MULTI-NEST Undo: nie moge znalezc sekwencji rodzica: ' + (item.parentSequenceName || item.parentSequenceId || '?'));
        return dbg.join('\n');
      }
      _unOpenSequenceBest(parentSeq, dbg, 'sekwencja rodzica MultiNest Undo');
      _unClearSequenceSelection(parentSeq);

      var primaryTrackType = String(item.primaryTrackType || item.type || 'V') === 'A' ? 'A' : 'V';
      var baseV = primaryTrackType === 'A' ? 0 : Math.max(0, Number(item.baseV !== undefined ? item.baseV : item.trackIndex) || 0);
      var baseA = primaryTrackType === 'A' ? Math.max(0, Number(item.baseA !== undefined ? item.baseA : item.trackIndex) || 0) : Math.max(0, Number(item.baseA) || 0);
      var restoreInfo = {
        parentSequenceName: String(item.parentSequenceName || ''),
        parentSequenceId: String(item.parentSequenceId || ''),
        nestedSequenceName: String(item.nestedSequenceName || item.nestName || ''),
        nestedSequenceId: String(item.nestedSequenceId || ''),
        nestProjectItemName: String(item.nestProjectItemName || item.nestName || ''),
        nestClipName: String(item.nestClipName || item.nestName || item.nestProjectItemName || ''),
        parentStart: Number(item.start) || Number(item.parentStart) || 0,
        baseV: baseV,
        baseA: baseA,
        primaryTrackType: primaryTrackType
      };

      var nestClip = _unFindNestClipForNativeRestore(parentSeq, restoreInfo);
      if (!nestClip) {
        dbg.push('MULTI-NEST Undo: nie znalazlem klipu NEST na timeline: ' + (restoreInfo.nestClipName || restoreInfo.nestedSequenceName || '?') + ' @ ' + restoreInfo.parentStart + '.');
        return dbg.join('\n');
      }

      var nestedSeq = _unFindSequenceByIdOrName(restoreInfo.nestedSequenceId, restoreInfo.nestedSequenceName);
      if (!nestedSeq) {
        try { if (nestClip && nestClip.projectItem) { nestedSeq = _unSeqByProjectItem(nestClip.projectItem); } } catch (seqByPiErr) {}
      }
      if (!nestedSeq) {
        dbg.push('MULTI-NEST Undo: znalazlem klip NEST, ale nie znalazlem jego sekwencji zrodlowej.');
        return dbg.join('\n');
      }

      var loc = _unFindTrackItemLocation(parentSeq, nestClip);
      if (loc && loc.type === 'A') {
        primaryTrackType = 'A';
        baseA = Math.max(0, Number(loc.index) || 0);
      } else if (loc && loc.type === 'V') {
        primaryTrackType = 'V';
        baseV = Math.max(0, Number(loc.index) || 0);
      }

      var parentStart = _ssTicks(nestClip.start);
      var matchedBaseA = _unFindMatchingAudioBaseTrack(parentSeq, nestClip, nestClip.projectItem, parentStart, dbg);
      if (matchedBaseA !== null && matchedBaseA !== undefined) { baseA = matchedBaseA; }
      var nestWindow = _unNestSourceWindow(nestClip, parentStart, dbg);
      dbg.push('MULTI-NEST Undo: rozpakowuje "' + (restoreInfo.nestClipName || restoreInfo.nestedSequenceName || '') + '" z ' + primaryTrackType + (primaryTrackType === 'A' ? (baseA + 1) : (baseV + 1)) + ' @ ' + parentStart + '.');

      var nativeNeed = _unAnalyzeNativeCopyPasteNeed(nestedSeq, nestWindow, baseV, baseA, dbg);
      if (nativeNeed && nativeNeed.reasons && nativeNeed.reasons.length) {
        dbg.push('MULTI-NEST Undo: analiza copy/paste: ' + nativeNeed.reasons.join(' | '));
      }
      var nativeResult = _unTryNativeCopyPasteUnNest(parentSeq, nestedSeq, nestClip, parentStart, nestWindow, baseV, baseA, primaryTrackType, dbg);
      if (nativeResult && typeof nativeResult === 'string') {
        dbg.push('MULTI-NEST Undo: panel CEP wykona teraz natywne kopiuj/wklej dla tego NEST-a.');
        return dbg.join('\n') + '\n' + nativeResult;
      }
      if (nativeResult) {
        dbg.push('MULTI-NEST Undo: NEST rozpakowany bez etapu klawiaturowego.');
        return dbg.join('\n');
      }
      dbg.push('MULTI-NEST Undo: nie udalo sie przygotowac rozpakowania tego NEST-a.');
      return dbg.join('\n');
    } catch (e) {
      dbg.push('MULTI-NEST Undo ERROR: ' + e);
      return dbg.join('\n');
    }
  };

  AEDRNO.unNestNativePreparePasteAfterKeyboardCopy = function (payloadJson) {
    var dbg = [];
    dbg.push('=== Native UN NEST v1.12.190 Prepare Paste After Keyboard Copy ===');
    try {
      var info = _unParseJson(payloadJson);
      if (!info) { dbg.push('Native UN NEST: nie mogę odczytać payloadu po Ctrl+C.'); return dbg.join('\n'); }
      var nestedSeqForClear = _unFindSequenceByIdOrName(info.nestedSequenceId, info.nestedSequenceName);
      if (nestedSeqForClear) { _unClearSequenceInOutBest(nestedSeqForClear, dbg, 'NEST źródłowy po Ctrl+C'); }
      var parentSeq = _unFindSequenceByIdOrName(info.parentSequenceId, info.parentSequenceName);
      if (!parentSeq) { dbg.push('Native UN NEST: nie mogę znaleźć sekwencji głównej: ' + (info.parentSequenceName || info.parentSequenceId || '')); return dbg.join('\n'); }
      if (!_unOpenSequenceBest(parentSeq, dbg, 'sekwencja główna')) { return dbg.join('\n'); }
      _unSetPlayheadBest(parentSeq, Number(info.parentStart) || 0, dbg, 'sekwencja główna przed Paste');
      _unClearSequenceSelection(parentSeq);
      if (_unPrepareLocalVideoProtectionSelection(parentSeq, info, dbg)) {
        return dbg.join('\n') + '\n__UNNEST_NATIVE_NUDGE_UP__' + _unJsonValue(info) + '__END_UNNEST_NATIVE_NUDGE_UP__';
      }
      info.prePasteSnapshot = _unNativeTimelineSnapshot(parentSeq);
      dbg.push('Native UN NEST: zapisano snapshot timeline przed Ctrl+V, żeby trim nie dotykał starych klipów.');
      var nestClip = _unFindNestClipForNativeRestore(parentSeq, info);
      if (!nestClip) { dbg.push('Native UN NEST: nie znalazłem oryginalnego klipu NEST do usunięcia, przerywam przed Ctrl+V żeby nie wkleić duplikatów.'); return dbg.join('\n'); }
      if (!_unRemoveClipNoRipple(nestClip, dbg)) { dbg.push('Native UN NEST: nie udało się usunąć oryginalnego klipu NEST, przerywam przed Ctrl+V.'); return dbg.join('\n'); }
      _unSetPlayheadBest(parentSeq, Number(info.parentStart) || 0, dbg, 'sekwencja główna po usunięciu NEST');
      if (String(info.primaryTrackType || 'V') === 'A') {
        _unTargetTracksBest(parentSeq, dbg, 'sekwencja główna przed Paste', false, true);
      } else {
        _unTargetTracksBest(parentSeq, dbg, 'sekwencja główna przed Paste', true, false);
        dbg.push('Native UN NEST: przed Ctrl+V wyłączam targetowanie audio w sekwencji głównej, żeby wkleić tylko obraz z NEST-a video/audio-video bez blokowania ścieżek.');
      }
      dbg.push('Native UN NEST: gotowe do Ctrl+V. Panel CEP wykona teraz prawdziwe wklejenie klawiaturą.');
      return dbg.join('\n') + '\n__UNNEST_NATIVE_PASTE__' + _unJsonValue(info) + '__END_UNNEST_NATIVE_PASTE__';
    } catch (e) {
      dbg.push('Native UN NEST: błąd przygotowania Paste po Ctrl+C: ' + e);
      return dbg.join('\n');
    }
  };

  AEDRNO.unNestNativeFinalizeKeyboardPaste = function (payloadJson) {
    var dbg = [];
    dbg.push('=== Native UN NEST v1.12.190 Finalize Keyboard Paste ===');
    try {
      var info = _unParseJson(payloadJson);
      if (!info) { dbg.push('Native UN NEST: nie mogę odczytać payloadu po Ctrl+V.'); return dbg.join('\n'); }
      var parentSeq = _unFindSequenceByIdOrName(info.parentSequenceId, info.parentSequenceName);
      if (parentSeq) { _unOpenSequenceBest(parentSeq, dbg, 'sekwencja główna po Ctrl+V'); }
      if (parentSeq) {
        var pasteWindowStart = Number(info.parentStart) || 0;
        var pasteWindowDuration = Math.max(1, (Number(info.sourceOut) || 0) - (Number(info.sourceIn) || 0));
        var pasteWindowEnd = pasteWindowStart + pasteWindowDuration;
        var quickPasteCheck = _unNativeNewItemsCountSinceSnapshot(parentSeq, info.prePasteSnapshot || {}, pasteWindowStart, pasteWindowEnd);
        if (quickPasteCheck && quickPasteCheck.hasSnapshot) {
          dbg.push('Native UN NEST: szybki check po Ctrl+V: nowe elementy=' + quickPasteCheck.count + ' (V=' + quickPasteCheck.video + ', A=' + quickPasteCheck.audio + ').');
        }
      }
      if (parentSeq && String(info.primaryTrackType || 'V') !== 'A') {
        _unRemoveNativePastedAudioForVideoOnly(parentSeq, info, dbg);
      }
      if (parentSeq) { _unTrimNativePastedSelectionToParentWindow(parentSeq, info, dbg); }
      var sourceSeqForDelete = _unFindSequenceByIdOrName(info.nestedSequenceId, info.nestedSequenceName);
      var deletedSourceSeq = _unTryDeleteSourceSequenceAfterNative(sourceSeqForDelete, info, dbg);

      // v1.12.136: jezeli sekwencja zrodlowa zostaje w projekcie (np. multicam),
      // zamykamy jej zakladke z timeline. Nie robimy tego przez samo API closeSequence,
      // bo w wielu wersjach Premiere nie jest dostepne/stabilne. Zamiast tego ustawiamy
      // zrodlowy NEST jako aktywna zakladke, a panel CEP wykona Ctrl+W i po tym
      // przywroci sekwencje glowna.
      var shouldCloseSourceTab = false;
      if (info && info.sourceTabClosedAfterCopy) {
        dbg.push('Native UN NEST: zakładka źródłowego NEST-a została już zamknięta zaraz po Ctrl+C, więc pomijam końcowe Cmd/Ctrl+W.');
      } else if (sourceSeqForDelete && !deletedSourceSeq && !(info && info.deleteProjectSequenceAfterPaste)) {
        try {
          shouldCloseSourceTab = _unOpenSequenceBest(sourceSeqForDelete, dbg, 'NEST zrodlowy do zamkniecia zakladki');
          if (shouldCloseSourceTab) {
            dbg.push('Native UN NEST: sekwencja NEST zostaje w Project Panelu, wiec przygotowalem jej aktywna zakladke do zamkniecia przez Ctrl+W.');
          }
        } catch (cs0) {
          shouldCloseSourceTab = false;
          dbg.push('Native UN NEST: nie udalo sie przygotowac zakladki NEST do zamkniecia: ' + cs0);
        }
      }

      dbg.push('Native UN NEST: zakończono flow Ctrl+C/Ctrl+V. Jeżeli Premiere przyjęło skróty, elementy powinny być wklejone jako natywne TrackItemy z napisami/grafikami/Motion/multicam.');
      dbg.push('Native UN NEST: zaznaczonych elementów źródłowych było: ' + (info.selectedCount || 0) + '.');
      var undoPayload = _unNativeUndoPayloadForHistory(info, deletedSourceSeq);
      dbg.push('Native UN NEST: zapisano dane cofania przez historię Premiere. UndoSteps=' + (_unParseJson(undoPayload).undoSteps || '?') + '.');
      var undoMarker = '\n__UNNEST_UNDO__' + undoPayload + '__END_UNNEST_UNDO__';
      if (shouldCloseSourceTab) {
        return dbg.join('\n') + undoMarker + '\n__UNNEST_NATIVE_CLOSE_SOURCE__' + _unJsonValue(info) + '__END_UNNEST_NATIVE_CLOSE_SOURCE__';
      }
      return dbg.join('\n') + undoMarker;
    } catch (e) {
      dbg.push('Native UN NEST: błąd finalize po Ctrl+V: ' + e);
      return dbg.join('\n');
    }
  };


  AEDRNO.unNestNativeAfterCloseSourceTab = function (payloadJson) {
    var dbg = [];
    dbg.push('=== Native UN NEST v1.12.190 After Close Source Tab ===');
    try {
      var info = _unParseJson(payloadJson);
      if (!info) { dbg.push('Native UN NEST: po zamknieciu zakladki nie moge odczytac payloadu.'); return dbg.join('\n'); }
      var parentSeq = _unFindSequenceByIdOrName(info.parentSequenceId, info.parentSequenceName);
      if (parentSeq) {
        _unOpenSequenceBest(parentSeq, dbg, 'sekwencja glowna po zamknieciu zakladki NEST');
      } else {
        dbg.push('Native UN NEST: po zamknieciu zakladki nie moge znalezc sekwencji glownej.');
      }
      dbg.push('Native UN NEST: zamkniecie zakladki NEST zakonczone.');
      return dbg.join('\n');
    } catch (e) {
      dbg.push('Native UN NEST: blad po zamykaniu zakladki NEST: ' + e);
      return dbg.join('\n');
    }
  };


  AEDRNO.unNestSelected = function () {
    var dbg = [];
    dbg.push('=== UN NEST v1.12.190 Native Copy/Paste Video Audio ===');
    try {
      if (!app || !app.project || !app.project.activeSequence) {
        return 'UN NEST: Nie widzę aktywnej sekwencji Premiere.';
      }
      var seq = app.project.activeSequence;
      dbg.push('Aktywna sekwencja: ' + seq.name);
      var found = _unSelectedNestClip(seq, dbg);
      if (!found) {
        dbg.push('Nie znaleziono zaznaczonego klipu NEST. Zaznacz na timeline jeden klip będący zagnieżdżoną sekwencją i kliknij łopatę.');
        return dbg.join('\n');
      }

      var nestClip = found.clip;
      var nestedSeq = found.nestedSeq;
      var parentStart = _ssTicks(nestClip.start);
      var baseV = 0;
      var baseA = 0;
      var primaryTrackType = 'V';
      try {
        if (found.location && found.location.type === 'A') {
          primaryTrackType = 'A';
          baseA = Math.max(0, Number(found.location.index) || 0);
        } else if (found.location && found.location.type === 'V') {
          primaryTrackType = 'V';
          baseV = Math.max(0, Number(found.location.index) || 0);
        } else {
          baseV = Math.max(0, Number(nestClip.parentTrackIndex) || 0);
        }
      } catch (e0) {}
      var matchedBaseA = _unFindMatchingAudioBaseTrack(seq, nestClip, found.projectItem, parentStart, dbg);
      if (matchedBaseA !== null && matchedBaseA !== undefined) { baseA = matchedBaseA; }
      dbg.push('Start klipu NEST ticks: ' + parentStart);
      dbg.push('Bazowa ścieżka video: V' + (baseV + 1) + '. Bazowa ścieżka audio: A' + (baseA + 1) + '. Typ zaznaczonego NEST-a: ' + primaryTrackType + '.');
      dbg.push('Rozpakowywana sekwencja: ' + nestedSeq.name);

      var nestWindow = _unNestSourceWindow(nestClip, parentStart, dbg);
      var nativeNeed = _unAnalyzeNativeCopyPasteNeed(nestedSeq, nestWindow, baseV, baseA, dbg);
      if (nativeNeed && nativeNeed.reasons && nativeNeed.reasons.length) {
        dbg.push('Native UN NEST: analiza copy/paste: ' + nativeNeed.reasons.join(' | '));
      } else {
        dbg.push('Native UN NEST: prosty NEST — używam trybu copy/paste, bo zachowuje najwięcej stanu Premiere.');
      }

      var nativeResult = _unTryNativeCopyPasteUnNest(seq, nestedSeq, nestClip, parentStart, nestWindow, baseV, baseA, primaryTrackType, dbg);
      if (nativeResult) {
        if (typeof nativeResult === 'string') {
          dbg.push('Native UN NEST: czekam na panel CEP, który wykona Ctrl+C, wróci do sekwencji głównej i wykona Ctrl+V.');
          return dbg.join('\n') + '\n' + nativeResult;
        }
        dbg.push('UN NEST zakończony trybem Native Copy/Paste.');
        return dbg.join('\n');
      }

      dbg.push('Native UN NEST: tryb copy/paste nie zadziałał. Nie uruchamiam już starego fallbacku projectItem→overwriteClip, bo gubił napisy, Motion i multicam state.');
      dbg.push('UN NEST anulowany bez zmian w timeline.');
      return dbg.join('\n');
    } catch (e) {
      dbg.push('BŁĄD UN NEST: ' + e);
      return dbg.join('\n');
    }
  };

  AEDRNO.getProjectTimerIdentity = function () {
    function _jsonEsc(v) {
      try {
        return String(v || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, ' ').replace(/\n/g, ' ');
      } catch (e) { return ''; }
    }
    function _norm(v) { return String(v || '').replace(/\\/g, '/').replace(/\/+$/g, ''); }
    function _parts(v) {
      var s = _norm(v);
      if (!s) { return []; }
      var a = s.split('/');
      var out = [];
      for (var i = 0; i < a.length; i++) { if (a[i]) { out.push(a[i]); } }
      return out;
    }
    function _baseNameNoExt(fileName) {
      var s = _norm(fileName);
      var parts = s.split('/');
      s = parts[parts.length - 1] || s;
      return s.replace(/\.[^\.]+$/, '');
    }
    function _parentDir(path) {
      var s = _norm(path);
      var idx = s.lastIndexOf('/');
      return idx >= 0 ? s.substring(0, idx) : '';
    }
    function _settingsSafeName(name) {
      var s = String(name || 'Projekt Premiere');
      s = s.replace(/\.[^\.]+$/, '');
      s = s.replace(/[\\\/\:\*\?\"\<\>\|]/g, '_');
      return s || 'Projekt Premiere';
    }
    function _volumeName(path) {
      var parts = _parts(path);
      if (!parts.length) { return ''; }
      if (parts[0] === 'Volumes' && parts.length > 1) { return parts[1]; }
      if (/^[A-Za-z]:$/.test(parts[0])) {
        // Nie uruchamiamy żadnych skryptów .bat/CMD. Fallback: litera dysku.
        return parts[0].toUpperCase();
      }
      if ((parts[0] === 'media' || parts[0] === 'mnt') && parts.length > 1) { return parts.length > 2 ? parts[2] : parts[1]; }
      if (parts[0] === 'run' && parts[1] === 'media' && parts.length > 3) { return parts[3]; }
      return parts[0];
    }
    function _relInsideVolume(path) {
      var parts = _parts(path);
      if (!parts.length) { return ''; }
      if (parts[0] === 'Volumes' && parts.length > 2) { return parts.slice(2).join('/'); }
      if (/^[A-Za-z]:$/.test(parts[0])) { return parts.slice(1).join('/'); }
      if ((parts[0] === 'media' || parts[0] === 'mnt') && parts.length > 2) { return parts.slice(3).join('/'); }
      if (parts[0] === 'run' && parts[1] === 'media' && parts.length > 4) { return parts.slice(4).join('/'); }
      return parts.slice(1).join('/');
    }

    var name = '';
    var path = '';
    var settingsPath = '';
    try { if (app && app.project && app.project.name) { name = String(app.project.name || ''); } } catch (e1) {}
    try { if (app && app.project && app.project.path) { path = String(app.project.path || ''); } } catch (e2) {}
    if (!name && path) {
      try { name = _norm(path).split('/').pop() || ''; } catch (e3) {}
    }
    if (!name) { name = 'Niezapisany projekt Premiere'; }

    var base = _settingsSafeName(_baseNameNoExt(path || name));
    if (path) {
      try {
        var dir = _parentDir(path);
        if (dir) { settingsPath = dir + '/' + base + '_verni_settings.json'; }
      } catch (e4) { settingsPath = ''; }
    }

    var volume = path ? _volumeName(path) : '';
    var rel = path ? _relInsideVolume(path) : '';
    var key = '';
    if (path && volume && rel) { key = 'portable:' + volume.toLowerCase() + '/' + rel.toLowerCase(); }
    else if (path) { key = 'path:' + _norm(path).toLowerCase(); }
    else { key = 'unsaved:' + name.toLowerCase(); }

    return '{"key":"' + _jsonEsc(key) + '","name":"' + _jsonEsc(name) + '","path":"' + _jsonEsc(path) + '","settingsPath":"' + _jsonEsc(settingsPath) + '","volumeName":"' + _jsonEsc(volume) + '","relativePath":"' + _jsonEsc(rel) + '"}';
  };


}());
