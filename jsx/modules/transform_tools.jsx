(function () {
  function _ttName(o) {
    try { return String(o.name || ''); } catch (e) { return ''; }
  }

  function _ttNum(v, fallback) {
    var n = parseFloat(v);
    if (isNaN(n)) { return fallback; }
    return n;
  }

  function _ttTicks(obj) {
    try { return Number(obj.ticks); } catch (e0) {}
    try { return Math.round(Number(obj.seconds) * 254016000000); } catch (e1) {}
    try { return Number(obj); } catch (e2) {}
    return 0;
  }

  function _ttComponentName(c) {
    var a = '';
    try { a += String(c.displayName || '') + ' '; } catch (e0) {}
    try { a += String(c.matchName || '') + ' '; } catch (e1) {}
    try { a += String(c.name || '') + ' '; } catch (e2) {}
    return a.toLowerCase();
  }

  function _ttPropName(p) {
    var a = '';
    try { a += String(p.displayName || '') + ' '; } catch (e0) {}
    try { a += String(p.matchName || '') + ' '; } catch (e1) {}
    try { a += String(p.name || '') + ' '; } catch (e2) {}
    return a.toLowerCase();
  }

  function _ttIsMotionComponent(component) {
    var n = _ttComponentName(component);
    return n.indexOf('adbe motion') !== -1 || n.indexOf('motion') !== -1 || n.indexOf('ruch') !== -1;
  }

  function _ttIsSeparateTransformComponent(component) {
    var n = _ttComponentName(component);
    if (_ttIsMotionComponent(component)) { return false; }
    return n.indexOf('transform') !== -1 || n.indexOf('przeksz') !== -1 || n.indexOf('geometry') !== -1 || n.indexOf('geometr') !== -1;
  }

  function _ttFindComponentByPredicate(clip, predicate) {
    try {
      if (!clip || !clip.components) { return null; }
      for (var i = 0; i < clip.components.numItems; i++) {
        var c = clip.components[i];
        if (predicate(c)) { return c; }
      }
    } catch (e) {}
    return null;
  }

  function _ttFindComponent(clip, names) {
    try {
      if (!clip || !clip.components) { return null; }
      for (var i = 0; i < clip.components.numItems; i++) {
        var c = clip.components[i];
        var n = _ttComponentName(c);
        for (var j = 0; j < names.length; j++) {
          if (n.indexOf(String(names[j]).toLowerCase()) !== -1) { return c; }
        }
      }
    } catch (e) {}
    return null;
  }

  function _ttFindProp(component, names, fallbackIndex) {
    try {
      if (!component || !component.properties) { return null; }
      for (var i = 0; i < component.properties.numItems; i++) {
        var p = component.properties[i];
        var n = _ttPropName(p);
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

  function _ttSetProp(prop, value) {
    if (!prop) { return false; }
    try { prop.setValue(value, true); return true; } catch (e0) {}
    try { prop.setValue(value); return true; } catch (e1) {}
    return false;
  }

  function _ttGetPropValue(prop) {
    try { return prop.getValue(); } catch (e0) {}
    try { return prop.getValueAtTime(0); } catch (e1) {}
    return null;
  }

  function _ttEffectNameMatches(effect, names) {
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

  function _ttEffectReadableName(effect) {
    var out = [];
    try { if (effect.displayName) { out.push('displayName=' + effect.displayName); } } catch (e0) {}
    try { if (effect.name) { out.push('name=' + effect.name); } } catch (e1) {}
    try { if (effect.matchName) { out.push('matchName=' + effect.matchName); } } catch (e2) {}
    try { if (effect.localizedName) { out.push('localizedName=' + effect.localizedName); } } catch (e3) {}
    try { if (!out.length) { out.push(String(effect)); } } catch (e4) {}
    return out.join(', ');
  }

  function _ttCandidateEffectNames(effect) {
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

  function _ttQEProjectGetEffectByName(name, dbg) {
    if (!name) { return null; }
    try { if (app.enableQE) { app.enableQE(); } } catch (e0) {}
    try {
      if (typeof qe !== 'undefined' && qe.project && qe.project.getVideoEffectByName) {
        var fx = qe.project.getVideoEffectByName(String(name));
        if (fx) { return fx; }
      }
    } catch (e1) { if (dbg) { dbg.push('QE getVideoEffectByName ERR: ' + e1); } }
    return null;
  }

  function _ttScanEffectList(list, names, found) {
    if (!list) { return; }
    function addCandidate(effect, src) {
      try {
        if (_ttEffectNameMatches(effect, names)) {
          found.push({ effect: effect, src: src, readable: _ttEffectReadableName(effect), names: _ttCandidateEffectNames(effect) });
        }
      } catch (e0) {}
    }
    try {
      var len = list.length !== undefined ? list.length : list.numItems;
      if (len !== undefined && len !== null) {
        for (var i = 0; i < len; i++) { addCandidate(list[i], 'list'); }
        return;
      }
    } catch (e1) {}
    try {
      var txt = String(list || '');
      var lines = txt.split(/[\r\n]+/);
      for (var j = 0; j < lines.length; j++) {
        if (lines[j]) { addCandidate({ name: lines[j], displayName: lines[j], matchName: lines[j] }, 'textline'); }
      }
    } catch (e2) {}
  }

  function _ttResolveTransformEffect(dbg) {
    var directNames = ['Transform', 'Przekształć', 'Przeksztalc', 'Transformacja', 'Transformation', 'Transformieren', 'Transformar', 'AE.ADBE Geometry2', 'AE.ADBE Geometry', 'ADBE Geometry2', 'ADBE Geometry', 'Geometry2', 'Geometry'];
    var matchTerms = ['AE.ADBE Geometry2', 'AE.ADBE Geometry', 'ADBE Geometry2', 'ADBE Geometry', 'Geometry2', 'Geometry', 'Transform', 'Przekształ', 'Przeksztal', 'Transformacja'];
    var tried = [];
    function tryName(n) {
      if (!n) { return null; }
      for (var t = 0; t < tried.length; t++) { if (tried[t] === n) { return null; } }
      tried.push(n);
      try {
        if (app.project && app.project.getVideoEffectByName) {
          var fx = app.project.getVideoEffectByName(n);
          if (fx) { return { effect: fx, addName: n, source: 'app.project.getVideoEffectByName' }; }
        }
      } catch (e0) { if (dbg) { dbg.push('app.project.getVideoEffectByName ERR ' + n + ': ' + e0); } }
      var qfx = _ttQEProjectGetEffectByName(n, dbg);
      if (qfx) { return { effect: qfx, addName: n, source: 'qe.project.getVideoEffectByName' }; }
      return null;
    }
    for (var i = 0; i < directNames.length; i++) {
      var direct = tryName(directNames[i]);
      if (direct) { return direct; }
    }
    var found = [];
    try { if (app.project && app.project.getVideoEffectList) { _ttScanEffectList(app.project.getVideoEffectList(), matchTerms, found); } } catch (e1) {}
    try { if (app.enableQE) { app.enableQE(); } } catch (e2) {}
    try { if (typeof qe !== 'undefined' && qe.project && qe.project.getVideoEffectList) { _ttScanEffectList(qe.project.getVideoEffectList(), matchTerms, found); } } catch (e3) {}
    for (var c = 0; c < found.length; c++) {
      var ns = found[c].names || [];
      for (var k = 0; k < ns.length; k++) {
        var got = tryName(ns[k]);
        if (got) { return got; }
      }
    }
    if (dbg) { dbg.push('Nie znaleziono efektu Transform. Próbowano: ' + tried.join(' / ')); }
    return null;
  }

  function _ttGetQEActiveSequence() {
    try { if (app.enableQE) { app.enableQE(); } } catch (e0) {}
    try {
      if (typeof qe !== 'undefined' && qe.project && qe.project.getActiveSequence) { return qe.project.getActiveSequence(); }
    } catch (e1) {}
    return null;
  }

  function _ttFindQEClipForTrackItem(clip, dbg) {
    try {
      var qseq = _ttGetQEActiveSequence();
      if (!qseq || !qseq.getVideoTrackAt) { return null; }
      var trackIndex = 0;
      try { trackIndex = Number(clip.parentTrackIndex); } catch (e0) { trackIndex = 0; }
      var qtrack = qseq.getVideoTrackAt(trackIndex);
      if (!qtrack || !qtrack.numItems || !qtrack.getItemAt) { return null; }
      var targetName = String(_ttName(clip));
      var targetStart = _ttTicks(clip.start);
      var best = null;
      for (var i = 0; i < qtrack.numItems; i++) {
        var qc = qtrack.getItemAt(i);
        if (!qc) { continue; }
        var qName = '';
        try { qName = String(qc.name || ''); } catch (e1) {}
        var qStart = 0;
        try { qStart = _ttTicks(qc.start); } catch (e2) {}
        if (targetName && qName && targetName === qName && Math.abs(qStart - targetStart) <= 10) { return qc; }
        if (!best && Math.abs(qStart - targetStart) <= 10) { best = qc; }
      }
      return best;
    } catch (e) { if (dbg) { dbg.push('Szukam QE clip ERR: ' + e); } }
    return null;
  }

  function _ttAddResolvedVideoEffectToClip(clip, resolved, dbg) {
    if (!clip || !resolved || !resolved.effect) { return false; }
    try {
      if (clip.addVideoEffect) {
        clip.addVideoEffect(resolved.effect);
        if (dbg) { dbg.push('Dodano Transform przez TrackItem.addVideoEffect: ' + (resolved.addName || resolved.source)); }
        return true;
      }
    } catch (e0) { if (dbg) { dbg.push('TrackItem.addVideoEffect ERR: ' + e0); } }
    try {
      var qeClip = _ttFindQEClipForTrackItem(clip, dbg);
      if (qeClip && qeClip.addVideoEffect) {
        qeClip.addVideoEffect(resolved.effect);
        if (dbg) { dbg.push('Dodano Transform przez QE clip.addVideoEffect: ' + (resolved.addName || resolved.source)); }
        return true;
      }
    } catch (e1) { if (dbg) { dbg.push('QE clip.addVideoEffect ERR: ' + e1); } }
    try {
      var qeFx = _ttQEProjectGetEffectByName(resolved.addName, dbg);
      var qeClip2 = _ttFindQEClipForTrackItem(clip, dbg);
      if (qeFx && qeClip2 && qeClip2.addVideoEffect) {
        qeClip2.addVideoEffect(qeFx);
        if (dbg) { dbg.push('Dodano Transform przez QE fallback: ' + resolved.addName); }
        return true;
      }
    } catch (e2) { if (dbg) { dbg.push('QE fallback ERR: ' + e2); } }
    return false;
  }

  function _ttRefreshTrackItem(clip, dbg) {
    try {
      var seq = app.project.activeSequence;
      if (!seq || !seq.videoTracks) { return clip; }
      var trackIndex = 0;
      try { trackIndex = Number(clip.parentTrackIndex); } catch (e0) { trackIndex = 0; }
      var vt = seq.videoTracks[trackIndex];
      if (!vt || !vt.clips) { return clip; }
      var targetName = String(_ttName(clip));
      var targetStart = _ttTicks(clip.start);
      var targetEnd = _ttTicks(clip.end);
      var best = null;
      for (var i = 0; i < vt.clips.numItems; i++) {
        var c = vt.clips[i];
        if (!c) { continue; }
        if (String(_ttName(c)) !== targetName) { continue; }
        var cs = _ttTicks(c.start);
        var ce = _ttTicks(c.end);
        if (Math.abs(cs - targetStart) <= 10 || Math.abs(ce - targetEnd) <= 10) { best = c; break; }
        if (!best) { best = c; }
      }
      if (best) { return best; }
    } catch (e) { if (dbg) { dbg.push('Refresh TrackItem ERR: ' + e); } }
    return clip;
  }

  function _ttWaitForTransformAfterAdd(clip, dbg) {
    var current = clip;
    for (var attempt = 1; attempt <= 8; attempt++) {
      try { $.sleep(120); } catch (e0) {}
      current = _ttRefreshTrackItem(current, dbg);
      var c = _ttFindComponentByPredicate(current, _ttIsSeparateTransformComponent);
      if (c) { return { clip: current, component: c }; }
    }
    return { clip: current, component: null };
  }

  function _ttGetOrAddTransformComponent(clip, dbg) {
    var currentClip = _ttRefreshTrackItem(clip, dbg);
    var existing = _ttFindComponentByPredicate(currentClip, _ttIsSeparateTransformComponent);
    if (existing) { return { clip: currentClip, component: existing, added: false }; }
    var resolved = _ttResolveTransformEffect(dbg);
    var added = false;
    if (resolved) { added = _ttAddResolvedVideoEffectToClip(currentClip, resolved, dbg); }
    var waited = _ttWaitForTransformAfterAdd(currentClip, dbg);
    if (waited.component) { return { clip: waited.clip, component: waited.component, added: added }; }
    if (added && dbg) { dbg.push('Premiere zgłosiło dodanie Transform, ale komponent nie odświeżył się w tym przebiegu. Spróbuj kliknąć jeszcze raz, jeśli efekt pojawił się na klipie.'); }
    return { clip: waited.clip || currentClip, component: null, added: added };
  }

  function _ttSelectedVideoClips(seq) {
    var arr = [];
    try {
      var sel = seq.getSelection();
      if (!sel) { return arr; }
      var len = sel.length !== undefined ? sel.length : sel.numItems;
      for (var i = 0; i < len; i++) {
        var c = sel[i];
        if (!c) { continue; }
        try {
          if (c.mediaType && String(c.mediaType).toLowerCase() !== 'video') { continue; }
        } catch (e0) {}
        arr.push(c);
      }
    } catch (e) {}
    return arr;
  }

  function _ttSortClips(arr) {
    arr.sort(function (a, b) {
      var at = 0, bt = 0, as = 0, bs = 0;
      try { at = Number(a.parentTrackIndex); } catch (e0) {}
      try { bt = Number(b.parentTrackIndex); } catch (e1) {}
      try { as = _ttTicks(a.start); } catch (e2) {}
      try { bs = _ttTicks(b.start); } catch (e3) {}
      if (at !== bt) { return at - bt; }
      if (as !== bs) { return as - bs; }
      return String(_ttName(a)).localeCompare(String(_ttName(b)));
    });
    return arr;
  }

  function _ttGetKeys(prop) {
    try {
      if (prop && prop.getKeys) {
        var keys = prop.getKeys();
        if (!keys) { return []; }
        var arr = [];
        var len = keys.length !== undefined ? keys.length : keys.numItems;
        for (var i = 0; i < len; i++) { arr.push(keys[i]); }
        return arr;
      }
    } catch (e) {}
    return [];
  }

  function _ttClearKeys(prop) {
    if (!prop || !prop.removeKey) { return; }
    try {
      var keys = _ttGetKeys(prop);
      for (var i = keys.length - 1; i >= 0; i--) {
        try { prop.removeKey(keys[i]); } catch (e0) {}
      }
    } catch (e) {}
  }

  function _ttSetTimeVarying(prop, enabled) {
    if (!prop || !prop.setTimeVarying) { return; }
    try { prop.setTimeVarying(enabled === true); } catch (e) {}
  }

  function _ttGetValueAtKeyOrTime(prop, key) {
    try { if (prop.getValueAtKey) { return prop.getValueAtKey(key); } } catch (e0) {}
    try { if (prop.getValueAtTime) { return prop.getValueAtTime(key); } } catch (e1) {}
    try { return prop.getValue(); } catch (e2) {}
    return null;
  }

  function _ttSetValueAtKeyOrTime(prop, key, value) {
    if (!prop) { return false; }
    try { if (prop.addKey) { prop.addKey(key); } } catch (e0) {}
    try { if (prop.setValueAtKey) { prop.setValueAtKey(key, value, true); return true; } } catch (e1) {}
    try { if (prop.setValueAtKey) { prop.setValueAtKey(key, value); return true; } } catch (e2) {}
    try { if (prop.setValueAtTime) { prop.setValueAtTime(key, value, true); return true; } } catch (e3) {}
    try { if (prop.setValueAtTime) { prop.setValueAtTime(key, value); return true; } } catch (e4) {}
    return _ttSetProp(prop, value);
  }

  function _ttCopyInterpolation(src, dst, key) {
    try {
      if (src.getInterpolationTypeAtKey && dst.setInterpolationTypeAtKey) {
        var it = src.getInterpolationTypeAtKey(key);
        dst.setInterpolationTypeAtKey(key, it);
      }
    } catch (e) {}
    try {
      if (src.getTemporalEaseAtKey && dst.setTemporalEaseAtKey) {
        var ez = src.getTemporalEaseAtKey(key);
        dst.setTemporalEaseAtKey(key, ez);
      }
    } catch (e2) {}
  }

  function _ttCopyProp(srcProp, targetProps, label, dbg) {
    if (!srcProp || !targetProps || !targetProps.length) { return 0; }
    var copied = 0;
    var keys = _ttGetKeys(srcProp);
    for (var t = 0; t < targetProps.length; t++) {
      var dst = targetProps[t];
      if (!dst) { continue; }
      _ttClearKeys(dst);
      if (keys.length) {
        _ttSetTimeVarying(dst, true);
        for (var i = 0; i < keys.length; i++) {
          var val = _ttGetValueAtKeyOrTime(srcProp, keys[i]);
          if (_ttSetValueAtKeyOrTime(dst, keys[i], val)) {
            _ttCopyInterpolation(srcProp, dst, keys[i]);
            copied++;
          }
        }
      } else {
        _ttSetTimeVarying(dst, false);
        var staticVal = _ttGetPropValue(srcProp);
        if (_ttSetProp(dst, staticVal)) { copied++; }
      }
    }
    if (dbg) { dbg.push(label + ': ' + (keys.length ? (keys.length + ' keyframe/target') : 'wartość statyczna') + ', zapisów=' + copied); }
    return copied;
  }

  function _ttStaticDefault(prop, value) {
    if (!prop) { return false; }
    try { _ttClearKeys(prop); } catch (e0) {}
    try { _ttSetTimeVarying(prop, false); } catch (e1) {}
    return _ttSetProp(prop, value);
  }

  function _ttResetMotionAfterTransfer(motion, dbg) {
    if (!motion) { return; }
    var resetLog = [];
    var motionPosition = _ttFindProp(motion, ['position', 'położenie', 'polozenie'], 0);
    var motionScale = _ttFindProp(motion, ['scale', 'skala'], 1);
    var motionRotation = _ttFindProp(motion, ['rotation', 'obrót', 'obrot'], 2);
    var motionAnchor = _ttFindProp(motion, ['anchor point', 'punkt kontrolny', 'punkt zakotwiczenia', 'kotwica'], 3);

    // Motion/Position w Premiere przez ExtendScript przyjmuje wartości znormalizowane.
    // Ustawianie środka sekwencji w pikselach, np. [1920,1080], potrafi wywalić
    // pozycję do 32767,0 / 32767,0 i dać czarny obraz. Dlatego reset Motion
    // robi dokładnie tak jak przycisk resetu w Effect Controls: Position=[0.5,0.5].
    var defaultPosition = [0.5, 0.5];
    try {
      var oldPos = _ttGetPropValue(motionPosition);
      if (oldPos && oldPos.length !== undefined && oldPos.length > 2) { defaultPosition = [0.5, 0.5, 0]; }
    } catch (e0) {}

    // Anchor Point w Motion przez API Premiere potrafi zachowywać się tak samo jak Position:
    // wpisanie środka w pikselach może zostać przeskalowane do 32767. Dlatego resetujemy
    // go neutralnie przez wartości znormalizowane, bez używania rozmiaru sekwencji.
    var defaultAnchor = [0.5, 0.5];
    try {
      var oldAnchor = _ttGetPropValue(motionAnchor);
      if (oldAnchor && oldAnchor.length !== undefined && oldAnchor.length > 2) { defaultAnchor = [0.5, 0.5, 0]; }
    } catch (e1) {}

    if (_ttStaticDefault(motionPosition, defaultPosition)) { resetLog.push('Position=' + defaultPosition.join(',')); }
    if (_ttStaticDefault(motionScale, 100)) { resetLog.push('Scale=100'); }
    if (_ttStaticDefault(motionRotation, 0)) { resetLog.push('Rotation=0'); }
    if (_ttStaticDefault(motionAnchor, defaultAnchor)) { resetLog.push('Anchor Point=' + defaultAnchor.join(',')); }

    if (dbg) {
      dbg.push('Motion po przeniesieniu zresetowany do czystych ustawień, żeby efekt Transform nie dublował skali/pozycji' + (resetLog.length ? ': ' + resetLog.join(' | ') : ''));
    }
  }

  function _ttListProps(component) {
    var arr = [];
    try {
      if (!component || !component.properties) { return arr; }
      for (var i = 0; i < component.properties.numItems; i++) {
        var p = component.properties[i];
        var label = '#' + i + ' ';
        try { label += String(p.displayName || ''); } catch (e0) {}
        try { label += ' / ' + String(p.name || ''); } catch (e1) {}
        try { label += ' / ' + String(p.matchName || ''); } catch (e2) {}
        arr.push(label);
      }
    } catch (e) {}
    return arr;
  }

  function _ttSetNumericProp(prop, value) {
    if (!prop) { return false; }
    try { if (prop.setTimeVarying) { prop.setTimeVarying(false); } } catch (e0) {}
    try { prop.setValue(value, true); return true; } catch (e1) {}
    try { prop.setValue(value); return true; } catch (e2) {}
    try { prop.setValue([value], true); return true; } catch (e3) {}
    try { prop.setValue([value]); return true; } catch (e4) {}
    return false;
  }

  function _ttSetBoolProp(prop, value) {
    if (!prop) { return false; }
    var v = value ? 1 : 0;
    try { prop.setValue(v, true); return true; } catch (e0) {}
    try { prop.setValue(v); return true; } catch (e1) {}
    try { prop.setValue(value === true, true); return true; } catch (e2) {}
    try { prop.setValue(value === true); return true; } catch (e3) {}
    return false;
  }

  function _ttFindShutterAngleProp(transform) {
    var best = null;
    try {
      if (!transform || !transform.properties) { return null; }
      for (var i = 0; i < transform.properties.numItems; i++) {
        var p = transform.properties[i];
        var n = _ttPropName(p);
        var hasShutter = n.indexOf('shutter') !== -1 || n.indexOf('migawk') !== -1;
        var hasAngle = n.indexOf('angle') !== -1 || n.indexOf('kąt') !== -1 || n.indexOf('kat') !== -1;
        var isUseComp = n.indexOf('use') !== -1 || n.indexOf('composition') !== -1 || n.indexOf('kompozyc') !== -1 || n.indexOf('użyj') !== -1 || n.indexOf('uzyj') !== -1;
        if (hasShutter && hasAngle && !isUseComp) { return p; }
        if (!best && hasShutter && !isUseComp) { best = p; }
      }
      if (best) { return best; }
      // Standardowy efekt Transform w Premiere zwykle ma:
      // #9 Use Composition's Shutter Angle, #10 Shutter Angle.
      // Poprzednia wersja trafiała w #9, czyli checkbox, dlatego ustawienie nie działało.
      var fallback = [10, 11, 9];
      for (var f = 0; f < fallback.length; f++) {
        var idx = fallback[f];
        if (transform.properties.numItems > idx) { return transform.properties[idx]; }
      }
    } catch (e) {}
    return null;
  }

  function _ttFindUseCompositionShutterProp(transform) {
    try {
      if (!transform || !transform.properties) { return null; }
      for (var i = 0; i < transform.properties.numItems; i++) {
        var p = transform.properties[i];
        var n = _ttPropName(p);
        var hasShutter = n.indexOf('shutter') !== -1 || n.indexOf('migawk') !== -1;
        var isUseComp = n.indexOf('use') !== -1 || n.indexOf('composition') !== -1 || n.indexOf('kompozyc') !== -1 || n.indexOf('użyj') !== -1 || n.indexOf('uzyj') !== -1;
        if (hasShutter && isUseComp) { return p; }
      }
      if (transform.properties.numItems > 9) { return transform.properties[9]; }
    } catch (e) {}
    return null;
  }

  function _ttSetShutterAngle(transform, value, dbg) {
    var angle = Math.max(0, Math.min(360, Math.round(_ttNum(value, 360))));
    var useComp = _ttFindUseCompositionShutterProp(transform);
    var useCompOk = true;
    if (useComp) { useCompOk = _ttSetBoolProp(useComp, false); }

    var shutter = _ttFindShutterAngleProp(transform);
    var ok = false;
    if (shutter) { ok = _ttSetNumericProp(shutter, angle); }

    if (dbg) {
      var extra = '';
      if (!ok) {
        var props = _ttListProps(transform);
        if (props.length) { extra = ' | props: ' + props.join(' ; '); }
      }
      dbg.push('Shutter Angle=' + angle + (ok ? ' OK' : ' NIE UDAŁO SIĘ USTAWIĆ') + (useComp ? (' | Use Composition Shutter=' + (useCompOk ? 'OFF' : 'OFF FAILED')) : '') + extra);
    }
    return ok;
  }

  function _ttTransferClip(clip, shutterAngle, dbg) {
    var refreshed = _ttRefreshTrackItem(clip, dbg);
    var motion = _ttFindComponent(refreshed, ['adbe motion', 'motion', 'ruch']);
    if (!motion) { return { ok: false, message: 'brak Motion' }; }
    var trPack = _ttGetOrAddTransformComponent(refreshed, dbg);
    refreshed = trPack.clip || refreshed;
    var transform = trPack.component;
    if (!transform) { return { ok: false, message: 'nie udało się znaleźć/dodać Transform' }; }

    _ttSetShutterAngle(transform, shutterAngle, dbg);

    var writes = 0;
    var motionPosition = _ttFindProp(motion, ['position', 'położenie', 'polozenie'], 0);
    var motionScale = _ttFindProp(motion, ['scale', 'skala'], 1);
    var motionRotation = _ttFindProp(motion, ['rotation', 'obrót', 'obrot'], 2);
    var motionAnchor = _ttFindProp(motion, ['anchor point', 'punkt kontrolny', 'punkt zakotwiczenia', 'kotwica'], 3);

    var trAnchor = _ttFindProp(transform, ['anchor point', 'punkt kontrolny', 'punkt zakotwiczenia', 'kotwica'], 0);
    var trPosition = _ttFindProp(transform, ['position', 'położenie', 'polozenie'], 1);
    var trScaleH = _ttFindProp(transform, ['scale height', 'wysokość skali', 'wysokosc skali', 'skala wysoko'], null);
    var trScaleW = _ttFindProp(transform, ['scale width', 'szerokość skali', 'szerokosc skali', 'skala szeroko'], null);
    var trScale = _ttFindProp(transform, ['scale', 'skala'], 2);
    var trRotation = _ttFindProp(transform, ['rotation', 'obrót', 'obrot'], 7);

    writes += _ttCopyProp(motionAnchor, [trAnchor], 'Anchor Point', dbg);
    writes += _ttCopyProp(motionPosition, [trPosition], 'Position', dbg);
    if (trScaleH || trScaleW) {
      var targets = [];
      if (trScaleH) { targets.push(trScaleH); }
      if (trScaleW && trScaleW !== trScaleH) { targets.push(trScaleW); }
      writes += _ttCopyProp(motionScale, targets, 'Scale -> Scale Height/Width', dbg);
      var uniform = _ttFindProp(transform, ['uniform scale', 'jednolita skala', 'uniform'], null);
      if (uniform) { _ttSetProp(uniform, true); }
    } else {
      writes += _ttCopyProp(motionScale, [trScale], 'Scale', dbg);
    }
    writes += _ttCopyProp(motionRotation, [trRotation], 'Rotation', dbg);

    if (writes > 0) {
      _ttResetMotionAfterTransfer(motion, dbg);
    }

    return { ok: writes > 0, message: 'zapisów=' + writes };
  }

  // CopyText/PasteText legacy mechanics were removed from transform_tools.jsx in v1.12.230.
  // Transform module now owns only Motion -> Transform transfer and Shutter Angle logic.

  AEDRNO.transferMotionToTransform = function (shutterAngle) {
    var dbg = [];
    try {
      var seq = app.project.activeSequence;
      if (!seq) { return 'Transform: brak aktywnej sekwencji.'; }
      var clips = _ttSelectedVideoClips(seq);
      if (!clips || clips.length === 0) { return 'Transform: zaznacz klipy video bezpośrednio na timeline.'; }
      clips = _ttSortClips(clips);
      var angle = Math.max(0, Math.min(360, Math.round(_ttNum(shutterAngle, 360))));
      var okCount = 0;
      var fail = [];
      for (var i = 0; i < clips.length; i++) {
        var name = _ttName(clips[i]) || ('Klip ' + (i + 1));
        dbg.push('--- ' + name + ' ---');
        var r = _ttTransferClip(clips[i], angle, dbg);
        if (r.ok) { okCount++; }
        else { fail.push(name + ': ' + r.message); }
      }
      var msg = 'Transform: przeniesiono Motion -> Transform dla ' + okCount + '/' + clips.length + ' klipów. Shutter Angle=' + angle + '.';
      if (fail.length) { msg += ' Problemy: ' + fail.join(' | '); }
      if (dbg.length) { msg += '\n' + dbg.join('\n'); }
      return msg;
    } catch (e) {
      var err = '';
      try { err = (e && e.message) ? e.message : String(e); } catch (ignore) { err = 'nieznany błąd'; }
      try { if (e && e.line) { err += ' | line: ' + e.line; } } catch (ignore2) {}
      return 'Transform: błąd: ' + err + (dbg.length ? ('\n' + dbg.join('\n')) : '');
    }
  };
}());
