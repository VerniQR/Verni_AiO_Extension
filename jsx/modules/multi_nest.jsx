/* Verni AiO Extension - MULTI-NEST silent rewrite
 * v1.12.240: Copy/Paste Text combined module and real Type Tool transform transfer.
 */
var AEDRNO = AEDRNO || {};

(function () {
  var MN_VERSION = '1.12.240';

  function _log(dbg, msg) {
    try { dbg.push(String(msg)); } catch (e) {}
  }

  function _err(e) {
    try {
      var out = '';
      try { if (e && e.name) { out += e.name + ': '; } } catch (_e1) {}
      try { out += (e && e.message) ? e.message : String(e); } catch (_e2) { out += 'Unknown error'; }
      try { if (e && e.line) { out += ' | line: ' + e.line; } } catch (_e3) {}
      return out;
    } catch (_e4) { return 'Unknown error'; }
  }

  function _ticks(v) {
    try {
      if (v === undefined || v === null) { return 0; }
      if (v.ticks !== undefined && v.ticks !== null) { return Number(v.ticks) || 0; }
      return Number(v) || 0;
    } catch (e) { return 0; }
  }

  function _makeTime(ticks) {
    var t = new Time();
    try { t.ticks = String(Math.round(Number(ticks) || 0)); } catch (e) { t.ticks = '0'; }
    return t;
  }

  function _clipName(clip) {
    try { if (clip && clip.name) { return String(clip.name); } } catch (e0) {}
    try { if (clip && clip.projectItem && clip.projectItem.name) { return String(clip.projectItem.name); } } catch (e1) {}
    return '';
  }

  function _nodeId(clip) {
    try { if (clip && clip.nodeId !== undefined && clip.nodeId !== null) { return String(clip.nodeId); } } catch (e0) {}
    try { if (clip && clip.projectItem && clip.projectItem.nodeId !== undefined && clip.projectItem.nodeId !== null) { return String(clip.projectItem.nodeId); } } catch (e1) {}
    try { if (clip && clip.projectItem && clip.projectItem.treePath) { return String(clip.projectItem.treePath); } } catch (e2) {}
    return '';
  }

  function _duration(clip) {
    var st = 0;
    var en = 0;
    try { st = _ticks(clip.start); } catch (e0) {}
    try { en = _ticks(clip.end); } catch (e1) {}
    if (en > st) { return en - st; }
    try { return Math.max(1, _ticks(clip.duration)); } catch (e2) {}
    return 1;
  }

  function _trackItemCount(track) {
    try { return track && track.clips ? track.clips.numItems : 0; } catch (e) {}
    return 0;
  }

  function _clipAt(track, index) {
    try { return track.clips[index]; } catch (e) {}
    return null;
  }

  function _clipFp(clip) {
    var st = 0;
    var en = 0;
    try { st = _ticks(clip.start); } catch (e0) {}
    try { en = _ticks(clip.end); } catch (e1) {}
    if (!en || en <= st) { en = st + _duration(clip); }
    return {
      name: _clipName(clip),
      nodeId: _nodeId(clip),
      start: st,
      end: en,
      duration: Math.max(1, en - st)
    };
  }

  function _makeItem(type, trackIndex, clip, order) {
    var fp = _clipFp(clip);
    return {
      type: type,
      trackIndex: trackIndex,
      clip: clip,
      order: order || 0,
      name: fp.name,
      nodeId: fp.nodeId,
      start: fp.start,
      end: fp.end,
      duration: fp.duration
    };
  }

  function _indexTimeline(seq) {
    var out = [];
    var t, i, count, clip;
    try {
      if (seq && seq.videoTracks) {
        for (t = 0; t < seq.videoTracks.numTracks; t++) {
          count = _trackItemCount(seq.videoTracks[t]);
          for (i = 0; i < count; i++) {
            clip = _clipAt(seq.videoTracks[t], i);
            if (clip) { out.push(_makeItem('V', t, clip, out.length)); }
          }
        }
      }
      if (seq && seq.audioTracks) {
        for (t = 0; t < seq.audioTracks.numTracks; t++) {
          count = _trackItemCount(seq.audioTracks[t]);
          for (i = 0; i < count; i++) {
            clip = _clipAt(seq.audioTracks[t], i);
            if (clip) { out.push(_makeItem('A', t, clip, out.length)); }
          }
        }
      }
    } catch (e) {}
    return out;
  }

  function _scoreItemToClip(item, clip) {
    var fp = _clipFp(clip);
    var score = 0;
    var tol = 100000;
    try { if (item.nodeId && fp.nodeId && String(item.nodeId) === String(fp.nodeId)) { score += 20; } } catch (e0) {}
    try { if (Math.abs(Number(item.start) - Number(fp.start)) < tol) { score += 8; } } catch (e1) {}
    try { if (Math.abs(Number(item.end) - Number(fp.end)) < tol) { score += 8; } } catch (e2) {}
    try { if (Math.abs(Number(item.duration) - Number(fp.duration)) < tol) { score += 4; } } catch (e3) {}
    try { if (item.name && fp.name && String(item.name) === String(fp.name)) { score += 5; } } catch (e4) {}
    return score;
  }

  function _findItemLocation(seq, clip, timelineIndex) {
    var best = null;
    var bestScore = -1;
    var fp = _clipFp(clip);
    var i, item, score, tol;
    tol = 100000;
    try {
      for (i = 0; i < timelineIndex.length; i++) {
        item = timelineIndex[i];
        if (!item || !item.clip) { continue; }
        try { if (item.clip === clip) { return { type: item.type, trackIndex: item.trackIndex, clip: item.clip, score: 999 }; } } catch (eSame) {}
        score = 0;
        try { if (fp.nodeId && item.nodeId && String(fp.nodeId) === String(item.nodeId)) { score += 20; } } catch (e0) {}
        try { if (Math.abs(Number(fp.start) - Number(item.start)) < tol) { score += 8; } } catch (e1) {}
        try { if (Math.abs(Number(fp.end) - Number(item.end)) < tol) { score += 8; } } catch (e2) {}
        try { if (fp.name && item.name && String(fp.name) === String(item.name)) { score += 5; } } catch (e3) {}
        if (score > bestScore) { bestScore = score; best = item; }
      }
    } catch (e) {}
    if (best && bestScore >= 13) { return { type: best.type, trackIndex: best.trackIndex, clip: best.clip, score: bestScore }; }
    return null;
  }

  function _isSelected(clip) {
    try { if (clip && clip.isSelected && clip.isSelected()) { return true; } } catch (e0) {}
    try { if (clip && clip.getSelected && clip.getSelected()) { return true; } } catch (e1) {}
    try { if (clip && (clip.selected === true || clip.selected === 1)) { return true; } } catch (e2) {}
    return false;
  }

  function _selectedKey(item) {
    return String(item.type) + ':' + String(item.trackIndex) + ':' + String(Math.round(Number(item.start) || 0)) + ':' + String(Math.round(Number(item.end) || 0)) + ':' + String(item.name || '') + ':' + String(item.nodeId || '');
  }

  function _collectSelected(seq, dbg) {
    var selected = [];
    var seen = {};
    var index = _indexTimeline(seq);
    var started = new Date().getTime();
    var i, len, sel, clip, loc, item, key;
    _log(dbg, 'MULTI-NEST native: indeks timeline=' + index.length + ' TrackItemow.');
    try {
      sel = seq.getSelection ? seq.getSelection() : null;
      len = 0;
      try { len = sel ? ((sel.length !== undefined && sel.length !== null) ? Number(sel.length) : Number(sel.numItems || 0)) : 0; } catch (eLen) { len = 0; }
      _log(dbg, 'MULTI-NEST native: seq.getSelection() zwrocilo=' + len + '.');
      if (sel && len > 0) {
        for (i = 0; i < len; i++) {
          clip = null;
          try { clip = sel[i]; } catch (eIndex) { clip = null; }
          if (!clip && sel.getItemAt) { try { clip = sel.getItemAt(i); } catch (eGet) {} }
          loc = _findItemLocation(seq, clip, index);
          if (!loc) { continue; }
          item = _makeItem(loc.type, loc.trackIndex, loc.clip, i);
          key = _selectedKey(item);
          if (!seen[key]) {
            seen[key] = true;
            selected.push(item);
          }
        }
      }
      _log(dbg, 'MULTI-NEST native: dopasowano z getSelection=' + selected.length + '.');
    } catch (e) {
      _log(dbg, 'MULTI-NEST native: blad getSelection: ' + _err(e));
    }

    if (!selected.length) {
      try {
        for (i = 0; i < index.length; i++) {
          item = index[i];
          if (!item || !item.clip || !_isSelected(item.clip)) { continue; }
          key = _selectedKey(item);
          if (!seen[key]) {
            seen[key] = true;
            selected.push(item);
          }
        }
        _log(dbg, 'MULTI-NEST native: fallback selected scan=' + selected.length + '.');
      } catch (e2) {
        _log(dbg, 'MULTI-NEST native: blad fallback selected scan: ' + _err(e2));
      }
    }

    selected.sort(function (a, b) {
      var ds = Number(a.start) - Number(b.start);
      if (ds !== 0) { return ds; }
      if (String(a.type) !== String(b.type)) { return String(a.type) === 'V' ? -1 : 1; }
      var dt = Number(a.trackIndex) - Number(b.trackIndex);
      if (dt !== 0) { return dt; }
      return Number(a.order) - Number(b.order);
    });
    _log(dbg, 'MULTI-NEST native: gotowe selected=' + selected.length + ' | ' + (new Date().getTime() - started) + ' ms.');
    return selected;
  }

  function _clearSelection(seq) {
    var cleared = 0;
    var t, i, count, clip;
    try {
      if (seq && seq.videoTracks) {
        for (t = 0; t < seq.videoTracks.numTracks; t++) {
          count = _trackItemCount(seq.videoTracks[t]);
          for (i = 0; i < count; i++) {
            clip = _clipAt(seq.videoTracks[t], i);
            try { if (clip && clip.setSelected) { clip.setSelected(0, 1); cleared++; } } catch (eV) {}
          }
        }
      }
      if (seq && seq.audioTracks) {
        for (t = 0; t < seq.audioTracks.numTracks; t++) {
          count = _trackItemCount(seq.audioTracks[t]);
          for (i = 0; i < count; i++) {
            clip = _clipAt(seq.audioTracks[t], i);
            try { if (clip && clip.setSelected) { clip.setSelected(0, 1); cleared++; } } catch (eA) {}
          }
        }
      }
    } catch (e) {}
    return cleared;
  }

  function _selectOne(clip) {
    try {
      if (clip && clip.setSelected) {
        clip.setSelected(1, 1);
        return true;
      }
    } catch (e0) {}
    try {
      if (clip) {
        clip.selected = true;
        return true;
      }
    } catch (e1) {}
    return false;
  }

  function _findCurrentTarget(seq, target) {
    var tracks = null;
    var track = null;
    var count = 0;
    var i, clip, score;
    var bestClip = null;
    var bestScore = -1;
    try {
      tracks = target.type === 'V' ? seq.videoTracks : seq.audioTracks;
      if (!tracks || target.trackIndex < 0 || target.trackIndex >= tracks.numTracks) { return null; }
      track = tracks[target.trackIndex];
      count = _trackItemCount(track);
      for (i = 0; i < count; i++) {
        clip = _clipAt(track, i);
        if (!clip) { continue; }
        score = _scoreItemToClip(target, clip);
        if (score > bestScore) {
          bestScore = score;
          bestClip = clip;
        }
      }
    } catch (e) {}
    if (bestClip && bestScore >= 17) { return bestClip; }
    return null;
  }

  function _seqKey(seq, fallbackIndex) {
    var id = '';
    var name = '';
    try { id = String(seq.sequenceID || ''); } catch (e0) { id = ''; }
    try { name = String(seq.name || ''); } catch (e1) { name = ''; }
    if (id) { return 'id:' + id; }
    return 'idx:' + String(fallbackIndex) + ':' + name;
  }

  function _snapshotSequences() {
    var snap = { count: 0, map: {} };
    try {
      var seqs = app.project.sequences;
      var n = seqs ? seqs.numSequences : 0;
      snap.count = n;
      for (var i = 0; i < n; i++) {
        snap.map[_seqKey(seqs[i], i)] = true;
      }
    } catch (e) {}
    return snap;
  }

  function _findNewSequence(before) {
    var seqs, n, i, s, key;
    try {
      seqs = app.project.sequences;
      n = seqs ? seqs.numSequences : 0;
      for (i = 0; i < n; i++) {
        s = seqs[i];
        key = _seqKey(s, i);
        if (!before || !before.map || !before.map[key]) { return s; }
      }
      if (before && n > before.count) { return seqs[n - 1]; }
    } catch (e) {}
    return null;
  }

  function _nextNestNumber() {
    var maxNum = 0;
    var re = /^Mutli-NEST\s+(\d+)$/i;
    try {
      var seqs = app.project.sequences;
      var n = seqs ? seqs.numSequences : 0;
      for (var i = 0; i < n; i++) {
        var nm = '';
        var m = null;
        try { nm = String(seqs[i].name || ''); } catch (e0) { nm = ''; }
        m = re.exec(nm);
        if (m && Number(m[1]) > maxNum) { maxNum = Number(m[1]); }
      }
    } catch (e) {}
    return maxNum + 1;
  }

  function _renameSequence(seq, name) {
    var ok = false;
    try { if (seq) { seq.name = name; ok = true; } } catch (e0) {}
    try { if (seq && seq.projectItem) { seq.projectItem.name = name; ok = true; } } catch (e1) {}
    return ok;
  }

  function _setOneTrackTarget(track, enabled) {
    if (!track) { return false; }
    var methods = ['setTargeted', 'setTargeting', 'setTarget', 'setTargetedForInsert'];
    for (var m = 0; m < methods.length; m++) {
      try { if (track[methods[m]]) { track[methods[m]](enabled ? 1 : 0); return true; } } catch (e0) {}
      try { if (track[methods[m]]) { track[methods[m]](!!enabled); return true; } } catch (e1) {}
    }
    return false;
  }

  function _targetOnly(seq, type, trackIndex, dbg) {
    var t;
    var on = 0;
    var off = 0;
    try {
      if (seq && seq.videoTracks) {
        for (t = 0; t < seq.videoTracks.numTracks; t++) {
          if (_setOneTrackTarget(seq.videoTracks[t], type === 'V' && Number(trackIndex) === t)) {
            if (type === 'V' && Number(trackIndex) === t) { on++; } else { off++; }
          }
        }
      }
      if (seq && seq.audioTracks) {
        for (t = 0; t < seq.audioTracks.numTracks; t++) {
          if (_setOneTrackTarget(seq.audioTracks[t], type === 'A' && Number(trackIndex) === t)) {
            if (type === 'A' && Number(trackIndex) === t) { on++; } else { off++; }
          }
        }
      }
    } catch (e) { _log(dbg, 'MULTI-NEST silent: blad targetowania trackow: ' + _err(e)); }
    _log(dbg, 'MULTI-NEST silent: targetuje tylko ' + type + (Number(trackIndex) + 1) + ' | on=' + on + ', off=' + off + '.');
  }

  function _setInOut(seq, inTicks, outTicks, dbg) {
    var okIn = false;
    var okOut = false;
    try {
      var tin = _makeTime(inTicks);
      var tout = _makeTime(outTicks);
      try { if (seq.setInPoint) { seq.setInPoint(tin); okIn = true; } } catch (e0) {}
      try { if (!okIn && seq.setInPoint) { seq.setInPoint(String(Math.round(Number(inTicks) || 0))); okIn = true; } } catch (e1) {}
      try { if (!okIn) { seq.inPoint = tin; okIn = true; } } catch (e2) {}
      try { if (seq.setOutPoint) { seq.setOutPoint(tout); okOut = true; } } catch (e3) {}
      try { if (!okOut && seq.setOutPoint) { seq.setOutPoint(String(Math.round(Number(outTicks) || 0))); okOut = true; } } catch (e4) {}
      try { if (!okOut) { seq.outPoint = tout; okOut = true; } } catch (e5) {}
    } catch (e) { _log(dbg, 'MULTI-NEST silent: blad ustawiania In/Out: ' + _err(e)); }
    _log(dbg, 'MULTI-NEST silent: In/Out ' + inTicks + '-' + outTicks + ' | in=' + okIn + ', out=' + okOut + '.');
    return okIn && okOut;
  }

  function _clearInOut(seq) {
    try { if (seq && seq.setInPoint) { seq.setInPoint('0'); } } catch (e0) {}
    try { if (seq && seq.setOutPoint) { seq.setOutPoint('0'); } } catch (e1) {}
    try { if (seq) { seq.inPoint = _makeTime(0); } } catch (e2) {}
    try { if (seq) { seq.outPoint = _makeTime(0); } } catch (e3) {}
  }

  function _createSubsequence(seq, name, dbg) {
    var created = null;
    try {
      if (!seq || !seq.createSubsequence) {
        _log(dbg, 'MULTI-NEST silent: ta wersja Premiere nie udostepnia sequence.createSubsequence().');
        return null;
      }
      try { created = seq.createSubsequence(false); } catch (e0) { _log(dbg, 'MULTI-NEST silent: createSubsequence(false) blad: ' + _err(e0)); }
      if (!created) { try { created = seq.createSubsequence(0); } catch (e1) { _log(dbg, 'MULTI-NEST silent: createSubsequence(0) blad: ' + _err(e1)); } }
      if (!created) { try { created = seq.createSubsequence(); } catch (e2) { _log(dbg, 'MULTI-NEST silent: createSubsequence() blad: ' + _err(e2)); } }
      if (created) { _renameSequence(created, name); }
    } catch (e) { _log(dbg, 'MULTI-NEST silent: blad tworzenia subsequence: ' + _err(e)); }
    return created;
  }

  function _projectItemFromCreated(created) {
    try { if (created && created.projectItem) { return created.projectItem; } } catch (e0) {}
    try { if (created && created.type !== undefined) { return created; } } catch (e1) {}
    return null;
  }

  function _sequenceId(seq) {
    try { if (seq && seq.sequenceID !== undefined && seq.sequenceID !== null) { return String(seq.sequenceID); } } catch (e0) {}
    try { if (seq && seq.id !== undefined && seq.id !== null) { return String(seq.id); } } catch (e1) {}
    return '';
  }

  function _sequenceName(seq) {
    try { return String(seq && seq.name || ''); } catch (e0) {}
    return '';
  }

  function _projectItemName(projectItem) {
    try { return String(projectItem && projectItem.name || ''); } catch (e0) {}
    return '';
  }

  function _makeUndoSnapshotItem(parentSeq, nestedSeq, nestProjectItem, target, nestName) {
    var item = {
      nestName: String(nestName || ''),
      nestClipName: String(nestName || ''),
      nestProjectItemName: _projectItemName(nestProjectItem) || String(nestName || ''),
      parentSequenceName: _sequenceName(parentSeq),
      parentSequenceId: _sequenceId(parentSeq),
      nestedSequenceName: _sequenceName(nestedSeq) || String(nestName || ''),
      nestedSequenceId: _sequenceId(nestedSeq),
      type: String(target && target.type || 'V'),
      trackIndex: Math.max(0, Number(target && target.trackIndex) || 0),
      start: Number(target && target.start) || 0,
      end: Number(target && target.end) || 0,
      duration: Math.max(1, Number(target && target.duration) || ((Number(target && target.end) || 0) - (Number(target && target.start) || 0)) || 1),
      originalName: String(target && target.name || ''),
      originalNodeId: String(target && target.nodeId || '')
    };
    item.baseV = item.type === 'A' ? 0 : item.trackIndex;
    item.baseA = item.type === 'A' ? item.trackIndex : 0;
    item.primaryTrackType = item.type === 'A' ? 'A' : 'V';
    return item;
  }

  function _setProjectItemMediaRange(projectItem, inTicks, outTicks, mediaType) {
    var okIn = false;
    var okOut = false;
    var sin = String(Math.round(Number(inTicks) || 0));
    var sout = String(Math.round(Number(outTicks) || 0));
    try { if (projectItem && projectItem.setInPoint) { projectItem.setInPoint(sin, mediaType); okIn = true; } } catch (e0) {}
    try { if (!okIn && projectItem && projectItem.setInPoint) { projectItem.setInPoint(_makeTime(inTicks), mediaType); okIn = true; } } catch (e1) {}
    try { if (projectItem && projectItem.setOutPoint) { projectItem.setOutPoint(sout, mediaType); okOut = true; } } catch (e2) {}
    try { if (!okOut && projectItem && projectItem.setOutPoint) { projectItem.setOutPoint(_makeTime(outTicks), mediaType); okOut = true; } } catch (e3) {}
    return okIn && okOut;
  }

  function _prepareProjectItemForPrimaryInsert(projectItem, target, dbg) {
    var dur = 1;
    var primaryOk = false;
    var oppositeOk = false;
    try { dur = Math.max(1, Math.round(Number(target && target.duration) || (Number(target && target.end) - Number(target && target.start)) || 1)); } catch (e0) { dur = 1; }
    if (!projectItem || !target) { return; }
    try {
      if (target.type === 'V') {
        primaryOk = _setProjectItemMediaRange(projectItem, 0, dur, 1);
        oppositeOk = _setProjectItemMediaRange(projectItem, 0, 0, 2);
        _log(dbg, 'MULTI-NEST silent: przygotowalem NEST projectItem video-only: V=0-' + dur + ' ok=' + primaryOk + ', A=0-0 collapsed=' + oppositeOk + '.');
      } else if (target.type === 'A') {
        primaryOk = _setProjectItemMediaRange(projectItem, 0, dur, 2);
        oppositeOk = _setProjectItemMediaRange(projectItem, 0, 0, 1);
        _log(dbg, 'MULTI-NEST silent: przygotowalem NEST projectItem audio-only: A=0-' + dur + ' ok=' + primaryOk + ', V=0-0 collapsed=' + oppositeOk + '.');
      }
    } catch (e) {
      _log(dbg, 'MULTI-NEST silent: przygotowanie ProjectItem media range blad: ' + _err(e));
    }
  }

  function _sequenceFromCreated(created, name) {
    try { if (created && created.videoTracks !== undefined && created.audioTracks !== undefined) { return created; } } catch (e0) {}
    try {
      var seqs = app.project.sequences;
      var n = seqs ? seqs.numSequences : 0;
      for (var i = 0; i < n; i++) {
        try { if (String(seqs[i].name || '') === String(name || '')) { return seqs[i]; } } catch (e1) {}
      }
    } catch (e2) {}
    return null;
  }

  function _removeTrackItemSafe(clip) {
    if (!clip) { return false; }
    try { if (clip.remove) { clip.remove(0, 1); return true; } } catch (e0) {}
    try { if (clip.remove) { clip.remove(1, 1); return true; } } catch (e1) {}
    try { if (clip.remove) { clip.remove(); return true; } } catch (e2) {}
    return false;
  }

  function _trackCounts(seq) {
    var out = { v: 0, a: 0 };
    try { out.v = seq && seq.videoTracks ? Number(seq.videoTracks.numTracks) || 0 : 0; } catch (e0) {}
    try { out.a = seq && seq.audioTracks ? Number(seq.audioTracks.numTracks) || 0 : 0; } catch (e1) {}
    return out;
  }

  function _getQeSequenceFor(seq, dbg) {
    var qseq = null;
    var targetName = '';
    try { targetName = String(seq.name || ''); } catch (e0) { targetName = ''; }
    try { app.enableQE(); } catch (eEnable) {}
    try {
      if (typeof qe !== 'undefined' && qe && qe.project) {
        if (qe.project.getSequenceAt) {
          var n = 0;
          try { n = Number(qe.project.numSequences) || 0; } catch (eN) { n = 0; }
          for (var i = 0; i < n; i++) {
            try {
              qseq = qe.project.getSequenceAt(i);
              if (qseq && String(qseq.name || '') === targetName) { return qseq; }
            } catch (eAt) {}
          }
        }
        if (qe.project.getActiveSequence) {
          try { app.project.activeSequence = seq; } catch (eAct) {}
          try { qseq = qe.project.getActiveSequence(); if (qseq) { return qseq; } } catch (eActive) {}
        }
      }
    } catch (e) { _log(dbg, 'MULTI-NEST silent: QE sequence lookup blad: ' + _err(e)); }
    return null;
  }

  function _removeOneQeTrack(qseq, type, index, dbg) {
    function tryCall(label, fn) {
      try { fn(); _log(dbg, 'MULTI-NEST silent: QE remove ' + type + (index + 1) + ' przez ' + label + '.'); return true; } catch (e) {}
      return false;
    }
    if (!qseq) { return false; }
    if (type === 'A') {
      if (tryCall('removeTracks(0,0,1,index)', function () { qseq.removeTracks(0, 0, 1, index); })) { return true; }
      if (tryCall('removeTracks(0,0,1,1,index)', function () { qseq.removeTracks(0, 0, 1, 1, index); })) { return true; }
      if (qseq.removeAudioTrack && tryCall('removeAudioTrack(index)', function () { qseq.removeAudioTrack(index); })) { return true; }
      try { if (qseq.getAudioTrackAt && qseq.getAudioTrackAt(index) && qseq.getAudioTrackAt(index).remove) { return tryCall('getAudioTrackAt(index).remove()', function () { qseq.getAudioTrackAt(index).remove(); }); } } catch (eA) {}
    } else if (type === 'V') {
      if (tryCall('removeTracks(1,index,0,0)', function () { qseq.removeTracks(1, index, 0, 0); })) { return true; }
      if (tryCall('removeTracks(1,index,0,1,0)', function () { qseq.removeTracks(1, index, 0, 1, 0); })) { return true; }
      if (qseq.removeVideoTrack && tryCall('removeVideoTrack(index)', function () { qseq.removeVideoTrack(index); })) { return true; }
      try { if (qseq.getVideoTrackAt && qseq.getVideoTrackAt(index) && qseq.getVideoTrackAt(index).remove) { return tryCall('getVideoTrackAt(index).remove()', function () { qseq.getVideoTrackAt(index).remove(); }); } } catch (eV) {}
    }
    return false;
  }

  function _purgeOppositeTracks(subSeq, primaryType, dbg) {
    var before = _trackCounts(subSeq);
    var removed = 0;
    var qseq = _getQeSequenceFor(subSeq, dbg);
    var i;
    try {
      if (primaryType === 'V') {
        for (i = before.a - 1; i >= 0; i--) {
          if (_removeOneQeTrack(qseq, 'A', i, dbg)) { removed++; }
        }
      } else if (primaryType === 'A') {
        for (i = before.v - 1; i >= 0; i--) {
          if (_removeOneQeTrack(qseq, 'V', i, dbg)) { removed++; }
        }
      }
    } catch (e) { _log(dbg, 'MULTI-NEST silent: purge opposite tracks blad: ' + _err(e)); }
    var after = _trackCounts(subSeq);
    _log(dbg, 'MULTI-NEST silent: purge opposite tracks dla ' + primaryType + ': przed V=' + before.v + ', A=' + before.a + ' | po V=' + after.v + ', A=' + after.a + ' | removedAttempts=' + removed + '.');
    return removed;
  }

  function _cleanSubsequence(created, name, target, dbg) {
    var subSeq = _sequenceFromCreated(created, name);
    var primaryType = target.type;
    var kept = 0;
    var removedOppositeClips = 0;
    var removedForeignClips = 0;
    var t, i, cnt, c, score;
    if (!subSeq) {
      _log(dbg, 'MULTI-NEST silent: nie znalazlem stworzonej subsekwencji do czyszczenia: ' + name + '.');
      return;
    }
    try {
      if (primaryType === 'V') {
        if (subSeq.audioTracks) {
          for (t = 0; t < subSeq.audioTracks.numTracks; t++) {
            cnt = _trackItemCount(subSeq.audioTracks[t]);
            for (i = cnt - 1; i >= 0; i--) {
              c = _clipAt(subSeq.audioTracks[t], i);
              if (_removeTrackItemSafe(c)) { removedOppositeClips++; }
            }
          }
        }
        if (subSeq.videoTracks) {
          for (t = 0; t < subSeq.videoTracks.numTracks; t++) {
            cnt = _trackItemCount(subSeq.videoTracks[t]);
            for (i = cnt - 1; i >= 0; i--) {
              c = _clipAt(subSeq.videoTracks[t], i);
              score = _scoreItemToClip(target, c);
              if (score >= 9) { kept++; }
              else if (_removeTrackItemSafe(c)) { removedForeignClips++; }
            }
          }
        }
      } else if (primaryType === 'A') {
        if (subSeq.videoTracks) {
          for (t = 0; t < subSeq.videoTracks.numTracks; t++) {
            cnt = _trackItemCount(subSeq.videoTracks[t]);
            for (i = cnt - 1; i >= 0; i--) {
              c = _clipAt(subSeq.videoTracks[t], i);
              if (_removeTrackItemSafe(c)) { removedOppositeClips++; }
            }
          }
        }
        if (subSeq.audioTracks) {
          for (t = 0; t < subSeq.audioTracks.numTracks; t++) {
            cnt = _trackItemCount(subSeq.audioTracks[t]);
            for (i = cnt - 1; i >= 0; i--) {
              c = _clipAt(subSeq.audioTracks[t], i);
              score = _scoreItemToClip(target, c);
              if (score >= 9) { kept++; }
              else if (_removeTrackItemSafe(c)) { removedForeignClips++; }
            }
          }
        }
      }
    } catch (e) { _log(dbg, 'MULTI-NEST silent: cleanup subsequence blad dla ' + name + ': ' + _err(e)); }
    _log(dbg, 'MULTI-NEST silent: cleanup ' + name + ' primary=' + primaryType + ' kept=' + kept + ', removedOppositeClips=' + removedOppositeClips + ', removedForeignClips=' + removedForeignClips + '.');
    _purgeOppositeTracks(subSeq, primaryType, dbg);
  }

  function _overwriteSilent(seq, projectItem, target, dbg) {
    var t = _makeTime(target.start);
    var ok = false;
    try {
      if (target.type === 'V') {
        try {
          if (seq.videoTracks && seq.videoTracks[target.trackIndex] && seq.videoTracks[target.trackIndex].overwriteClip) {
            seq.videoTracks[target.trackIndex].overwriteClip(projectItem, t);
            ok = true;
            _log(dbg, 'MULTI-NEST silent: videoTrack.overwriteClip video-only V' + (target.trackIndex + 1) + ' -> OK.');
          }
        } catch (e0) { _log(dbg, 'MULTI-NEST silent: videoTrack.overwriteClip video-only blad: ' + _err(e0)); }
        if (!ok) {
          try {
            if (seq && seq.overwriteClip) {
              ok = seq.overwriteClip(projectItem, t, target.trackIndex, -1) || ok;
              _log(dbg, 'MULTI-NEST silent: fallback seq.overwriteClip video-only V' + (target.trackIndex + 1) + ', A=-1 -> ' + (ok ? 'OK' : 'FAIL') + '.');
            }
          } catch (e1) { _log(dbg, 'MULTI-NEST silent: fallback seq.overwriteClip video-only blad: ' + _err(e1)); }
        }
      } else if (target.type === 'A') {
        try {
          if (seq.audioTracks && seq.audioTracks[target.trackIndex] && seq.audioTracks[target.trackIndex].overwriteClip) {
            seq.audioTracks[target.trackIndex].overwriteClip(projectItem, t);
            ok = true;
            _log(dbg, 'MULTI-NEST silent: audioTrack.overwriteClip audio-only A' + (target.trackIndex + 1) + ' -> OK.');
          }
        } catch (e2) { _log(dbg, 'MULTI-NEST silent: audioTrack.overwriteClip audio-only blad: ' + _err(e2)); }
        if (!ok) {
          try {
            if (seq && seq.overwriteClip) {
              ok = seq.overwriteClip(projectItem, t, -1, target.trackIndex) || ok;
              _log(dbg, 'MULTI-NEST silent: fallback seq.overwriteClip audio-only V=-1, A' + (target.trackIndex + 1) + ' -> ' + (ok ? 'OK' : 'FAIL') + '.');
            }
          } catch (e3) { _log(dbg, 'MULTI-NEST silent: fallback seq.overwriteClip audio-only blad: ' + _err(e3)); }
        }
      }
    } catch (e) { _log(dbg, 'MULTI-NEST silent: overwrite ERROR: ' + _err(e)); }
    return ok;
  }

  function _overlapsWindow(clip, startTicks, endTicks) {
    try {
      var st = _ticks(clip.start);
      var en = _ticks(clip.end);
      var a = Number(startTicks) || 0;
      var b = Number(endTicks) || 0;
      var tol = 100000;
      return st < b + tol && en > a - tol;
    } catch (e) {}
    return false;
  }

  function _snapshotOppositeTimeline(seq, target) {
    var out = [];
    var tracks = null;
    var type = '';
    var t, i, cnt, c;
    try {
      if (!seq || !target) { return out; }
      if (target.type === 'V') {
        tracks = seq.audioTracks;
        type = 'A';
      } else if (target.type === 'A') {
        tracks = seq.videoTracks;
        type = 'V';
      }
      if (!tracks) { return out; }
      for (t = 0; t < tracks.numTracks; t++) {
        cnt = _trackItemCount(tracks[t]);
        for (i = 0; i < cnt; i++) {
          c = _clipAt(tracks[t], i);
          if (!c || !_overlapsWindow(c, target.start, target.end)) { continue; }
          out.push({
            type: type,
            trackIndex: t,
            start: _ticks(c.start),
            end: _ticks(c.end),
            inPoint: _ticks(c.inPoint),
            outPoint: _ticks(c.outPoint),
            name: _clipName(c),
            nodeId: _nodeId(c),
            projectItem: c.projectItem
          });
        }
      }
    } catch (e) {}
    return out;
  }

  function _clipMatchesTimelineSnapshot(clip, trackIndex, snap) {
    var st, en, nm, nid, tol, sameIdentity;
    try {
      if (!clip || !snap) { return false; }
      if (Number(trackIndex) !== Number(snap.trackIndex)) { return false; }
      tol = 100000;
      st = _ticks(clip.start);
      en = _ticks(clip.end);
      nm = _clipName(clip);
      nid = _nodeId(clip);
      sameIdentity = false;
      try { if (snap.projectItem && clip.projectItem && snap.projectItem === clip.projectItem) { sameIdentity = true; } } catch (ePi) {}
      try { if (!sameIdentity && snap.nodeId && nid && String(snap.nodeId) === String(nid)) { sameIdentity = true; } } catch (eNode) {}
      try {
        if (!sameIdentity && !snap.projectItem && !snap.nodeId && snap.name && nm && String(snap.name) === String(nm) && Math.abs(st - Number(snap.start || 0)) < tol && Math.abs(en - Number(snap.end || 0)) < tol) {
          sameIdentity = true;
        }
      } catch (eName) {}
      if (!sameIdentity) { return false; }
      if (Math.abs(st - Number(snap.start || 0)) < tol) { return true; }
      if (st < Number(snap.end || 0) + tol && en > Number(snap.start || 0) - tol) { return true; }
    } catch (e) {}
    return false;
  }

  function _clipMatchesAnyTimelineSnapshot(clip, trackIndex, snapshots) {
    try {
      for (var i = 0; i < snapshots.length; i++) {
        if (_clipMatchesTimelineSnapshot(clip, trackIndex, snapshots[i])) { return true; }
      }
    } catch (e) {}
    return false;
  }

  function _clipMatchesExactTimelineSnapshot(clip, trackIndex, snap) {
    var st, en, nm, nid, tol, sameIdentity;
    try {
      if (!clip || !snap) { return false; }
      if (Number(trackIndex) !== Number(snap.trackIndex)) { return false; }
      tol = 100000;
      st = _ticks(clip.start);
      en = _ticks(clip.end);
      nm = _clipName(clip);
      nid = _nodeId(clip);
      sameIdentity = false;
      try { if (snap.projectItem && clip.projectItem && snap.projectItem === clip.projectItem) { sameIdentity = true; } } catch (ePi) {}
      try { if (!sameIdentity && snap.nodeId && nid && String(snap.nodeId) === String(nid)) { sameIdentity = true; } } catch (eNode) {}
      try {
        if (!sameIdentity && !snap.projectItem && !snap.nodeId && snap.name && nm && String(snap.name) === String(nm)) {
          sameIdentity = true;
        }
      } catch (eName) {}
      if (!sameIdentity) { return false; }
      return Math.abs(st - Number(snap.start || 0)) < tol && Math.abs(en - Number(snap.end || 0)) < tol;
    } catch (e) {}
    return false;
  }

  function _snapshotExistsExactly(seq, snap) {
    var tracks, track, cnt, i, c;
    try {
      if (!seq || !snap) { return false; }
      tracks = snap.type === 'A' ? seq.audioTracks : seq.videoTracks;
      if (!tracks || snap.trackIndex < 0 || snap.trackIndex >= tracks.numTracks) { return false; }
      track = tracks[snap.trackIndex];
      cnt = _trackItemCount(track);
      for (i = 0; i < cnt; i++) {
        c = _clipAt(track, i);
        if (_clipMatchesExactTimelineSnapshot(c, snap.trackIndex, snap)) { return true; }
      }
    } catch (e) {}
    return false;
  }

  function _trySetProjectItemInOut(projectItem, snap, dbg) {
    var ok = false;
    var mediaType = 4;
    try { mediaType = snap && snap.type === 'A' ? 2 : 1; } catch (e0) {}
    try { if (projectItem && projectItem.setInPoint) { projectItem.setInPoint(String(Math.round(Number(snap.inPoint) || 0)), mediaType); ok = true; } } catch (e1) {}
    try { if (projectItem && projectItem.setOutPoint) { projectItem.setOutPoint(String(Math.round(Number(snap.outPoint) || 0)), mediaType); ok = true; } } catch (e2) {}
    try { if (projectItem && projectItem.setInPoint) { projectItem.setInPoint(_makeTime(snap.inPoint), mediaType); ok = true; } } catch (e3) {}
    try { if (projectItem && projectItem.setOutPoint) { projectItem.setOutPoint(_makeTime(snap.outPoint), mediaType); ok = true; } } catch (e4) {}
    if (!ok) { _log(dbg, 'MULTI-NEST silent: restore original nie ustawil In/Out dla "' + (snap.name || '') + '".'); }
    return ok;
  }

  function _trimRestoredSnapshot(seq, snap) {
    var tracks, track, cnt, i, c, st, nm, nid, sameIdentity, tol;
    try {
      tracks = snap.type === 'A' ? seq.audioTracks : seq.videoTracks;
      if (!tracks || snap.trackIndex < 0 || snap.trackIndex >= tracks.numTracks) { return; }
      track = tracks[snap.trackIndex];
      cnt = _trackItemCount(track);
      tol = 100000;
      for (i = 0; i < cnt; i++) {
        c = _clipAt(track, i);
        st = _ticks(c.start);
        if (Math.abs(st - Number(snap.start || 0)) >= tol) { continue; }
        nm = _clipName(c);
        nid = _nodeId(c);
        sameIdentity = false;
        try { if (snap.projectItem && c.projectItem && snap.projectItem === c.projectItem) { sameIdentity = true; } } catch (ePi) {}
        try { if (!sameIdentity && snap.nodeId && nid && String(snap.nodeId) === String(nid)) { sameIdentity = true; } } catch (eNode) {}
        try { if (!sameIdentity && snap.name && nm && String(snap.name) === String(nm)) { sameIdentity = true; } } catch (eName) {}
        if (!sameIdentity) { continue; }
        try { c.end = _makeTime(snap.end); } catch (e0) {}
        try { if (c.end && c.end.ticks !== undefined) { c.end.ticks = String(Math.round(Number(snap.end) || 0)); } } catch (e1) {}
        break;
      }
    } catch (e) {}
  }

  function _snapshotTimelineType(seq, type, startTicks, endTicks) {
    var out = [];
    var tracks = null;
    var t, i, cnt, c;
    try {
      if (!seq || !type) { return out; }
      tracks = type === 'A' ? seq.audioTracks : seq.videoTracks;
      if (!tracks) { return out; }
      for (t = 0; t < tracks.numTracks; t++) {
        cnt = _trackItemCount(tracks[t]);
        for (i = 0; i < cnt; i++) {
          c = _clipAt(tracks[t], i);
          if (!c || !_overlapsWindow(c, startTicks, endTicks)) { continue; }
          out.push({
            type: type,
            trackIndex: t,
            start: _ticks(c.start),
            end: _ticks(c.end),
            name: _clipName(c),
            nodeId: _nodeId(c),
            projectItem: c.projectItem
          });
        }
      }
    } catch (e) {}
    return out;
  }

  function _removeNewTimelineTypeItems(seq, type, startTicks, endTicks, snapshots, dbg, label) {
    var tracks = null;
    var removed = 0;
    var kept = 0;
    var failed = 0;
    var t, i, cnt, c, nm;
    try {
      tracks = type === 'A' ? seq.audioTracks : seq.videoTracks;
      if (!tracks) { return { removed: 0, kept: 0, failed: 0 }; }
      for (t = 0; t < tracks.numTracks; t++) {
        cnt = _trackItemCount(tracks[t]);
        for (i = cnt - 1; i >= 0; i--) {
          c = _clipAt(tracks[t], i);
          if (!c || !_overlapsWindow(c, startTicks, endTicks)) { continue; }
          if (_clipMatchesAnyTimelineSnapshot(c, t, snapshots || [])) {
            kept++;
            continue;
          }
          nm = _clipName(c);
          if (_removeTrackItemSafe(c)) { removed++; }
          else {
            failed++;
            _log(dbg, 'MULTI-NEST silent: safety cleanup nie usunal ' + type + (t + 1) + ' "' + (nm || '') + '".');
          }
        }
      }
    } catch (e) { _log(dbg, 'MULTI-NEST silent: safety cleanup ERROR: ' + _err(e)); }
    _log(dbg, 'MULTI-NEST silent: safety cleanup ' + (label || '') + ' type=' + type + ': kept=' + kept + ', removed=' + removed + ', failed=' + failed + '.');
    return { removed: removed, kept: kept, failed: failed };
  }

  function _restoreMissingOppositeSnapshots(seq, snapshots, dbg) {
    var restored = 0;
    var already = 0;
    var failed = 0;
    var i, snap, tracks, ok, t;
    try {
      if (!seq || !snapshots || !snapshots.length) {
        _log(dbg, 'MULTI-NEST silent: restore original opposite: brak snapshotow.');
        return { restored: 0, already: 0, failed: 0 };
      }
      for (i = 0; i < snapshots.length; i++) {
        snap = snapshots[i];
        if (_snapshotExistsExactly(seq, snap)) { already++; continue; }
        if (!snap.projectItem) { failed++; continue; }
        tracks = snap.type === 'A' ? seq.audioTracks : seq.videoTracks;
        if (!tracks || snap.trackIndex < 0 || snap.trackIndex >= tracks.numTracks) { failed++; continue; }
        _trySetProjectItemInOut(snap.projectItem, snap, dbg);
        ok = false;
        t = _makeTime(snap.start);
        if (seq && seq.overwriteClip) {
          try {
            if (snap.type === 'A') { ok = seq.overwriteClip(snap.projectItem, t, -1, snap.trackIndex) || ok; }
            else { ok = seq.overwriteClip(snap.projectItem, t, snap.trackIndex, -1) || ok; }
          } catch (e0) {}
        }
        if (ok) {
          restored++;
          _trimRestoredSnapshot(seq, snap);
        } else {
          failed++;
        }
      }
    } catch (e) { _log(dbg, 'MULTI-NEST silent: restore original opposite ERROR: ' + _err(e)); }
    _log(dbg, 'MULTI-NEST silent: restore original opposite po cleanupie: restored=' + restored + ', already=' + already + ', failed=' + failed + '.');
    return { restored: restored, already: already, failed: failed };
  }

  function _removeNewOppositeTimelineItems(seq, target, snapshots, dbg) {
    var removedV = 0;
    var removedA = 0;
    var kept = 0;
    var failed = 0;
    var tracks = null;
    var type = '';
    var t, i, cnt, c, nm;
    try {
      if (!seq || !target) { return { removedV: 0, removedA: 0, kept: 0, failed: 0 }; }
      if (target.type === 'V') {
        tracks = seq.audioTracks;
        type = 'A';
      } else if (target.type === 'A') {
        tracks = seq.videoTracks;
        type = 'V';
      }
      if (!tracks) { return { removedV: 0, removedA: 0, kept: 0, failed: 0 }; }
      for (t = 0; t < tracks.numTracks; t++) {
        cnt = _trackItemCount(tracks[t]);
        for (i = cnt - 1; i >= 0; i--) {
          c = _clipAt(tracks[t], i);
          if (!c || !_overlapsWindow(c, target.start, target.end)) { continue; }
          if (_clipMatchesAnyTimelineSnapshot(c, t, snapshots || [])) {
            kept++;
            continue;
          }
          nm = _clipName(c);
          if (_removeTrackItemSafe(c)) {
            if (type === 'A') { removedA++; } else { removedV++; }
          } else {
            failed++;
            _log(dbg, 'MULTI-NEST silent: diff cleanup nie usunal ' + type + (t + 1) + ' "' + (nm || '') + '".');
          }
        }
      }
    } catch (e) { _log(dbg, 'MULTI-NEST silent: diff cleanup ERROR: ' + _err(e)); }
    _log(dbg, 'MULTI-NEST silent: diff cleanup po insercie ' + target.type + (target.trackIndex + 1) + ': keptOriginal=' + kept + ', removedNewV=' + removedV + ', removedNewA=' + removedA + ', failed=' + failed + '.');
    return { removedV: removedV, removedA: removedA, kept: kept, failed: failed };
  }

  function _findSequenceByIdOrName(seqId, seqName) {
    try {
      var seqs = app.project.sequences;
      var n = seqs ? seqs.numSequences : 0;
      for (var i = 0; i < n; i++) {
        var s = seqs[i];
        var sid = '';
        var sn = '';
        try { sid = String(s.sequenceID || ''); } catch (e0) {}
        try { sn = String(s.name || ''); } catch (e1) {}
        if (seqId && sid === String(seqId)) { return s; }
        if (seqName && sn === String(seqName)) { return s; }
      }
    } catch (e) {}
    return null;
  }

  function _getSessionSequence(session) {
    try { if (session && session.seq) { return session.seq; } } catch (e0) {}
    try { return _findSequenceByIdOrName(session.seqId, session.seqName) || app.project.activeSequence; } catch (e1) {}
    return null;
  }

  function _nestCommandNames() {
    var ell = String.fromCharCode(0x2026);
    var zacute = String.fromCharCode(0x017A);
    var zdot = String.fromCharCode(0x017C);
    return [
      'Nest',
      'Nest...',
      'Nest' + ell,
      'Zagnie' + zacute + 'd' + zacute,
      'Zagnie' + zacute + 'd' + zacute + '...',
      'Zagnie' + zacute + 'd' + zacute + ell,
      'Zagnie' + zdot + 'd' + zdot,
      'Zagnie' + zdot + 'd' + zdot + '...',
      'Zagnie' + zdot + 'd' + zdot + ell
    ];
  }

  function _findCommandId(names) {
    var id = 0;
    try {
      for (var i = 0; i < names.length; i++) {
        try {
          id = app.findMenuCommandId(names[i]);
          if (id) { return id; }
        } catch (e0) {}
      }
    } catch (e) {}
    return 0;
  }

  function _executeNativeNest(dbg) {
    var id = _findCommandId(_nestCommandNames());
    var res;
    if (!id) {
      _log(dbg, 'MULTI-NEST native: ERROR nie znalazlem komendy Premiere Nest przez findMenuCommandId.');
      return false;
    }
    try {
      res = app.executeCommand(id);
      _log(dbg, 'MULTI-NEST native: executeCommand Nest id=' + id + ' -> ' + String(res) + '.');
      return true;
    } catch (e) {
      _log(dbg, 'MULTI-NEST native: executeCommand Nest ERROR id=' + id + ': ' + _err(e));
    }
    return false;
  }

  function _jsonStringify(value) {
    function esc(str) {
      return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
    }
    function val(v) {
      var i, out, first;
      if (v === null || v === undefined) { return 'null'; }
      if (typeof v === 'number' || typeof v === 'boolean') { return String(v); }
      if (typeof v === 'string') { return '"' + esc(v) + '"'; }
      if (v instanceof Array) {
        out = '[';
        for (i = 0; i < v.length; i++) { if (i) { out += ','; } out += val(v[i]); }
        return out + ']';
      }
      if (typeof v === 'object') {
        out = '{'; first = true;
        for (i in v) {
          if (v.hasOwnProperty && !v.hasOwnProperty(i)) { continue; }
          if (!first) { out += ','; }
          first = false;
          out += '"' + esc(i) + '":' + val(v[i]);
        }
        return out + '}';
      }
      return '"' + esc(String(v)) + '"';
    }
    return val(value);
  }

  function _parseJson(text) {
    try { if (typeof JSON !== 'undefined' && JSON && JSON.parse) { return JSON.parse(String(text || '{}')); } } catch (e0) {}
    try { return eval('(' + String(text || '{}') + ')'); } catch (e1) {}
    return null;
  }

  function _menuMarker(payload) {
    return '__MULTINEST_NATIVE_MENU__' + _jsonStringify(payload || {}) + '__END_MULTINEST_NATIVE_MENU__';
  }

  function _undoMarker(session) {
    var payload = _jsonStringify({
      module: 'MULTI-NEST_NATIVE_MENU',
      version: MN_VERSION,
      createdCount: Number(session && session.created || 0),
      createdNames: session && session.createdNames ? session.createdNames : [],
      undoSteps: Math.max(1, Number(session && session.created || 0) * 3)
    });
    return '__MULTINEST_UNDO__' + payload + '__END_MULTINEST_UNDO__';
  }

  function _finishSession(session, dbg) {
    try {
      var seq = _getSessionSequence(session);
      if (seq) {
        _clearSelection(seq);
        try { app.project.activeSequence = seq; } catch (eActive) {}
      }
    } catch (e0) {}
    _log(dbg, 'SUMMARY: selectedItems=' + Number(session && session.total || 0) + ', nativeNestsCreated=' + Number(session && session.created || 0) + ', failed=' + Number(session && session.failed || 0) + ', elapsedMs=' + (new Date().getTime() - Number(session && session.started || new Date().getTime())) + '.');
    _log(dbg, 'MULTI-NEST native menu END');
    try { AEDRNO._multiNestNativeSession = null; } catch (e1) {}
    return dbg.join('\n') + '\n' + _undoMarker(session);
  }

  function _prepareNextNativeMenuStep(session, dbg) {
    var seq, target, currentClip, nestName, payload;
    try {
      seq = _getSessionSequence(session);
      if (!seq) {
        session.failed++;
        _log(dbg, 'MULTI-NEST native menu: brak sekwencji rodzica, koncze.');
        return _finishSession(session, dbg);
      }
      try { app.project.activeSequence = seq; } catch (eActive) {}

      while (session.nextIndex < session.selected.length) {
        target = session.selected[session.nextIndex];
        nestName = 'Mutli-NEST ' + (Number(session.nameStart) + Number(session.nextIndex));
        currentClip = _findCurrentTarget(seq, target);
        if (!currentClip) {
          session.failed++;
          _log(dbg, 'MULTI-NEST native menu: pomijam #' + (session.nextIndex + 1) + ' - nie znalazlem juz klipu ' + target.type + (target.trackIndex + 1) + ' "' + (target.name || '') + '" start=' + target.start + '.');
          session.nextIndex++;
          continue;
        }
        _clearSelection(seq);
        if (!_selectOne(currentClip)) {
          session.failed++;
          _log(dbg, 'MULTI-NEST native menu: pomijam #' + (session.nextIndex + 1) + ' - nie udalo sie zaznaczyc pojedynczego klipu.');
          session.nextIndex++;
          continue;
        }
        session.before = _snapshotSequences();
        session.currentNestName = nestName;
        session.currentTarget = target;
        payload = {
          sessionId: session.id,
          index: session.nextIndex,
          total: session.total,
          nestName: nestName,
          type: target.type,
          track: target.trackIndex + 1,
          clipName: target.name || ''
        };
        _log(dbg, 'MULTI-NEST native menu: #' + (session.nextIndex + 1) + '/' + session.total + ' -> zaznaczony tylko ' + target.type + (target.trackIndex + 1) + ' "' + (target.name || '') + '". Panel ma teraz kliknac Clip > Nest.');
        return dbg.join('\n') + '\n' + _menuMarker(payload);
      }
      return _finishSession(session, dbg);
    } catch (e) {
      _log(dbg, 'MULTI-NEST native menu prepare ERROR: ' + _err(e));
      return _finishSession(session, dbg);
    }
  }

  function _tryUndoOnce(dbg) {
    try {
      if (app && typeof app.undo === 'function') {
        try { app.undo(); return true; } catch (e0) { _log(dbg, 'MULTI-NEST native Undo: app.undo blad: ' + _err(e0)); }
      }
      var cmd = _findCommandId(['Undo', 'Cofnij']);
      try { if (cmd && app.executeCommand) { app.executeCommand(cmd); return true; } } catch (e1) { _log(dbg, 'MULTI-NEST native Undo: executeCommand Undo blad: ' + _err(e1)); }
      try { if (app.executeCommand) { app.executeCommand(16); return true; } } catch (e2) { _log(dbg, 'MULTI-NEST native Undo: executeCommand(16) blad: ' + _err(e2)); }
    } catch (e) {
      _log(dbg, 'MULTI-NEST native Undo ERROR: ' + _err(e));
    }
    return false;
  }

  AEDRNO.undoLastMultiNestByHistory = function (payloadJson) {
    var dbg = [];
    _log(dbg, '=== MULTI-NEST native Undo v' + MN_VERSION + ' ===');
    try {
      var info = _parseJson(payloadJson) || {};
      var steps = Math.max(1, Math.min(200, Number(info.undoSteps) || Number(info.createdCount) || 1));
      var done = 0;
      _log(dbg, 'MULTI-NEST native Undo: cofam Premiere steps=' + steps + '.');
      for (var i = 0; i < steps; i++) {
        if (!_tryUndoOnce(dbg)) { break; }
        done++;
      }
      _log(dbg, 'MULTI-NEST native Undo: wykonano undo=' + done + '/' + steps + '.');
    } catch (e) {
      _log(dbg, 'MULTI-NEST native Undo ERROR: ' + _err(e));
    }
    return dbg.join('\n');
  };

  AEDRNO.multiNestSelectedClips = function () {
    var dbg = [];
    var started = new Date().getTime();
    var created = 0;
    var failed = 0;
    var createdNames = [];
    var createdItems = [];
    _log(dbg, 'MULTI-NEST silent START v' + MN_VERSION);
    try {
      var seq = app.project.activeSequence;
      if (!seq) { return 'MULTI-NEST silent: brak aktywnej sekwencji.'; }

      var selected = _collectSelected(seq, dbg);
      if (!selected.length) {
        _log(dbg, 'MULTI-NEST silent: nie wykryto zaznaczonych klipow na timeline.');
        return dbg.join('\n');
      }

      var nameStart = _nextNestNumber();
      _log(dbg, 'MULTI-NEST silent: wybrane TrackItemy=' + selected.length + ', tryb=1 TrackItem -> 1 cichy NEST, nazwy od Mutli-NEST ' + nameStart + '.');

      for (var i = 0; i < selected.length; i++) {
        var target = selected[i];
        var nestName = 'Mutli-NEST ' + (nameStart + i);
        var currentClip = null;
        var sub = null;
        var pi = null;
        var oppositeBefore = [];
        var diffResult = null;
        try { app.project.activeSequence = seq; } catch (eActive0) {}

        currentClip = _findCurrentTarget(seq, target);
        if (!currentClip) {
          failed++;
          _log(dbg, 'MULTI-NEST silent: pomijam #' + (i + 1) + ' - nie znalazlem juz klipu ' + target.type + (target.trackIndex + 1) + ' "' + (target.name || '') + '" start=' + target.start + '.');
          continue;
        }

        _clearSelection(seq);
        if (!_selectOne(currentClip)) {
          failed++;
          _log(dbg, 'MULTI-NEST silent: pomijam #' + (i + 1) + ' - nie udalo sie zaznaczyc pojedynczego klipu.');
          continue;
        }

        _targetOnly(seq, target.type, target.trackIndex, dbg);
        if (!_setInOut(seq, target.start, target.end, dbg)) {
          failed++;
          _log(dbg, 'MULTI-NEST silent: pomijam ' + nestName + ', bo nie udalo sie ustawic In/Out.');
          continue;
        }

        _log(dbg, 'MULTI-NEST silent: #' + (i + 1) + '/' + selected.length + ' tworze subsequence dla ' + target.type + (target.trackIndex + 1) + ' "' + (target.name || '') + '".');
        sub = _createSubsequence(seq, nestName, dbg);
        pi = _projectItemFromCreated(sub);
        if (!sub || !pi) {
          failed++;
          _log(dbg, 'MULTI-NEST silent: nie udalo sie utworzyc NEST-a ' + nestName + '.');
          continue;
        }

        _cleanSubsequence(sub, nestName, target, dbg);
        try { app.project.activeSequence = seq; } catch (eActive1) {}
        _clearSelection(seq);
        _prepareProjectItemForPrimaryInsert(pi, target, dbg);
        oppositeBefore = _snapshotOppositeTimeline(seq, target);
        _log(dbg, 'MULTI-NEST silent: diff baseline przed insertem ' + target.type + (target.trackIndex + 1) + ': oppositeItems=' + oppositeBefore.length + '.');
        if (_overwriteSilent(seq, pi, target, dbg)) {
          if (target.type === 'V') {
            _log(dbg, 'MULTI-NEST silent: video-only - nie usuwam nic z audio timeline. Audio ma pozostac 1:1 bez zmian.');
          } else {
            diffResult = _removeNewOppositeTimelineItems(seq, target, oppositeBefore, dbg);
            if (oppositeBefore.length && diffResult && Number(diffResult.kept || 0) < oppositeBefore.length) {
              _log(dbg, 'MULTI-NEST silent: WARN oryginalnych przeciwleglych klipow po cleanupie jest mniej niz przed insertem: before=' + oppositeBefore.length + ', kept=' + diffResult.kept + '. Nie odtwarzam ich automatycznie, zeby nie wstawic linked video/audio.');
            }
          }
          created++;
          createdNames.push(nestName);
          createdItems.push(_makeUndoSnapshotItem(seq, sub, pi, target, nestName));
          _log(dbg, 'MULTI-NEST silent: utworzono i wstawiono ' + nestName + '.');
        } else {
          failed++;
          _log(dbg, 'MULTI-NEST silent: nie udalo sie wstawic ' + nestName + ' na timeline.');
        }
      }

      _clearSelection(seq);
      _clearInOut(seq);
      try { app.project.activeSequence = seq; } catch (eActive2) {}
      _log(dbg, 'SUMMARY: selectedItems=' + selected.length + ', silentNestsCreated=' + created + ', failed=' + failed + ', elapsedMs=' + (new Date().getTime() - started) + '.');
      _log(dbg, 'MULTI-NEST silent END');
      var payload = _jsonStringify({
        module: 'MULTI-NEST_SILENT',
        version: MN_VERSION,
        createdCount: created,
        createdNames: createdNames,
        items: createdItems,
        undoMode: 'snapshotUnNestBatch',
        undoSteps: Math.max(1, created * 4)
      });
      return dbg.join('\n') + '\n__MULTINEST_UNDO__' + payload + '__END_MULTINEST_UNDO__';
    } catch (e) {
      _log(dbg, 'MULTI-NEST silent ERROR: ' + _err(e));
      return dbg.join('\n');
    }
  };

  AEDRNO.multiNestNativeContinue = function (payloadJson, menuOk, menuMessage) {
    var dbg = [];
    var session = null;
    var payload = null;
    var newSeq = null;
    var ok = false;
    _log(dbg, 'MULTI-NEST native menu CONTINUE v' + MN_VERSION);
    try {
      payload = _parseJson(payloadJson) || {};
      session = AEDRNO._multiNestNativeSession;
      if (!session || !payload || String(session.id || '') !== String(payload.sessionId || '')) {
        _log(dbg, 'MULTI-NEST native menu: brak aktywnej sesji albo sessionId sie nie zgadza.');
        return dbg.join('\n');
      }
      ok = !!menuOk;
      _log(dbg, 'MULTI-NEST native menu: wynik klikniecia menu dla #' + (Number(session.nextIndex) + 1) + '/' + session.total + ' -> ' + (ok ? 'OK' : 'FAIL') + (menuMessage ? ' | ' + String(menuMessage) : '') + '.');
      if (ok) {
        try { app.project.activeSequence = _getSessionSequence(session); } catch (eActive) {}
        newSeq = _findNewSequence(session.before);
        if (newSeq) {
          if (_renameSequence(newSeq, session.currentNestName)) {
            session.createdNames.push(session.currentNestName);
            _log(dbg, 'MULTI-NEST native menu: utworzono i nazwano ' + session.currentNestName + '.');
          } else {
            try { session.createdNames.push(String(newSeq.name || session.currentNestName)); } catch (eNm) { session.createdNames.push(session.currentNestName); }
            _log(dbg, 'MULTI-NEST native menu: utworzono NEST, ale nie udalo sie zmienic nazwy na ' + session.currentNestName + '.');
          }
          session.created++;
        } else {
          session.failed++;
          _log(dbg, 'MULTI-NEST native menu: po kliknieciu Clip > Nest nie wykrylem nowej sekwencji. Mozliwe, ze dialog nie zostal zatwierdzony albo menu nie wykonalo Nest.');
        }
      } else {
        session.failed++;
      }
      session.nextIndex++;
      return _prepareNextNativeMenuStep(session, dbg);
    } catch (e) {
      _log(dbg, 'MULTI-NEST native menu CONTINUE ERROR: ' + _err(e));
      try {
        if (session) { session.failed++; session.nextIndex++; return _prepareNextNativeMenuStep(session, dbg); }
      } catch (e2) {}
      return dbg.join('\n');
    }
  };
}());
