(function () {
  function _ssNum(v, fallback) {
    var n = parseFloat(v);
    if (isNaN(n)) { return fallback; }
    return n;
  }

  function _ssInt(v, fallback) {
    var n = parseInt(v, 10);
    if (isNaN(n)) { return fallback; }
    return n;
  }

  function _ssName(o) {
    try { return String(o.name || ''); } catch (e) { return ''; }
  }

  function _ssHasVideoMediaType(item) {
    try {
      if (item && item.mediaType && String(item.mediaType).toLowerCase() === 'video') { return true; }
    } catch (e) {}
    try {
      if (item && item.projectItem && item.projectItem.getMediaPath) {
        var p = String(item.projectItem.getMediaPath() || '').toLowerCase();
        return /\.(mov|mp4|mxf|avi|m4v|mpg|mpeg|webm|mts|m2ts)$/i.test(p);
      }
    } catch (e2) {}
    return true;
  }

  function _ssTicks(obj) {
    try { return Number(obj.ticks); } catch (e) {}
    try { return Math.round(Number(obj.seconds) * 254016000000); } catch (e2) {}
    return 0;
  }

  function _ssGetSeqSize(seq) {
    var w = 1920, h = 1080;
    try {
      if (seq && seq.frameSizeHorizontal) { w = Number(seq.frameSizeHorizontal); }
      if (seq && seq.frameSizeVertical) { h = Number(seq.frameSizeVertical); }
    } catch (e) {}
    try {
      if ((!w || !h) && seq && seq.getSettings) {
        var st = seq.getSettings();
        if (st && st.videoFrameWidth) { w = Number(st.videoFrameWidth); }
        if (st && st.videoFrameHeight) { h = Number(st.videoFrameHeight); }
        if (st && st.frameSizeHorizontal) { w = Number(st.frameSizeHorizontal); }
        if (st && st.frameSizeVertical) { h = Number(st.frameSizeVertical); }
      }
    } catch (e2) {}
    if (!w || isNaN(w)) { w = 1920; }
    if (!h || isNaN(h)) { h = 1080; }
    return { w: w, h: h };
  }

  function _ssGetClipSize(clip, seqSize) {
    var w = seqSize.w, h = seqSize.h;
    try {
      var pi = clip.projectItem;
      if (pi && pi.getProjectMetadata) {
        var md = String(pi.getProjectMetadata() || '');
        var m = md.match(/(\d{3,6})\s*[xX]\s*(\d{3,6})/);
        if (m) {
          w = Number(m[1]);
          h = Number(m[2]);
        }
      }
    } catch (e) {}
    try {
      var pi2 = clip.projectItem;
      if (pi2) {
        if (pi2.videoFrameWidth) { w = Number(pi2.videoFrameWidth); }
        if (pi2.videoFrameHeight) { h = Number(pi2.videoFrameHeight); }
      }
    } catch (e2) {}
    if (!w || isNaN(w)) { w = seqSize.w; }
    if (!h || isNaN(h)) { h = seqSize.h; }
    return { w: w, h: h };
  }

  function _ssComponentName(c) {
    var a = '';
    try { a += String(c.displayName || '') + ' '; } catch (e) {}
    try { a += String(c.matchName || '') + ' '; } catch (e2) {}
    return a.toLowerCase();
  }

  function _ssFindComponent(clip, names) {
    try {
      if (!clip || !clip.components) { return null; }
      for (var i = 0; i < clip.components.numItems; i++) {
        var c = clip.components[i];
        var n = _ssComponentName(c);
        for (var j = 0; j < names.length; j++) {
          if (n.indexOf(String(names[j]).toLowerCase()) !== -1) { return c; }
        }
      }
    } catch (e) {}
    return null;
  }

  function _ssComponentHasCropProps(component) {
    try {
      if (!component || !component.properties) { return false; }
      var hasL = false, hasT = false, hasR = false, hasB = false;
      for (var i = 0; i < component.properties.numItems; i++) {
        var n = _ssPropName(component.properties[i]);
        if (n.indexOf('crop left') !== -1 || n.indexOf('left') !== -1 || n.indexOf('lewo') !== -1) { hasL = true; }
        if (n.indexOf('crop top') !== -1 || n.indexOf('top') !== -1 || n.indexOf('góra') !== -1 || n.indexOf('gora') !== -1) { hasT = true; }
        if (n.indexOf('crop right') !== -1 || n.indexOf('right') !== -1 || n.indexOf('prawo') !== -1) { hasR = true; }
        if (n.indexOf('crop bottom') !== -1 || n.indexOf('bottom') !== -1 || n.indexOf('dół') !== -1 || n.indexOf('dol') !== -1) { hasB = true; }
      }
      return hasL && hasT && hasR && hasB;
    } catch (e) {}
    return false;
  }

  function _ssIsMotionComponent(component) {
    var n = _ssComponentName(component);
    return n.indexOf('adbe motion') !== -1 || n.indexOf('motion') !== -1 || n.indexOf('ruch') !== -1;
  }

  function _ssIsSeparateTransformComponent(component) {
    var n = _ssComponentName(component);
    if (_ssIsMotionComponent(component)) { return false; }
    // Premiere's Transform effect is often exposed as AE.ADBE Geometry / Geometry2.
    return n.indexOf('transform') !== -1 || n.indexOf('przeksz') !== -1 || n.indexOf('geometry') !== -1 || n.indexOf('geometr') !== -1;
  }

  function _ssIsDedicatedCropComponent(component) {
    if (!component) { return false; }
    if (_ssIsMotionComponent(component)) { return false; }
    if (_ssIsSeparateTransformComponent(component)) { return false; }
    var n = _ssComponentName(component);
    return n.indexOf('crop') !== -1 || n.indexOf('kadrow') !== -1 || n.indexOf('przytn') !== -1 || _ssComponentHasCropProps(component);
  }

  function _ssEffectNameMatches(effect, names) {
    var txt = '';
    try { txt += String(effect.displayName || '') + ' '; } catch (e0) {}
    try { txt += String(effect.name || '') + ' '; } catch (e1) {}
    try { txt += String(effect.matchName || '') + ' '; } catch (e2) {}
    try { txt += String(effect.localizedName || '') + ' '; } catch (e3) {}
    try { txt += String(effect.category || '') + ' '; } catch (e4) {}
    try { txt += String(effect || '') + ' '; } catch (e5) {}
    txt = txt.toLowerCase();
    for (var i = 0; i < names.length; i++) {
      var needle = String(names[i] || '').toLowerCase();
      if (needle && txt.indexOf(needle) !== -1) { return true; }
    }
    return false;
  }

  function _ssEffectReadableName(effect) {
    var out = [];
    try { if (effect.displayName) { out.push('displayName=' + effect.displayName); } } catch (e0) {}
    try { if (effect.name) { out.push('name=' + effect.name); } } catch (e1) {}
    try { if (effect.matchName) { out.push('matchName=' + effect.matchName); } } catch (e2) {}
    try { if (effect.localizedName) { out.push('localizedName=' + effect.localizedName); } } catch (e3) {}
    try { if (!out.length) { out.push(String(effect)); } } catch (e4) {}
    return out.join(', ');
  }

  function _ssCandidateEffectNames(effect) {
    var arr = [];
    function add(v) {
      try {
        v = String(v || '');
        if (!v) { return; }
        for (var i = 0; i < arr.length; i++) { if (arr[i] === v) { return; } }
        arr.push(v);
      } catch (e) {}
    }
    try { add(effect.displayName); } catch (e0) {}
    try { add(effect.name); } catch (e1) {}
    try { add(effect.matchName); } catch (e2) {}
    try { add(effect.localizedName); } catch (e3) {}
    try { add(effect); } catch (e4) {}
    return arr;
  }



  function _ssUniquePush(arr, value) {
    try {
      value = String(value || '');
      if (!value) { return; }
      for (var i = 0; i < arr.length; i++) { if (arr[i] === value) { return; } }
      arr.push(value);
    } catch (e) {}
  }

  function _ssGetShortcakesEffectListStrings(dbg) {
    var out = [];
    try { if (app.enableQE) { app.enableQE(); } } catch (e0) {}

    function harvest(v, src) {
      if (!v) { return; }
      try {
        if (typeof v === 'string') {
          var txt = String(v);
          try {
            var parsed = JSON.parse(txt);
            harvest(parsed, src + ':json');
            return;
          } catch (eJson) {}
          // QE often returns a JSON-looking list of localized effect names. If parsing fails,
          // still pull quoted names and then lines.
          var re = /"([^"]+)"/g, m;
          while ((m = re.exec(txt)) !== null) { _ssUniquePush(out, m[1]); }
          var lines = txt.split(/[\r\n]+/);
          for (var l = 0; l < lines.length; l++) {
            var line = String(lines[l] || '').replace(/^\s+|\s+$/g, '');
            if (line && line.length < 80) { _ssUniquePush(out, line); }
          }
          return;
        }
      } catch (eS) {}
      try {
        var len = 0;
        try { len = v.length !== undefined ? v.length : v.numItems; } catch (eLen) {}
        if (len && len > 0) {
          for (var i = 0; i < len; i++) {
            try { _ssUniquePush(out, v[i]); } catch (eI) {}
          }
          return;
        }
      } catch (eArr) {}
      try { _ssUniquePush(out, v); } catch (eObj) {}
    }

    try {
      if (typeof qe !== 'undefined' && qe.project && qe.project.getVideoEffectList) {
        harvest(qe.project.getVideoEffectList(), 'qe.project.getVideoEffectList');
      }
    } catch (eQE) { if (dbg) { dbg.push('Shortcakes resolver: qe.project.getVideoEffectList ERR: ' + eQE); } }
    try {
      if (app.project && app.project.getVideoEffectList) {
        harvest(app.project.getVideoEffectList(), 'app.project.getVideoEffectList');
      }
    } catch (eApp) { if (dbg) { dbg.push('Shortcakes resolver: app.project.getVideoEffectList ERR: ' + eApp); } }

    if (dbg) {
      dbg.push('Shortcakes resolver: lista efektów video, liczba nazw=' + out.length);
      var sample = [];
      for (var si = 0; si < out.length && sample.length < 20; si++) {
        var low = String(out[si]).toLowerCase();
        if (low.indexOf('crop') !== -1 || low.indexOf('kadrow') !== -1 || low.indexOf('transform') !== -1 || low.indexOf('przeks') !== -1 || low.indexOf('geometry') !== -1) {
          sample.push(out[si]);
        }
      }
      if (sample.length) { dbg.push('Shortcakes resolver: próbka nazw efektów=' + sample.join(' | ')); }
    }
    return out;
  }

  function _ssResolveVideoEffectShortcakesStyle(effectKind, dbg) {
    var preferred;
    if (effectKind === 'transform') {
      preferred = ['Transform', 'Przekształć', 'Przeksztalc', 'Transformacja', 'Transformation', 'Transformieren', 'Transformar', 'Trasforma', 'トランスフォーム', '变换', '변형'];
    } else {
      preferred = ['Crop', 'Kadrowanie', 'Przytnij', 'Przycinanie', 'Rogner', 'Recadrer', 'Ritaglia', 'Cortar', 'クロップ', '裁剪'];
    }
    var list = _ssGetShortcakesEffectListStrings(dbg);
    var chosen = null;
    for (var p = 0; p < preferred.length && !chosen; p++) {
      for (var i = 0; i < list.length; i++) {
        if (String(list[i]) === String(preferred[p])) { chosen = String(list[i]); break; }
      }
    }
    // If exact localized name is not found, use a careful contains fallback, but prefer display names,
    // not AE.ADBE technical names. Shortcakes does exact localized-name matching first.
    if (!chosen) {
      for (var j = 0; j < list.length; j++) {
        var n = String(list[j] || '');
        var l = n.toLowerCase();
        if (effectKind === 'transform') {
          if ((l.indexOf('transform') !== -1 || l.indexOf('przeksz') !== -1) && l.indexOf('text') === -1) { chosen = n; break; }
        } else {
          if (l.indexOf('crop') !== -1 || l.indexOf('kadrow') !== -1 || l.indexOf('przytn') !== -1) { chosen = n; break; }
        }
      }
    }
    if (!chosen) {
      if (dbg) { dbg.push('Shortcakes resolver: nie znaleziono lokalizowanej nazwy dla ' + effectKind + '.'); }
      return null;
    }
    try { if (app.enableQE) { app.enableQE(); } } catch (e0) {}
    try {
      if (typeof qe !== 'undefined' && qe.project && qe.project.getVideoEffectByName) {
        var fx = qe.project.getVideoEffectByName(chosen);
        if (fx) {
          if (dbg) { dbg.push('Shortcakes resolver: wybrano efekt po nazwie z listy: ' + chosen); }
          return {effect: fx, addName: chosen, source: 'shortcakes.qe.localizedName'};
        }
      }
    } catch (eQE) { if (dbg) { dbg.push('Shortcakes resolver getVideoEffectByName("' + chosen + '") ERR: ' + eQE); } }
    return null;
  }

  function _ssGetQEActiveSequence() {
    try { if (app.enableQE) { app.enableQE(); } } catch (e0) {}
    try {
      if (typeof qe !== 'undefined' && qe.project && qe.project.getActiveSequence) {
        return qe.project.getActiveSequence();
      }
    } catch (e1) {}
    return null;
  }

  function _ssTicksLoose(v) {
    try { if (v && v.ticks !== undefined) { return String(v.ticks); } } catch (e0) {}
    try { if (v && v.seconds !== undefined) { return String(v.seconds); } } catch (e1) {}
    try { return String(v); } catch (e2) {}
    return '';
  }

  function _ssFindQEClipForTrackItem(clip, dbg) {
    try {
      var qseq = _ssGetQEActiveSequence();
      if (!qseq || !qseq.getVideoTrackAt) { if (dbg) { dbg.push('QE: brak aktywnej sekwencji QE albo getVideoTrackAt.'); } return null; }
      var trackIndex = 0;
      try { trackIndex = Number(clip.parentTrackIndex); } catch (e0) {}
      var qTrack = qseq.getVideoTrackAt(trackIndex);
      if (!qTrack) { if (dbg) { dbg.push('QE: brak ścieżki video index=' + trackIndex); } return null; }
      var targetName = String(_ssName(clip));
      var targetStart = _ssTicks(clip.start);
      var count = 0;
      try { count = qTrack.numItems; } catch (e1) {}
      if (!count && qTrack.getItemAt) {
        // Some QE builds don't expose numItems reliably; try a modest scan.
        count = 200;
      }
      var firstNameMatch = null;
      for (var i = 0; i < count; i++) {
        var qc = null;
        try { qc = qTrack.getItemAt(i); } catch (e2) { qc = null; }
        if (!qc) { continue; }
        var qn = '';
        try { qn = String(qc.name || ''); } catch (e3) {}
        var qs = '';
        try { qs = _ssTicksLoose(qc.start); } catch (e4) {}
        if (qn === targetName && !firstNameMatch) { firstNameMatch = qc; }
        if (qn === targetName && (qs === String(targetStart) || qs === '' || String(targetStart) === '0')) {
          if (dbg) { dbg.push('QE: dopasowano klip "' + targetName + '" na V' + (trackIndex + 1) + ', itemIndex=' + i); }
          return qc;
        }
      }
      if (firstNameMatch) {
        if (dbg) { dbg.push('QE: dopasowano klip po nazwie bez pewnego startu: "' + targetName + '"'); }
        return firstNameMatch;
      }
      if (dbg) { dbg.push('QE: nie znaleziono odpowiednika klipu "' + targetName + '" na V' + (trackIndex + 1)); }
    } catch (e) {
      if (dbg) { dbg.push('QE: błąd szukania klipu: ' + e); }
    }
    return null;
  }

  function _ssQEProjectGetEffectByName(name, dbg) {
    var fx = null;
    try { if (app.enableQE) { app.enableQE(); } } catch (e0) {}
    try {
      if (typeof qe !== 'undefined' && qe.project && qe.project.getVideoEffectByName) {
        fx = qe.project.getVideoEffectByName(name);
        if (fx) { return fx; }
      }
    } catch (e1) { if (dbg) { dbg.push('QE getVideoEffectByName("' + name + '") ERR: ' + e1); } }
    return null;
  }

  function _ssGetVideoEffectListCandidates(matchTerms, dbg) {
    var found = [];
    function addCandidate(c, src) {
      try {
        if (!c) { return; }
        if (!_ssEffectNameMatches(c, matchTerms)) { return; }
        found.push({effect: c, src: src, readable: _ssEffectReadableName(c), names: _ssCandidateEffectNames(c)});
      } catch (e) {}
    }

    function scanList(list, src) {
      if (!list) { return; }
      try {
        var len = 0;
        try { len = list.length !== undefined ? list.length : list.numItems; } catch (eLen) {}
        if (len && len > 0) {
          for (var i = 0; i < len; i++) {
            try { addCandidate(list[i], src + '[' + i + ']'); } catch (eA) {}
          }
          return;
        }
      } catch (e0) {}
      try {
        var txt = String(list);
        // Some QE builds return a single giant text/XML/JSON-like list. Pull out lines with likely names.
        var lines = txt.split(/[\r\n]+/);
        for (var j = 0; j < lines.length; j++) {
          var line = lines[j];
          if (!line) { continue; }
          var obj = {name: line, displayName: line, matchName: line};
          addCandidate(obj, src + ':textline');
        }
      } catch (e1) {}
    }

    try {
      if (app.project && app.project.getVideoEffectList) {
        scanList(app.project.getVideoEffectList(), 'app.project.getVideoEffectList');
      }
    } catch (eAppList) { if (dbg) { dbg.push('app.project.getVideoEffectList ERR: ' + eAppList); } }

    try { if (app.enableQE) { app.enableQE(); } } catch (eQE0) {}
    try {
      if (typeof qe !== 'undefined' && qe.project && qe.project.getVideoEffectList) {
        scanList(qe.project.getVideoEffectList(), 'qe.project.getVideoEffectList');
      }
    } catch (eQEList) { if (dbg) { dbg.push('qe.project.getVideoEffectList ERR: ' + eQEList); } }

    if (dbg) {
      dbg.push('Effect Resolver: kandydaci dla [' + matchTerms.join(' / ') + '] = ' + found.length);
      for (var k = 0; k < Math.min(found.length, 12); k++) {
        dbg.push('  kandydat ' + (k + 1) + ': ' + found[k].src + ' -> ' + found[k].readable);
      }
    }
    return found;
  }

  function _ssResolveVideoEffect(effectKind, dbg) {
    // v1.11.7: Shortcakes-style resolving. Prefer the exact localized display name
    // returned by qe.project.getVideoEffectList(), then call getVideoEffectByName() with that name.
    // Technical names like AE.ADBE Geometry2 can resolve to an object but may not materialize
    // as a visible effect on the TrackItem in some Premiere builds.
    var scResolved = _ssResolveVideoEffectShortcakesStyle(effectKind, dbg);
    if (scResolved) { return scResolved; }

    var directNames;
    var matchTerms;
    if (effectKind === 'transform') {
      // Shortcakes-style resolving: prefer technical names from the full Premiere/QE effect list.
      matchTerms = ['AE.ADBE Geometry2', 'AE.ADBE Geometry', 'ADBE Geometry2', 'ADBE Geometry', 'Geometry2', 'Geometry', 'Transform', 'Przekształ', 'Przeksztal', 'Transformacja'];
      directNames = ['Transform', 'Przekształć', 'Przeksztalc', 'Transformacja', 'Transformation', 'Transformieren', 'Transformar', 'AE.ADBE Geometry2', 'AE.ADBE Geometry', 'ADBE Geometry2', 'ADBE Geometry', 'Geometry2', 'Geometry'];
    } else {
      matchTerms = ['AE.ADBE Crop', 'ADBE Crop', 'Crop', 'Kadrowanie', 'Przytnij', 'Przycinanie'];
      directNames = ['Crop', 'Kadrowanie', 'Przytnij', 'Przycinanie', 'Rogner', 'Recadrer', 'Ritaglia', 'Cortar', 'AE.ADBE Crop', 'ADBE Crop', 'Crop Edges'];
    }

    var tried = [];
    function tryName(n) {
      if (!n) { return null; }
      for (var t = 0; t < tried.length; t++) { if (tried[t] === n) { return null; } }
      tried.push(n);
      var fx = null;
      try {
        if (app.project && app.project.getVideoEffectByName) {
          fx = app.project.getVideoEffectByName(n);
          if (fx) { if (dbg) { dbg.push('Effect Resolver: app.project.getVideoEffectByName OK: ' + n); } return {effect: fx, addName: n, source: 'app.project.getVideoEffectByName'}; }
        }
      } catch (eApp) { if (dbg) { dbg.push('Effect Resolver app name ERR "' + n + '": ' + eApp); } }
      fx = _ssQEProjectGetEffectByName(n, dbg);
      if (fx) { if (dbg) { dbg.push('Effect Resolver: qe.project.getVideoEffectByName OK: ' + n); } return {effect: fx, addName: n, source: 'qe.project.getVideoEffectByName'}; }
      return null;
    }

    // 1) Direct technical/display names.
    for (var i = 0; i < directNames.length; i++) {
      var direct = tryName(directNames[i]);
      if (direct) { return direct; }
    }

    // 2) Full list scan, then retry all names returned by Premiere/QE for each candidate.
    var candidates = _ssGetVideoEffectListCandidates(matchTerms, dbg);
    for (var c = 0; c < candidates.length; c++) {
      var ns = candidates[c].names || [];
      for (var n = 0; n < ns.length; n++) {
        var got = tryName(ns[n]);
        if (got) {
          got.listCandidate = candidates[c].readable;
          if (dbg) { dbg.push('Effect Resolver: wybrano z listy: ' + candidates[c].readable); }
          return got;
        }
      }
    }

    if (dbg) { dbg.push('Effect Resolver: nie znaleziono efektu typu ' + effectKind + '. Próbowano: ' + tried.join(' / ')); }
    return null;
  }

  function _ssAddResolvedVideoEffectToClip(clip, resolved, dbg) {
    if (!clip || !resolved || !resolved.effect) { return false; }

    // v1.11.7: when the effect comes from QE/localized list, add it via QE first,
    // matching Shortcakes' behavior. TrackItem.addVideoEffect with a QE effect object
    // can silently fail or not appear in components.
    try {
      if (resolved.source && String(resolved.source).indexOf('shortcakes.qe') !== -1) {
        var qeClipFirst = _ssFindQEClipForTrackItem(clip, dbg);
        if (qeClipFirst && qeClipFirst.addVideoEffect) {
          qeClipFirst.addVideoEffect(resolved.effect);
          if (dbg) { dbg.push('Dodano efekt przez QE clip.addVideoEffect / Shortcakes-style: ' + (resolved.addName || resolved.source)); }
          return true;
        }
      }
    } catch (eFirst) { if (dbg) { dbg.push('QE Shortcakes-style add ERR: ' + eFirst); } }

    try {
      if (clip.addVideoEffect) {
        clip.addVideoEffect(resolved.effect);
        if (dbg) { dbg.push('Dodano efekt przez TrackItem.addVideoEffect: ' + (resolved.addName || resolved.source)); }
        return true;
      }
    } catch (e0) { if (dbg) { dbg.push('TrackItem.addVideoEffect ERR: ' + e0); } }

    // QE fallback — this is the path many panels use when normal TrackItem.addVideoEffect refuses effects.
    try {
      var qeClip = _ssFindQEClipForTrackItem(clip, dbg);
      if (qeClip && qeClip.addVideoEffect) {
        qeClip.addVideoEffect(resolved.effect);
        if (dbg) { dbg.push('Dodano efekt przez QE clip.addVideoEffect: ' + (resolved.addName || resolved.source)); }
        return true;
      }
    } catch (e1) { if (dbg) { dbg.push('QE clip.addVideoEffect ERR: ' + e1); } }

    // QE fallback 2: if the resolved effect was from app.project, resolve again by name in QE.
    try {
      var qeFx = _ssQEProjectGetEffectByName(resolved.addName, dbg);
      var qeClip2 = _ssFindQEClipForTrackItem(clip, dbg);
      if (qeFx && qeClip2 && qeClip2.addVideoEffect) {
        qeClip2.addVideoEffect(qeFx);
        if (dbg) { dbg.push('Dodano efekt przez QE fallback name: ' + resolved.addName); }
        return true;
      }
    } catch (e2) { if (dbg) { dbg.push('QE fallback name ERR: ' + e2); } }

    return false;
  }

  function _ssRefreshTrackItem(clip, dbg) {
    try {
      var seq = app.project.activeSequence;
      if (!seq || !seq.videoTracks) { return clip; }
      var trackIndex = 0;
      try { trackIndex = Number(clip.parentTrackIndex); } catch (e0) { trackIndex = 0; }
      var vt = seq.videoTracks[trackIndex];
      if (!vt || !vt.clips) { return clip; }
      var targetName = String(_ssName(clip));
      var targetStart = _ssTicks(clip.start);
      var targetEnd = _ssTicks(clip.end);
      var best = null;
      for (var i = 0; i < vt.clips.numItems; i++) {
        var c = vt.clips[i];
        if (!c) { continue; }
        if (String(_ssName(c)) !== targetName) { continue; }
        var cs = _ssTicks(c.start);
        var ce = _ssTicks(c.end);
        if (Math.abs(cs - targetStart) <= 10 || Math.abs(ce - targetEnd) <= 10) {
          best = c;
          break;
        }
        if (!best) { best = c; }
      }
      if (best) {
        if (dbg) { dbg.push('Odświeżono TrackItem po dodaniu efektu: "' + targetName + '" V' + (trackIndex + 1)); }
        return best;
      }
    } catch (e) {
      if (dbg) { dbg.push('Refresh TrackItem ERR: ' + e); }
    }
    return clip;
  }

  function _ssFindComponentByPredicate(clip, predicate) {
    try {
      if (!clip || !clip.components) { return null; }
      for (var i = 0; i < clip.components.numItems; i++) {
        var c = clip.components[i];
        if (predicate(c)) { return c; }
      }
    } catch (e) {}
    return null;
  }

  function _ssWaitForComponentAfterQE(clip, predicate, label, dbg) {
    var current = clip;
    for (var attempt = 1; attempt <= 8; attempt++) {
      try { $.sleep(120); } catch (e0) {}
      current = _ssRefreshTrackItem(current, dbg);
      var c = _ssFindComponentByPredicate(current, predicate);
      if (c) {
        if (dbg) { dbg.push(label + ': komponent widoczny po odświeżeniu, próba ' + attempt + ' = ' + _ssComponentName(c)); }
        return { clip: current, component: c };
      }
      try {
        if (dbg && current && current.components) { dbg.push(label + ': po próbie ' + attempt + ' komponentów=' + current.components.numItems); }
      } catch (e1) {}
    }
    return { clip: current, component: null };
  }

  function _ssRemoveComponent(component, dbg) {
    try { component.remove(); return true; } catch (e) {}
    try { component.removeFromClip(); return true; } catch (e2) {}
    if (dbg) { dbg.push('Nie udało się usunąć starego efektu: ' + _ssComponentName(component)); }
    return false;
  }

  function _ssRemoveOldSplitEffects(clip, dbg) {
    try {
      if (!clip || !clip.components) { return; }
      for (var i = clip.components.numItems - 1; i >= 0; i--) {
        var c = clip.components[i];
        if (_ssIsSeparateTransformComponent(c) || _ssIsDedicatedCropComponent(c)) {
          _ssRemoveComponent(c, dbg);
        }
      }
    } catch (e) {
      if (dbg) { dbg.push('Błąd usuwania starych efektów Transform/Crop: ' + e); }
    }
  }

  function _ssGetOrAddTransformComponent(clip, dbg) {
    var currentClip = _ssRefreshTrackItem(clip, dbg);
    var existing = _ssFindComponentByPredicate(currentClip, _ssIsSeparateTransformComponent);
    if (existing) { return { clip: currentClip, component: existing }; }

    var resolved = _ssResolveVideoEffect('transform', dbg);
    var added = false;
    if (resolved) {
      added = _ssAddResolvedVideoEffectToClip(currentClip, resolved, dbg);
    }

    var waited = _ssWaitForComponentAfterQE(currentClip, _ssIsSeparateTransformComponent, 'Transform', dbg);
    if (waited.component) { return { clip: waited.clip, component: waited.component }; }

    // If QE says it added the effect but ExtendScript has not refreshed components yet,
    // we still return the refreshed clip and log it clearly. User may see the effect in Premiere after the eval returns.
    if (added && dbg) { dbg.push('Transform: QE zgłosiło dodanie efektu, ale ExtendScript nie odświeżył listy components w tym przebiegu.'); }
    if (dbg) { dbg.push('Nie udało się znaleźć/dodać osobnego efektu Transform.'); }
    return { clip: waited.clip || currentClip, component: null };
  }

  function _ssGetOrAddDedicatedCropComponent(clip, dbg) {
    var currentClip = _ssRefreshTrackItem(clip, dbg);
    var existing = _ssFindComponentByPredicate(currentClip, _ssIsDedicatedCropComponent);
    if (existing) { return { clip: currentClip, component: existing }; }

    var resolved = _ssResolveVideoEffect('crop', dbg);
    var added = false;
    if (resolved) {
      added = _ssAddResolvedVideoEffectToClip(currentClip, resolved, dbg);
    }

    var waited = _ssWaitForComponentAfterQE(currentClip, _ssIsDedicatedCropComponent, 'Crop', dbg);
    if (waited.component) { return { clip: waited.clip, component: waited.component }; }

    if (added && dbg) { dbg.push('Crop: QE zgłosiło dodanie efektu, ale ExtendScript nie odświeżył listy components w tym przebiegu.'); }
    if (dbg) { dbg.push('Nie udało się znaleźć/dodać osobnego efektu Crop/Kadrowanie. Fallback: crop w Motion, jeśli dostępny.'); }
    return { clip: waited.clip || currentClip, component: null };
  }

  function _ssResetMotionCrop(clip) {
    try {
      var motion = _ssFindComponent(clip, ['motion', 'ruch', 'adbe motion']);
      if (motion && _ssComponentHasCropProps(motion)) {
        _ssSetCrop(motion, 0, 0, 0, 0);
      }
    } catch (e) {}
  }

  function _ssPrepareSplitEffects(clip, dbg) {
    var currentClip = _ssRefreshTrackItem(clip, dbg);
    _ssRemoveOldSplitEffects(currentClip, dbg);
    _ssResetMotionCrop(currentClip);
    // Kolejność jest ważna: Transform przed Cropem. Dzięki temu ręczne przesuwanie Position w Transformie
    // przesuwa obraz pod stałą maską Crop, bez zmiany podziału ekranu.
    var trPack = _ssGetOrAddTransformComponent(currentClip, dbg);
    currentClip = trPack.clip || currentClip;
    var crPack = _ssGetOrAddDedicatedCropComponent(currentClip, dbg);
    currentClip = crPack.clip || currentClip;
    return { clip: currentClip, transform: trPack.component, crop: crPack.component };
  }

  function _ssPropName(p) {
    var a = '';
    try { a += String(p.displayName || '') + ' '; } catch (e) {}
    try { a += String(p.matchName || '') + ' '; } catch (e2) {}
    return a.toLowerCase();
  }

  function _ssFindProp(component, names, fallbackIndex) {
    try {
      if (!component || !component.properties) { return null; }
      for (var i = 0; i < component.properties.numItems; i++) {
        var p = component.properties[i];
        var n = _ssPropName(p);
        for (var j = 0; j < names.length; j++) {
          if (n.indexOf(String(names[j]).toLowerCase()) !== -1) { return p; }
        }
      }
      if (fallbackIndex !== null && fallbackIndex !== undefined && component.properties.numItems > fallbackIndex) {
        return component.properties[fallbackIndex];
      }
    } catch (e) {}
    return null;
  }

  function _ssSetProp(prop, value) {
    if (!prop) { return false; }
    try { prop.setValue(value, true); return true; } catch (e) {}
    try { prop.setValue(value); return true; } catch (e2) {}
    return false;
  }


  function _ssSetTransformIdentity(transform, seqSize, dbg) {
    if (!transform) { return false; }
    // WAŻNE: nie ustawiamy ręcznie Position/Anchor Point w osobnym efekcie Transform.
    // W niektórych wersjach Premiere efekt Transform dodany przez QE ma inny układ właściwości
    // niż fixed Motion; ustawianie go przez ExtendScript potrafi wpisać wartości typu 32767,0
    // i po ręcznym przesunięciu robi czarny ekran.
    // Dlatego zostawiamy Transform w stanie domyślnym po dodaniu efektu.
    // Podział ekranu robi Motion + osobny Crop, a Transform pozostaje neutralnym efektem
    // do ręcznego przesuwania obrazu wewnątrz wycięcia.
    if (dbg) { dbg.push('Transform pozostawiony w wartościach domyślnych Premiere; nie ustawiam Position/Anchor/Scale przez skrypt.'); }
    return true;
  }

  function _ssSetCrop(crop, left, top, right, bottom) {
    if (!crop) { return false; }
    var ok = true;
    // Premiere Crop properties are usually Left, Top, Right, Bottom. Fallback indexes match that order.
    ok = _ssSetProp(_ssFindProp(crop, ['left', 'lewo'], 0), left) && ok;
    ok = _ssSetProp(_ssFindProp(crop, ['top', 'góra', 'gora'], 1), top) && ok;
    ok = _ssSetProp(_ssFindProp(crop, ['right', 'prawo'], 2), right) && ok;
    ok = _ssSetProp(_ssFindProp(crop, ['bottom', 'dół', 'dol'], 3), bottom) && ok;
    return ok;
  }

  function _ssSetMotion(clip, x, y, scale, seqSize) {
    var motion = _ssFindComponent(clip, ['motion', 'ruch', 'adbe motion']);
    if (!motion) { return false; }
    var ok = true;
    var posX = x;
    var posY = y;
    // Motion > Position w Premiere przez ExtendScript oczekuje najczęściej wartości znormalizowanych 0-1,
    // nie pikseli. Poprzednio 640/1080 spychało obraz daleko poza ekran.
    try {
      if (seqSize && seqSize.w && seqSize.h) {
        posX = x / seqSize.w;
        posY = y / seqSize.h;
      }
    } catch (e0) {}
    ok = _ssSetProp(_ssFindProp(motion, ['position', 'położenie', 'polozenie'], 0), [posX, posY]) && ok;
    ok = _ssSetProp(_ssFindProp(motion, ['scale', 'skala'], 1), scale) && ok;
    return ok;
  }

  function _ssSelectedVideoClips(seq) {
    var arr = [];
    try {
      var sel = seq.getSelection();
      if (!sel) { return arr; }
      var len = sel.length !== undefined ? sel.length : sel.numItems;
      for (var i = 0; i < len; i++) {
        var c = sel[i];
        if (!c) { continue; }
        if (_ssHasVideoMediaType(c)) { arr.push(c); }
      }
    } catch (e) {}
    return arr;
  }

  function _ssSortClips(arr, orderByTracks) {
    arr.sort(function (a, b) {
      var at = 0, bt = 0;
      try { at = Number(a.parentTrackIndex); } catch (e) {}
      try { bt = Number(b.parentTrackIndex); } catch (e2) {}
      var as = 0, bs = 0;
      try { as = _ssTicks(a.start); } catch (e3) {}
      try { bs = _ssTicks(b.start); } catch (e4) {}
      if (orderByTracks) {
        if (at !== bt) { return at - bt; }
        if (as !== bs) { return as - bs; }
      } else {
        if (as !== bs) { return as - bs; }
        if (at !== bt) { return at - bt; }
      }
      return String(_ssName(a)).localeCompare(String(_ssName(b)));
    });
    return arr;
  }



  AEDRNO.applySplitScreen = function (xCount, yCount, gapX, gapY, mode, orderByTracks) {
    var dbg = [];
    try {
      var seq = app.project.activeSequence;
      if (!seq) { return 'Dzielenie ekranu: brak aktywnej sekwencji.'; }

      var cols = Math.max(1, _ssInt(xCount, 1));
      var rows = Math.max(1, _ssInt(yCount, 1));
      var gx = Math.max(0, _ssNum(gapX, 0));
      var gy = Math.max(0, _ssNum(gapY, 0));
      var fillMode = String(mode || 'fill') === 'fit' ? 'fit' : 'fill';
      var byTracks = (orderByTracks !== false && String(orderByTracks) !== 'false');

      var clips = _ssSelectedVideoClips(seq);
      if (!clips || clips.length === 0) {
        return 'Dzielenie ekranu: zaznacz klipy video bezpośrednio na timeline.';
      }
      clips = _ssSortClips(clips, byTracks);

      var seqSize = _ssGetSeqSize(seq);
      var usableW = seqSize.w - gx * (cols - 1);
      var usableH = seqSize.h - gy * (rows - 1);
      if (usableW <= 0 || usableH <= 0) { return 'Dzielenie ekranu: odstępy są za duże dla rozmiaru sekwencji.'; }
      var cellW = usableW / cols;
      var cellH = usableH / rows;
      var maxCells = cols * rows;
      var applyCount = Math.min(clips.length, maxCells);

      dbg.push('Sekwencja: ' + seqSize.w + 'x' + seqSize.h + ', siatka X=' + cols + ', Y=' + rows + ', pola=' + maxCells + ', zaznaczone=' + clips.length);
      dbg.push('Tryb: ' + (fillMode === 'fill' ? 'Wypełnij pola / crop' : 'Pokaż całe video / bez cropu'));

      var changed = 0;
      for (var i = 0; i < applyCount; i++) {
        var clip = clips[i];
        var col = i % cols;
        var row = Math.floor(i / cols);
        var centerX = (cellW / 2) + col * (cellW + gx);
        var centerY = (cellH / 2) + row * (cellH + gy);
        var size = _ssGetClipSize(clip, seqSize);
        var scaleFill = Math.max(cellW / size.w, cellH / size.h) * 100;
        var scaleFit = Math.min(cellW / size.w, cellH / size.h) * 100;
        var scale = fillMode === 'fill' ? scaleFill : scaleFit;
        var cropL = 0, cropR = 0, cropT = 0, cropB = 0;

        if (fillMode === 'fill') {
          var visibleWInSource = cellW / (scale / 100);
          var visibleHInSource = cellH / (scale / 100);
          var cropX = Math.max(0, (1 - (visibleWInSource / size.w)) * 100);
          var cropY = Math.max(0, (1 - (visibleHInSource / size.h)) * 100);
          cropL = cropR = cropX / 2;
          cropT = cropB = cropY / 2;
        }

        var motionOK = _ssSetMotion(clip, centerX, centerY, scale, seqSize);
        var fxPack = _ssPrepareSplitEffects(clip, dbg);
        var workClip = fxPack.clip || clip;
        // Po dodaniu efektów przez QE używamy odświeżonego TrackItemu i ustawiamy Motion jeszcze raz,
        // bo oryginalny obiekt często ma starą listę components.
        motionOK = _ssSetMotion(workClip, centerX, centerY, scale, seqSize) || motionOK;
        var transformOK = false;
        if (fxPack.transform) { transformOK = _ssSetTransformIdentity(fxPack.transform, seqSize, dbg); }
        var cropOK = false;
        if (fxPack.crop) {
          cropOK = _ssSetCrop(fxPack.crop, cropL, cropT, cropR, cropB);
        } else {
          // Awaryjnie: jeśli Premiere nie pozwoli dodać osobnego Crop/Kadrowanie, używamy cropa w Motion.
          var motionCrop = _ssFindComponent(workClip, ['motion', 'ruch', 'adbe motion']);
          cropOK = _ssSetCrop(motionCrop, cropL, cropT, cropR, cropB);
        }
        if (motionOK || cropOK || transformOK || fxPack.transform) { changed++; }
        dbg.push('[' + (i + 1) + '] ' + _ssName(clip) + ' => pole col=' + (col + 1) + ', row=' + (row + 1) + ', posPx=' + Math.round(centerX) + 'x' + Math.round(centerY) + ', posNorm=' + Math.round((centerX / seqSize.w) * 10000) / 10000 + 'x' + Math.round((centerY / seqSize.h) * 10000) / 10000 + ', scale=' + Math.round(scale * 100) / 100 + ', osobny Transform=' + (fxPack.transform ? 'TAK' : 'NIE') + ', osobny Crop=' + (fxPack.crop ? 'TAK' : 'NIE') + ', crop L/T/R/B=' + Math.round(cropL * 100) / 100 + '/' + Math.round(cropT * 100) / 100 + '/' + Math.round(cropR * 100) / 100 + '/' + Math.round(cropB * 100) / 100);
      }

      var msg = 'Dzielenie ekranu zakończone. Ustawiono: ' + changed + ' / ' + applyCount + ' klipów. Siatka: X=' + cols + ', Y=' + rows + '.';
      if (clips.length > maxCells) { msg += '\nUwaga: zaznaczono więcej klipów niż pól w siatce. Pominięto: ' + (clips.length - maxCells) + '.'; }
      msg += '\n' + dbg.join('\n');
      return msg;
    } catch (e) {
      return 'Dzielenie ekranu: błąd - ' + e;
    }
  };

}());
