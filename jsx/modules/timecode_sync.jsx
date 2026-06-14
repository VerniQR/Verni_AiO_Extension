(function () {
  var TICKS_PER_SECOND = 254016000000;

  function trim(s) {
    return String(s || '').replace(/^\s+|\s+$/g, '');
  }

  function toNumberTicks(v) {
    if (v === undefined || v === null || v === '') { return null; }
    try {
      if (typeof v === 'object') {
        if (v.ticks !== undefined && v.ticks !== null && v.ticks !== '') { return Number(v.ticks); }
        if (v.seconds !== undefined && v.seconds !== null) { return Math.round(Number(v.seconds) * TICKS_PER_SECOND); }
      }
      var n = Number(v);
      if (!isNaN(n)) { return n; }
    } catch (e) {}
    return null;
  }

  function makeTime(ticks) {
    try {
      var t = new Time();
      t.ticks = String(Math.max(0, Math.round(ticks)));
      return t;
    } catch (e) {}
    return String(Math.max(0, Math.round(ticks)));
  }

  function getSequenceFrameRate(seq) {
    try {
      var settings = seq.getSettings();
      if (settings && settings.videoFrameRate && settings.videoFrameRate.seconds) {
        var fps = 1 / Number(settings.videoFrameRate.seconds);
        if (fps > 0 && fps < 300) { return fps; }
      }
    } catch (e) {}
    return 25;
  }

  function parseTimecodeToTicks(tc, fps) {
    var value = trim(tc);
    if (!value || value === '--') { return 0; }
    value = value.replace(/;/g, ':');

    if (value.indexOf(':') === -1) {
      var seconds = Number(value.replace(',', '.'));
      if (!isNaN(seconds)) { return Math.round(seconds * TICKS_PER_SECOND); }
      return 0;
    }

    var parts = value.split(':');
    while (parts.length < 4) { parts.unshift('0'); }
    var h = Number(parts[parts.length - 4]) || 0;
    var m = Number(parts[parts.length - 3]) || 0;
    var s = Number(parts[parts.length - 2]) || 0;
    var f = Number(parts[parts.length - 1]) || 0;
    var roundedFps = Math.round(fps || 25);
    var totalFrames = (((h * 60 + m) * 60 + s) * roundedFps) + f;
    return Math.round(totalFrames * TICKS_PER_SECOND / (fps || roundedFps || 25));
  }

  function getSeqZeroTicks(seq, fps) {
    try {
      var z = toNumberTicks(seq.zeroPoint);
      if (z !== null) { return z; }
    } catch (e) {}
    try {
      if (seq.getSettings) {
        var settings = seq.getSettings();
        if (settings && settings.videoDisplayFormat) {}
      }
    } catch (e2) {}
    return 0;
  }

  function timeObjFromMethod(item, methodName) {
    try {
      if (item && item[methodName]) {
        var v = item[methodName]();
        var n = toNumberTicks(v);
        if (n !== null) { return n; }
      }
    } catch (e) {}
    try {
      if (item && item[methodName]) {
        var v2 = item[methodName](4);
        var n2 = toNumberTicks(v2);
        if (n2 !== null) { return n2; }
      }
    } catch (e2) {}
    return null;
  }

  function getStartTimeTicks(item) {
    try {
      if (item && item.startTime) {
        var v = (typeof item.startTime === 'function') ? item.startTime() : item.startTime;
        var n = toNumberTicks(v);
        if (n !== null) { return n; }
      }
    } catch (e) {}
    return null;
  }

  function getProjectMetadataText(item) {
    try {
      if (item && item.getProjectMetadata) { return String(item.getProjectMetadata() || ''); }
    } catch (e) {}
    return '';
  }

  function extractNear(xml, fieldName, wantedNames, fps) {
    var lower = xml.toLowerCase();
    var pos = lower.indexOf(String(fieldName).toLowerCase());
    if (pos < 0) { return null; }
    var chunk = xml.substring(pos, Math.min(xml.length, pos + 2600));

    for (var i = 0; i < wantedNames.length; i++) {
      var name = wantedNames[i];
      var reTag = new RegExp('<[^>]*' + name + '[^>]*>([^<]+)<', 'i');
      var m = reTag.exec(chunk);
      if (m && m[1]) {
        var raw = trim(m[1]);
        if (name.toLowerCase().indexOf('tick') !== -1) {
          var ticks = Number(raw);
          if (!isNaN(ticks)) { return ticks; }
        } else {
          return parseTimecodeToTicks(raw, fps);
        }
      }
      var reAttr = new RegExp(name + '="([^"]+)"', 'i');
      var ma = reAttr.exec(chunk);
      if (ma && ma[1]) {
        var rawAttr = trim(ma[1]);
        if (name.toLowerCase().indexOf('tick') !== -1) {
          var ticksAttr = Number(rawAttr);
          if (!isNaN(ticksAttr)) { return ticksAttr; }
        } else {
          return parseTimecodeToTicks(rawAttr, fps);
        }
      }
    }
    return null;
  }

  function getXmpTicks(item, fields, fps) {
    var xml = getProjectMetadataText(item);
    if (!xml) { return null; }
    for (var i = 0; i < fields.length; i++) {
      var n = extractNear(xml, fields[i], ['ticks', 'Ticks', 'timeDisplay', 'TimeDisplay', 'frame'], fps);
      if (n !== null) { return n; }
    }
    return null;
  }

  function getItemSyncTicks(item, mode, fps) {
    var v = null;

    if (mode === 'inPoint') {
      v = timeObjFromMethod(item, 'getInPoint');
      if (v !== null) { return v; }
      v = getXmpTicks(item, ['VideoInPoint', 'AudioInPoint', 'InPoint'], fps);
      if (v !== null) { return v; }
    }

    if (mode === 'outPoint') {
      v = timeObjFromMethod(item, 'getOutPoint');
      if (v !== null) { return v; }
      v = getXmpTicks(item, ['VideoOutPoint', 'AudioOutPoint', 'OutPoint'], fps);
      if (v !== null) { return v; }
    }

    v = getStartTimeTicks(item);
    if (v !== null) { return v; }

    v = getXmpTicks(item, ['MediaStart', 'StartTimecode', 'StartTime', 'VideoInPoint', 'AudioInPoint', 'Timecode'], fps);
    if (v !== null) { return v; }

    v = timeObjFromMethod(item, 'getInPoint');
    if (v !== null) { return v; }

    return null;
  }

  function getSelection() {
    try {
      if (app.getCurrentProjectViewSelection) {
        return app.getCurrentProjectViewSelection();
      }
    } catch (e) {}
    return null;
  }

  function selectionToArray(selection) {
    var out = [];
    try {
      var n = selection ? selection.length : 0;
      for (var i = 0; i < n; i++) {
        if (selection[i]) { out.push(selection[i]); }
      }
    } catch (e) {}
    return out;
  }

  function projectItemUniqueKey(item) {
    try { if (item && item.nodeId !== undefined && item.nodeId !== null) { return 'node:' + String(item.nodeId); } } catch (e0) {}
    try { if (item && item.treePath) { return 'tree:' + String(item.treePath); } } catch (e1) {}
    try {
      var path = safeItemPath(item);
      if (path) { return 'path:' + path + '|name:' + itemName(item); }
    } catch (e2) {}
    try { return 'name:' + itemName(item) + '|type:' + safeItemType(item); } catch (e3) {}
    return 'unknown:' + Math.random();
  }

  function getProjectItemChildrenCount(item) {
    try {
      if (item && item.children && item.children.numItems !== undefined) {
        return Number(item.children.numItems) || 0;
      }
    } catch (e) {}
    return 0;
  }

  function getProjectItemChild(item, index) {
    try {
      if (item && item.children && item.children[index]) { return item.children[index]; }
    } catch (e0) {}
    try {
      if (item && item.children && item.children.getItemAt) { return item.children.getItemAt(index); }
    } catch (e1) {}
    return null;
  }

  function isBinProjectItem(item) {
    if (!item) { return false; }
    try {
      if (typeof ProjectItemType !== 'undefined' && ProjectItemType && item.type === ProjectItemType.BIN) { return true; }
    } catch (e0) {}
    try {
      var t = String(item.type || '').toLowerCase();
      if (t.indexOf('bin') !== -1 || t.indexOf('root') !== -1) { return true; }
    } catch (e1) {}
    // Premiere nie zawsze zwraca czytelny typ. Bin rozpoznajemy też po dzieciach i braku ścieżki media.
    try {
      if (getProjectItemChildrenCount(item) > 0 && !safeItemPath(item)) { return true; }
    } catch (e2) {}
    return false;
  }

  function appendMediaItemsFromProjectItem(item, out, seen, stats, depth) {
    if (!item || depth > 16) { return; }
    if (isBinProjectItem(item)) {
      stats.bins++;
      var count = getProjectItemChildrenCount(item);
      for (var i = 0; i < count; i++) {
        appendMediaItemsFromProjectItem(getProjectItemChild(item, i), out, seen, stats, depth + 1);
      }
      return;
    }

    var key = projectItemUniqueKey(item);
    if (seen[key]) {
      stats.duplicates++;
      return;
    }
    seen[key] = true;
    out.push(item);
    stats.items++;
  }

  function expandSelectionToMediaItems(selection) {
    var raw = selectionToArray(selection);
    var out = [];
    var seen = {};
    var stats = { selected: raw.length, bins: 0, items: 0, duplicates: 0 };
    for (var i = 0; i < raw.length; i++) {
      appendMediaItemsFromProjectItem(raw[i], out, seen, stats, 0);
    }
    stats.expanded = out.length;
    return { items: out, stats: stats };
  }

  function arrayLength(a) {
    try { return a.length; } catch (e) {}
    return 0;
  }

  function debugPush(arr, msg) {
    if (arr) { arr.push(String(msg)); }
  }

  function ticksToText(ticks, fps) {
    try {
      var f = Math.max(1, Math.round(Number(fps) || 25));
      var totalFrames = Math.round(Number(ticks) / TICKS_PER_SECOND * f);
      var frames = totalFrames % f;
      var totalSeconds = Math.floor(totalFrames / f);
      var seconds = totalSeconds % 60;
      var minutes = Math.floor(totalSeconds / 60) % 60;
      var hours = Math.floor(totalSeconds / 3600);
      function pad(n) { return n < 10 ? '0' + n : String(n); }
      return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds) + ':' + pad(frames);
    } catch (e) {}
    return String(ticks);
  }

  function safeItemPath(item) {
    try { return item && item.getMediaPath ? String(item.getMediaPath() || '') : ''; } catch (e) {}
    return '';
  }

  function safeItemType(item) {
    try { return String(item.type); } catch (e) {}
    return 'unknown';
  }

  function countTrackClips(trackCollection) {
    var counts = [];
    try {
      var n = trackCollection ? trackCollection.numTracks : 0;
      for (var i = 0; i < n; i++) {
        var c = 0;
        try { c = trackCollection[i].clips ? trackCollection[i].clips.numItems : 0; } catch (e) { c = -1; }
        counts.push(c);
      }
    } catch (e2) {}
    return counts;
  }

  function trackCountsText(seq) {
    var v = countTrackClips(seq.videoTracks);
    var a = countTrackClips(seq.audioTracks);
    return 'V[' + v.join(',') + '] A[' + a.join(',') + ']';
  }


  function safeLowerLocal(s) {
    try { return String(s || '').toLowerCase(); } catch (e) {}
    return '';
  }

  function mediaProfile(item) {
    var path = safeLowerLocal(safeItemPath(item) || itemName(item));
    var name = safeLowerLocal(itemName(item));
    var text = path + ' ' + name;
    var audioOnly = /\.(wav|mp3|aif|aiff|m4a|aac|flac|ogg|wma)$/i.test(text);
    var videoFile = /\.(mov|mp4|mxf|avi|m4v|mpg|mpeg|mts|m2ts|webm|wmv|prores)$/i.test(text);
    if (audioOnly) { return { video: false, audio: true, label: 'audio' }; }
    if (videoFile) { return { video: true, audio: true, label: 'video+audio' }; }
    return { video: true, audio: true, label: 'unknown-as-av' };
  }

  function getItemDurationTicks(item, fps) {
    var inTicks = timeObjFromMethod(item, 'getInPoint');
    var outTicks = timeObjFromMethod(item, 'getOutPoint');
    if (inTicks !== null && outTicks !== null && outTicks > inTicks) { return outTicks - inTicks; }
    try {
      if (item && item.duration) {
        var d = (typeof item.duration === 'function') ? item.duration() : item.duration;
        var n = toNumberTicks(d);
        if (n !== null && n > 0) { return n; }
      }
    } catch (e) {}
    return Math.round(TICKS_PER_SECOND * 3600);
  }

  function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
    return (aStart < bEnd) && (bStart < aEnd);
  }

  function pickFreeTrack(reservations, startTicks, endTicks) {
    for (var i = 0; i < reservations.length; i++) {
      var busy = false;
      for (var j = 0; j < reservations[i].length; j++) {
        var r = reservations[i][j];
        if (intervalsOverlap(startTicks, endTicks, r.start, r.end)) { busy = true; break; }
      }
      if (!busy) { return i; }
    }
    reservations.push([]);
    return reservations.length - 1;
  }

  function reserveTrack(reservations, trackIndex, startTicks, endTicks) {
    while (reservations.length <= trackIndex) { reservations.push([]); }
    reservations[trackIndex].push({ start: startTicks, end: endTicks });
  }


  function ensureReservationTracks(reservations, count) {
    while (reservations.length < count) { reservations.push([]); }
  }

  function trackBlockIsFree(reservations, baseIndex, span, startTicks, endTicks) {
    var blockSpan = Math.max(1, Number(span) || 1);
    for (var offset = 0; offset < blockSpan; offset++) {
      var idx = baseIndex + offset;
      var list = reservations[idx] || [];
      for (var j = 0; j < list.length; j++) {
        var r = list[j];
        if (intervalsOverlap(startTicks, endTicks, r.start, r.end)) { return false; }
      }
    }
    return true;
  }

  function pickFreeTrackBlock(reservations, startTicks, endTicks, span, minIndex) {
    var blockSpan = Math.max(1, Number(span) || 1);
    var startAt = Math.max(0, Number(minIndex) || 0);
    for (var base = startAt; base < 256; base++) {
      if (trackBlockIsFree(reservations, base, blockSpan, startTicks, endTicks)) { return base; }
    }
    ensureReservationTracks(reservations, startAt + blockSpan);
    return startAt;
  }

  function reserveTrackBlock(reservations, baseIndex, span, startTicks, endTicks) {
    var blockSpan = Math.max(1, Number(span) || 1);
    ensureReservationTracks(reservations, baseIndex + blockSpan);
    for (var offset = 0; offset < blockSpan; offset++) {
      reservations[baseIndex + offset].push({ start: startTicks, end: endTicks });
    }
  }

  function maxPlannedTracksFromRows(rows, kind) {
    var max = 0;
    for (var i = 0; i < rows.length; i++) {
      if (kind === 'video' && rows[i].vTrack >= 0) { max = Math.max(max, rows[i].vTrack + 1); }
      if (kind === 'audio' && rows[i].aTrack >= 0) { max = Math.max(max, rows[i].aTrack + Math.max(1, Number(rows[i].aSpan) || 1)); }
    }
    return max;
  }

  function collectExistingTrackReservations(trackCollection) {
    var reservations = [];
    try {
      var n = trackCollection ? trackCollection.numTracks : 0;
      ensureReservationTracks(reservations, n);
      for (var t = 0; t < n; t++) {
        var tr = trackCollection[t];
        var c = tr && tr.clips ? tr.clips.numItems : 0;
        for (var i = 0; i < c; i++) {
          var clip = tr.clips[i];
          var st = toNumberTicks(clip && clip.start);
          var en = toNumberTicks(clip && clip.end);
          if (st === null) { st = Number(timeTicksFromAny(clip && clip.start)); }
          if (en === null) { en = Number(timeTicksFromAny(clip && clip.end)); }
          if (!isNaN(st) && !isNaN(en) && en > st) {
            reserveTrack(reservations, t, st, en);
          }
        }
      }
    } catch (e) {}
    return reservations;
  }

  function normalizeAudioChannelCount(n) {
    var v = Number(n);
    if (!isNaN(v) && v >= 1 && v <= 32) { return Math.round(v); }
    return null;
  }

  function parseAudioChannelCountFromText(text) {
    var source = String(text || '');
    if (!source) { return null; }
    var patterns = [
      /<[^>]*(?:AudioChannels|NumAudioChannels|AudioChannelCount|AudioChannelConfiguration|NumberOfAudioChannels|NumChannels|ChannelCount)[^>]*>\s*(\d{1,2})\s*</i,
      /(?:AudioChannels|NumAudioChannels|AudioChannelCount|AudioChannelConfiguration|NumberOfAudioChannels|NumChannels|ChannelCount)[^=]{0,50}=\"(\d{1,2})\"/i,
      /(?:audio\s*channel\s*count|audio\s*channels?|number\s*of\s*audio\s*channels|num\s*audio\s*channels|num\s*channels|channel\s*count)\D{0,80}(\d{1,2})/i,
      /(?:^|[\s;,{])channels?\D{0,40}(\d{1,2})(?:[\s;}\],]|$)/i
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = patterns[i].exec(source);
      if (m && m[1]) {
        var n = normalizeAudioChannelCount(m[1]);
        if (n !== null) { return n; }
      }
    }
    return null;
  }

  function parseAudioChannelCountFromMetadata(item) {
    var text = '';
    try { text += ' ' + String(item && item.getProjectMetadata ? item.getProjectMetadata() : ''); } catch (e0) {}
    try { text += ' ' + String(item && item.getXMPMetadata ? item.getXMPMetadata() : ''); } catch (e1) {}
    return parseAudioChannelCountFromText(text);
  }

  function parseAudioChannelCountFromObject(obj, depth, keyHint) {
    if (obj === undefined || obj === null || depth > 3) { return null; }
    var hint = String(keyHint || '').toLowerCase();
    var hintLooksAudioChannels = /audio/.test(hint) && /channel/.test(hint);
    hintLooksAudioChannels = hintLooksAudioChannels || /numchannels|channelcount|channels/.test(hint);

    if (typeof obj === 'number') {
      return hintLooksAudioChannels ? normalizeAudioChannelCount(obj) : null;
    }
    if (typeof obj === 'string') {
      var parsed = parseAudioChannelCountFromText(obj);
      if (parsed !== null) { return parsed; }
      return hintLooksAudioChannels ? normalizeAudioChannelCount(obj) : null;
    }

    try {
      for (var k in obj) {
        var childHint = String(k || '');
        var directHint = childHint.toLowerCase();
        var looksDirect = (/audio/.test(directHint) && /channel/.test(directHint)) || /numchannels|channelcount|channels/.test(directHint);
        try {
          var v = obj[k];
          if (looksDirect) {
            var direct = parseAudioChannelCountFromObject(v, depth + 1, childHint);
            if (direct !== null) { return direct; }
          }
        } catch (e1) {}
      }
      for (var k2 in obj) {
        try {
          var nested = parseAudioChannelCountFromObject(obj[k2], depth + 1, k2);
          if (nested !== null) { return nested; }
        } catch (e2) {}
      }
    } catch (e) {}
    return null;
  }

  function parseAudioChannelCountFromMethods(item) {
    var methods = [
      'getAudioChannelMapping',
      'getAudioChannelMap',
      'getAudioChannelCount',
      'getAudioChannels',
      'getAudioTrackCount',
      'getAudioTracks'
    ];
    for (var i = 0; i < methods.length; i++) {
      try {
        if (item && item[methods[i]]) {
          var result = item[methods[i]]();
          var n = parseAudioChannelCountFromObject(result, 0, methods[i]);
          if (n !== null) { return n; }
        }
      } catch (e) {}
    }
    try {
      var n1 = parseAudioChannelCountFromObject(item && item.audioChannelMapping, 0, 'audioChannelMapping');
      if (n1 !== null) { return n1; }
    } catch (e2) {}
    try {
      var n2 = parseAudioChannelCountFromObject(item && item.numAudioChannels, 0, 'numAudioChannels');
      if (n2 !== null) { return n2; }
    } catch (e3) {}
    try {
      var n3 = parseAudioChannelCountFromObject(item && item.audioChannels, 0, 'audioChannels');
      if (n3 !== null) { return n3; }
    } catch (e4) {}
    return null;
  }

  function getAudioChannelSpanInfo(item, audioKind) {
    if (audioKind === 'none') { return { span: 0, source: 'none' }; }
    if (audioKind === 'camera') { return { span: 1, source: 'camera-default' }; }

    // v1.12.113: osobne WAV-y rezerwują dokładnie tyle ścieżek, ile Premiere/metadane raportują.
    // Przykład: ZOOM 4ch => A1-A4, drugi ZOOM 4ch => A5-A8. Fallback 8 zostaje tylko, gdy liczby nie da się odczytać.
    var methodCount = parseAudioChannelCountFromMethods(item);
    if (methodCount !== null) { return { span: methodCount, source: 'api/mapping' }; }
    var metaCount = parseAudioChannelCountFromMetadata(item);
    if (metaCount !== null) { return { span: metaCount, source: 'metadata' }; }
    return { span: 8, source: 'fallback-8' };
  }

  function audioBlockLabel(baseIndex, span) {
    var blockSpan = Math.max(1, Number(span) || 1);
    if (blockSpan <= 1) { return 'A' + (baseIndex + 1); }
    return 'A' + (baseIndex + 1) + '-A' + (baseIndex + blockSpan);
  }

  function getTrackCounts(seq) {
    var out = { v: 0, a: 0 };
    try { out.v = seq.videoTracks ? seq.videoTracks.numTracks : 0; } catch (e) {}
    try { out.a = seq.audioTracks ? seq.audioTracks.numTracks : 0; } catch (e2) {}
    return out;
  }

  function tryCallAddTracks(label, fn, dbg) {
    try {
      fn();
      debugPush(dbg, '  próba dodania ścieżek: ' + label + ' => bez błędu');
      return true;
    } catch (e) {
      debugPush(dbg, '  próba dodania ścieżek: ' + label + ' => błąd: ' + e);
      return false;
    }
  }

  function tryAddTracks(seq, videoNeeded, audioNeeded, dbg) {
    var before = getTrackCounts(seq);
    var vMissing = Math.max(0, Number(videoNeeded || 0) - before.v);
    var aMissing = Math.max(0, Number(audioNeeded || 0) - before.a);
    debugPush(dbg, 'Potrzebne ścieżki: video=' + videoNeeded + ', audio=' + audioNeeded + '. Obecnie: video=' + before.v + ', audio=' + before.a + '. Brakuje: V=' + vMissing + ', A=' + aMissing);
    if (vMissing <= 0 && aMissing <= 0) { return true; }

    // v1.12.115: przy dodawaniu ścieżek audio preferujemy QE DOM z pełną sygnaturą 5-argumentową:
    // addTracks(videoCount, videoAfterIndex, audioCount, audioTrackType, audioAfterIndex).
    // Poprzednie warianty 4-argumentowe mogły traktować indeks audio jako audioTrackType,
    // co tworzyło ścieżki z dziwnym routingiem/oznaczeniami w headerze, np. "2" albo strzałka.
    // audioTrackType=1 oznacza Standard, czyli najbliżej ręcznego dodawania zwykłych ścieżek audio w Premiere.
    try {
      app.enableQE();
      var qseq = qe.project.getActiveSequence();
      if (qseq && qseq.addTracks) {
        var qb = getTrackCounts(seq);
        var qVMissing = Math.max(0, Number(videoNeeded || 0) - qb.v);
        var qAMissing = Math.max(0, Number(audioNeeded || 0) - qb.a);
        if (qVMissing > 0 || qAMissing > 0) {
          tryCallAddTracks('qe.addTracks(vMissing, vHave, aMissing, 1, aHave) Standard audio', function () {
            qseq.addTracks(qVMissing, qb.v, qAMissing, 1, qb.a);
          }, dbg);
          var q1 = getTrackCounts(seq);
          if (q1.v >= videoNeeded && q1.a >= audioNeeded) { debugPush(dbg, '  ścieżki dodane przez QE Standard audio: ' + trackCountsText(seq)); return true; }
        }

        // Jeżeli konkretny build Premiere ignoruje dodawanie hurtem, dokładamy pojedynczo, nadal jako Standard.
        var guard = 0;
        while (getTrackCounts(seq).a < audioNeeded && guard < 64) {
          var c = getTrackCounts(seq);
          tryCallAddTracks('qe.addTracks(0, c.v, 1, 1, c.a) audio Standard pojedynczo', function () {
            qseq.addTracks(0, c.v, 1, 1, c.a);
          }, dbg);
          guard++;
          var afterOne = getTrackCounts(seq);
          if (afterOne.a <= c.a) {
            tryCallAddTracks('qe.addTracks(0, 0, 1, 1, c.a) audio Standard pojedynczo alt', function () {
              qseq.addTracks(0, 0, 1, 1, c.a);
            }, dbg);
          }
          var now = getTrackCounts(seq);
          if (now.a <= c.a && afterOne.a <= c.a) { break; }
        }

        guard = 0;
        while (getTrackCounts(seq).v < videoNeeded && guard < 64) {
          var cv = getTrackCounts(seq);
          tryCallAddTracks('qe.addTracks(1, cv.v, 0, 1, cv.a) video pojedynczo', function () {
            qseq.addTracks(1, cv.v, 0, 1, cv.a);
          }, dbg);
          guard++;
          if (getTrackCounts(seq).v <= cv.v) { break; }
        }

        var qFinal = getTrackCounts(seq);
        if (qFinal.v >= videoNeeded && qFinal.a >= audioNeeded) { debugPush(dbg, '  ścieżki dodane przez QE po retry: ' + trackCountsText(seq)); return true; }
      } else {
        debugPush(dbg, '  QE active sequence albo qseq.addTracks niedostępne');
      }
    } catch (qeErr) {
      debugPush(dbg, '  błąd QE DOM przy dodawaniu ścieżek Standard: ' + qeErr);
    }

    // Fallback: standardowe API Premiere bywa różne między wersjami. Używamy go dopiero po QE,
    // żeby nie tworzyć niechcianych typów/routingów ścieżek audio.
    if (seq.addTracks) {
      tryCallAddTracks('seq.addTracks(vMissing, 0, aMissing, 0) fallback', function () { seq.addTracks(vMissing, 0, aMissing, 0); }, dbg);
      var mid1 = getTrackCounts(seq);
      if (mid1.v >= videoNeeded && mid1.a >= audioNeeded) { debugPush(dbg, '  ścieżki dodane przez seq.addTracks fallback 1: ' + trackCountsText(seq)); return true; }

      tryCallAddTracks('seq.addTracks(vMissing, aMissing) fallback', function () { seq.addTracks(vMissing, aMissing); }, dbg);
      var mid2 = getTrackCounts(seq);
      if (mid2.v >= videoNeeded && mid2.a >= audioNeeded) { debugPush(dbg, '  ścieżki dodane przez seq.addTracks fallback 2: ' + trackCountsText(seq)); return true; }

      if (vMissing > 0) { tryCallAddTracks('seq.addTracks(vMissing) fallback', function () { seq.addTracks(vMissing); }, dbg); }
      if (aMissing > 0) { tryCallAddTracks('seq.addTracks(0, 0, aMissing) fallback', function () { seq.addTracks(0, 0, aMissing); }, dbg); }
      var mid3 = getTrackCounts(seq);
      if (mid3.v >= videoNeeded && mid3.a >= audioNeeded) { debugPush(dbg, '  ścieżki dodane przez seq.addTracks fallback 3: ' + trackCountsText(seq)); return true; }
    } else {
      debugPush(dbg, '  seq.addTracks niedostępne w tej wersji API');
    }

    var after = getTrackCounts(seq);
    debugPush(dbg, 'UWAGA: po próbach dodania nadal jest V=' + after.v + ', A=' + after.a + ', a potrzeba V=' + videoNeeded + ', A=' + audioNeeded + '.');
    debugPush(dbg, 'Jeżeli audio z kamer ma iść od A' + (audioNeeded - Math.max(0, audioNeeded - after.a) + 1) + ' w dół, dodaj ręcznie brakujące ścieżki audio przed synchronizacją albo sprawdź, czy Premiere pozwala CEP/QE dodawać ścieżki.');
    return (after.v >= videoNeeded && after.a >= audioNeeded);
  }

  function selectedArrayToNames(selected) {
    var out = [];
    var len = arrayLength(selected);
    for (var i = 0; i < len; i++) {
      out.push(itemName(selected[i]));
    }
    return out.join(' | ');
  }

  function timeTicksFromAny(v) {
    try {
      if (v === undefined || v === null) { return ''; }
      if (v.ticks !== undefined) { return String(v.ticks); }
      if (typeof v === 'number') { return String(v); }
      if (typeof v === 'string') { return v; }
    } catch (e) {}
    return '';
  }

  function clipSignature(clip) {
    try {
      var nm = '';
      try { nm = String(clip.name || ''); } catch (e0) {}
      var st = '';
      var en = '';
      try { st = timeTicksFromAny(clip.start); } catch (e1) {}
      try { en = timeTicksFromAny(clip.end); } catch (e2) {}
      return nm + '|' + st + '|' + en;
    } catch (e) {}
    return 'unknown';
  }

  function collectVideoClipSignatures(seq) {
    var sigs = {};
    try {
      var n = seq.videoTracks ? seq.videoTracks.numTracks : 0;
      for (var t = 0; t < n; t++) {
        var tr = seq.videoTracks[t];
        var c = tr && tr.clips ? tr.clips.numItems : 0;
        for (var i = 0; i < c; i++) {
          var clip = tr.clips[i];
          sigs[t + '::' + clipSignature(clip)] = true;
        }
      }
    } catch (e) {}
    return sigs;
  }

  function removeVideoClipsAddedAfterAudioInsert(seq, beforeSigs, dbg) {
    var removed = 0;
    try {
      var n = seq.videoTracks ? seq.videoTracks.numTracks : 0;
      for (var t = 0; t < n; t++) {
        var tr = seq.videoTracks[t];
        if (!tr || !tr.clips) { continue; }
        for (var i = tr.clips.numItems - 1; i >= 0; i--) {
          var clip = tr.clips[i];
          var sig = t + '::' + clipSignature(clip);
          if (!beforeSigs || !beforeSigs[sig]) {
            var nm = '';
            try { nm = String(clip.name || ''); } catch (eName) {}
            try {
              if (clip.remove) {
                clip.remove(0, 0);
              } else {
                clip.remove(false, false);
              }
              removed++;
              debugPush(dbg, '  Audio-only cleanup: usunięto niechciany klip video z V' + (t + 1) + (nm ? ' (' + nm + ')' : ''));
            } catch (eRemove) {
              debugPush(dbg, '  Audio-only cleanup: nie udało się usunąć klipu video z V' + (t + 1) + ': ' + eRemove);
            }
          }
        }
      }
    } catch (e) {
      debugPush(dbg, '  Audio-only cleanup: błąd skanowania video: ' + e);
    }
    if (removed === 0) { debugPush(dbg, '  Audio-only cleanup: brak nowych klipów video do usunięcia'); }
    return removed;
  }

  function insertWithMode(seq, item, ticks, insertType, vTrackIndex, aTrackIndex, dbg) {
    var t = makeTime(ticks);
    var type = String(insertType || 'Both');
    var vIndex = (vTrackIndex === undefined || vTrackIndex === null) ? -1 : Number(vTrackIndex);
    var aIndex = (aTrackIndex === undefined || aTrackIndex === null) ? -1 : Number(aTrackIndex);
    var ok = false;
    var audioOnlyVideoSnapshot = null;
    if (type === 'Audio') {
      audioOnlyVideoSnapshot = collectVideoClipSignatures(seq);
    }

    debugPush(dbg, 'INSERT start: "' + itemName(item) + '" typ=' + type + ' ticks=' + ticks + ' routing V=' + (vIndex >= 0 ? (vIndex + 1) : '-') + ' A=' + (aIndex >= 0 ? (aIndex + 1) : '-'));

    try {
      if (seq.overwriteClip) {
        if (type === 'Both') {
          debugPush(dbg, '  próba: seq.overwriteClip(item, time, ' + vIndex + ', ' + aIndex + ')');
          ok = seq.overwriteClip(item, t, vIndex, aIndex) || ok;
        } else if (type === 'Video') {
          debugPush(dbg, '  próba: seq.overwriteClip(item, time, ' + vIndex + ', -1)');
          ok = seq.overwriteClip(item, t, vIndex, -1) || ok;
        } else if (type === 'Audio') {
          debugPush(dbg, '  próba: seq.overwriteClip(item, time, -1, ' + aIndex + ')');
          ok = seq.overwriteClip(item, t, -1, aIndex) || ok;
        }
        debugPush(dbg, '  wynik seq.overwriteClip: ' + ok);
      }
    } catch (e) { debugPush(dbg, '  błąd seq.overwriteClip z routingiem: ' + e); }

    if (!ok) {
      try {
        var audioTrackExists = !(type === 'Both' && aIndex >= 0) || (seq.audioTracks && seq.audioTracks.numTracks > aIndex);
        if ((type === 'Both' || type === 'Video') && vIndex >= 0 && seq.videoTracks && seq.videoTracks.numTracks > vIndex) {
          if (type === 'Both' && !audioTrackExists) {
            debugPush(dbg, '  fallback videoTracks pominięty: docelowa ścieżka audio A' + (aIndex + 1) + ' nie istnieje, więc Premiere wrzuciłoby audio na górę i nadpisało ZOOM');
          } else {
            debugPush(dbg, '  fallback: videoTracks[' + vIndex + '].overwriteClip');
            seq.videoTracks[vIndex].overwriteClip(item, t);
            ok = true;
          }
        }
      } catch (e2) { debugPush(dbg, '  błąd fallback videoTracks: ' + e2); }
      try {
        if ((type === 'Both' || type === 'Audio') && aIndex >= 0 && seq.audioTracks && seq.audioTracks.numTracks > aIndex) {
          debugPush(dbg, '  fallback: audioTracks[' + aIndex + '].overwriteClip');
          seq.audioTracks[aIndex].overwriteClip(item, t);
          ok = true;
        }
      } catch (e3) { debugPush(dbg, '  błąd fallback audioTracks: ' + e3); }
    }

    if (ok && type === 'Audio') {
      removeVideoClipsAddedAfterAudioInsert(seq, audioOnlyVideoSnapshot, dbg);
    }

    return ok;
  }

  function itemName(item) {
    try { return String(item.name || 'bez nazwy'); } catch (e) {}
    return 'bez nazwy';
  }

  function syncSelectedByTimecodeCore(mode, offsetText, insertType, verboseDebug) {
    var dbg = verboseDebug ? [] : null;
    debugPush(dbg, '=== DIAGNOSTYKA TIMECODE SYNC v1.12.115 ===');
    debugPush(dbg, 'mode=' + mode + ', offset=' + offsetText + ', insertType=' + insertType);

    if (!app || !app.project) { return 'Nie widzę otwartego projektu Premiere.'; }
    var seq = app.project.activeSequence;
    if (!seq) { return 'Najpierw otwórz / aktywuj sekwencję, do której mam ułożyć pliki.'; }

    var rawSelected = getSelection();
    var rawLen = arrayLength(rawSelected);
    var expandedSelection = expandSelectionToMediaItems(rawSelected);
    var selected = expandedSelection.items;
    var len = selected.length;
    debugPush(dbg, 'Aktywna sekwencja: ' + (seq.name || 'bez nazwy'));
    debugPush(dbg, 'Ścieżki przed insertem: ' + trackCountsText(seq));
    debugPush(dbg, 'Liczba zaznaczonych ProjectItemów wg app.getCurrentProjectViewSelection(): ' + rawLen);
    debugPush(dbg, 'Zaznaczone nazwy RAW: ' + selectedArrayToNames(rawSelected));
    debugPush(dbg, 'Rozwinięcie binów: selected=' + expandedSelection.stats.selected + ', bins=' + expandedSelection.stats.bins + ', mediaItems=' + expandedSelection.stats.expanded + ', duplicates=' + expandedSelection.stats.duplicates);
    debugPush(dbg, 'Nazwy po rozwinięciu binów: ' + selectedArrayToNames(selected));

    if (!rawSelected || rawLen === 0) { return 'Zaznacz w oknie projektu pliki audio/wideo albo biny z plikami do synchronizacji po Timecode.'; }
    if (!selected || len === 0) { return 'Zaznaczone biny nie zawierają plików audio/wideo do synchronizacji po Timecode.'; }

    var fps = getSequenceFrameRate(seq);
    var offsetTicks = parseTimecodeToTicks(offsetText || '00:00:00:00', fps);
    var zeroTicks = getSeqZeroTicks(seq, fps);
    debugPush(dbg, 'FPS sekwencji wg skryptu: ' + fps);
    debugPush(dbg, 'Offset ticks: ' + offsetTicks + ' (' + ticksToText(offsetTicks, fps) + ')');
    debugPush(dbg, 'Zero / start timecode sekwencji ticks: ' + zeroTicks + ' (' + ticksToText(zeroTicks, fps) + ')');

    var rows = [];
    var skipped = [];
    var skippedByInsertType = [];
    var minTicks = null;

    for (var i = 0; i < len; i++) {
      var item = selected[i];
      if (!item) { debugPush(dbg, '[' + (i + 1) + '] pusty item'); continue; }
      var rawTicks = getItemSyncTicks(item, mode, fps);
      debugPush(dbg, '[' + (i + 1) + '] item="' + itemName(item) + '" type=' + safeItemType(item) + ' path="' + safeItemPath(item) + '" rawTicks=' + rawTicks + (rawTicks !== null ? ' (' + ticksToText(rawTicks, fps) + ')' : ''));
      if (rawTicks === null || isNaN(rawTicks)) {
        skipped.push(itemName(item));
        continue;
      }
      if (minTicks === null || rawTicks < minTicks) { minTicks = rawTicks; }
      var profile = mediaProfile(item);
      var normalizedInsertType = String(insertType || 'Both');

      // v1.12.123: filtrujemy itemy już na starcie według trybu synchronizacji.
      // Video: pomijamy WAV/audio-only, ale zostawiamy audio z kamer dla plików video+audio.
      // Audio: pomijamy pliki video/video+audio, zamiast wstawiać je i potem usuwać video z timeline.
      if (normalizedInsertType === 'Video' && !profile.video) {
        skippedByInsertType.push(itemName(item) + ' (audio-only)');
        debugPush(dbg, '    pominięto przez tryb Video: profil=' + profile.label + ', WAV/audio-only nie będzie wstawiany; audio z kamer video+audio zostaje');
        continue;
      }
      if (normalizedInsertType === 'Audio' && profile.video) {
        skippedByInsertType.push(itemName(item) + ' (video/video+audio)');
        debugPush(dbg, '    pominięto przez tryb Audio: profil=' + profile.label + ', item video nie będzie wstawiany ani czyszczony po fakcie');
        continue;
      }
      if (normalizedInsertType === 'Audio' && !profile.audio) {
        skippedByInsertType.push(itemName(item) + ' (brak audio)');
        debugPush(dbg, '    pominięto przez tryb Audio: profil=' + profile.label + ', brak audio');
        continue;
      }

      var durationTicks = getItemDurationTicks(item, fps);
      debugPush(dbg, '    profil=' + profile.label + ', duration=' + durationTicks + ' (' + ticksToText(durationTicks, fps) + ')');
      rows.push({ item: item, rawTicks: rawTicks, name: itemName(item), profile: profile, durationTicks: durationTicks });
    }

    debugPush(dbg, 'Poprawnie odczytane itemy z timecode: ' + rows.length + ' / ' + len);
    if (minTicks !== null) { debugPush(dbg, 'Najwcześniejszy rawTicks: ' + minTicks + ' (' + ticksToText(minTicks, fps) + ')'); }

    if (rows.length === 0) {
      var noRows = 'Nie udało się odczytać timecode / punktu synchronizacji z zaznaczonych plików.';
      if (skippedByInsertType.length) {
        noRows += ' Po filtrze trybu ' + String(insertType || 'Both') + ' nie zostały żadne pasujące pliki.';
      }
      if (verboseDebug) { noRows += '\n\n' + dbg.join('\n'); }
      return noRows;
    }

    for (var prep = 0; prep < rows.length; prep++) {
      var targetTicks;
      if (mode === 'sequenceTc' || mode === 'itemTC') {
        targetTicks = rows[prep].rawTicks - zeroTicks + offsetTicks;
      } else {
        targetTicks = rows[prep].rawTicks - minTicks + offsetTicks;
      }
      if (targetTicks < 0) { targetTicks = 0; }
      rows[prep].targetTicks = targetTicks;
      rows[prep].endTicks = targetTicks + Math.max(1, rows[prep].durationTicks || Math.round(TICKS_PER_SECOND / fps));
    }

    rows.sort(function (a, b) {
      if (a.targetTicks !== b.targetTicks) { return a.targetTicks - b.targetTicks; }
      return String(a.name).localeCompare(String(b.name));
    });

    // v1.12.123: routing audio bez kolizji + bin selection + filtr Video/Audio przed wstawianiem.
    // Tryb Video pomija WAV/audio-only, ale zachowuje oryginalne audio z kamer video+audio.
    // Jeden wielokanałowy WAV z ZOOM-a może fizycznie zająć A1-A8, mimo że API dostaje tylko start A1.
    // Dlatego każdy audio-only item rezerwuje cały blok kanałów, a kolejny nakładający się ZOOM idzie od następnego wolnego bloku, np. A9-A16.
    var vReservations = collectExistingTrackReservations(seq.videoTracks);
    var audioReservations = collectExistingTrackReservations(seq.audioTracks);
    debugPush(dbg, 'Routing audio v1.12.123: filtr trybu insertType + camera audio w trybie Video + blokowe rezerwacje audio-only + wykrywanie kanałów WAV + bin selection expand. Istniejące zajętości: videoTracks=' + vReservations.length + ', audioTracks=' + audioReservations.length + '.');

    for (var plan = 0; plan < rows.length; plan++) {
      var p = rows[plan].profile || mediaProfile(rows[plan].item);
      rows[plan].wantVideo = (insertType === 'Video' || insertType === 'Both') && p.video;
      // Tryb Video ma oznaczać: video + oryginalny dźwięk z kamer, ale bez osobnych WAV/ZOOM.
      // Dlatego dla plików video+audio planujemy również camera audio; audio-only zostało już odfiltrowane wyżej.
      rows[plan].wantAudio = ((insertType === 'Audio' || insertType === 'Both') && p.audio) || (insertType === 'Video' && p.video && p.audio);
      rows[plan].insertMode = (insertType === 'Video' && p.video && p.audio) ? 'Both' : insertType;
      rows[plan].vTrack = -1;
      rows[plan].aTrack = -1;
      rows[plan].audioKind = (p.audio && !p.video) ? 'external' : (p.audio ? 'camera' : 'none');
      rows[plan].aSpanSource = 'none';
      if (rows[plan].wantAudio) {
        var spanInfo = getAudioChannelSpanInfo(rows[plan].item, rows[plan].audioKind);
        rows[plan].aSpan = spanInfo.span;
        rows[plan].aSpanSource = spanInfo.source;
      } else {
        rows[plan].aSpan = 0;
      }

      if (rows[plan].wantVideo) {
        rows[plan].vTrack = pickFreeTrack(vReservations, rows[plan].targetTicks, rows[plan].endTicks);
        reserveTrack(vReservations, rows[plan].vTrack, rows[plan].targetTicks, rows[plan].endTicks);
      }
    }

    // Najpierw planujemy wszystkie osobne audio, bo one mają pierwszeństwo na górze timeline'u.
    var externalAudioTop = 0;
    for (var extPlan = 0; extPlan < rows.length; extPlan++) {
      if (!rows[extPlan].wantAudio || rows[extPlan].audioKind !== 'external') { continue; }
      var extSpan = Math.max(1, Number(rows[extPlan].aSpan) || 8);
      var extBase = pickFreeTrackBlock(audioReservations, rows[extPlan].targetTicks, rows[extPlan].endTicks, extSpan, 0);
      reserveTrackBlock(audioReservations, extBase, extSpan, rows[extPlan].targetTicks, rows[extPlan].endTicks);
      rows[extPlan].aTrack = extBase;
      externalAudioTop = Math.max(externalAudioTop, extBase + extSpan);
      debugPush(dbg, 'AUDIO BLOCK external: "' + rows[extPlan].name + '" => ' + audioBlockLabel(extBase, extSpan) + ' span=' + extSpan + ' source=' + rows[extPlan].aSpanSource);
    }

    // Audio z kamer zawsze pod blokiem zewnętrznego audio, np. po dwóch ZOOM-ach 8ch od A17 w dół.
    for (var camPlan = 0; camPlan < rows.length; camPlan++) {
      if (!rows[camPlan].wantAudio || rows[camPlan].audioKind !== 'camera') { continue; }
      var camSpan = Math.max(1, Number(rows[camPlan].aSpan) || 1);
      var camBase = pickFreeTrackBlock(audioReservations, rows[camPlan].targetTicks, rows[camPlan].endTicks, camSpan, externalAudioTop);
      reserveTrackBlock(audioReservations, camBase, camSpan, rows[camPlan].targetTicks, rows[camPlan].endTicks);
      rows[camPlan].aTrack = camBase;
    }

    for (var logPlan = 0; logPlan < rows.length; logPlan++) {
      var lp = rows[logPlan].profile || mediaProfile(rows[logPlan].item);
      debugPush(dbg, 'PLAN: "' + rows[logPlan].name + '" ' + ticksToText(rows[logPlan].targetTicks, fps) + '-' + ticksToText(rows[logPlan].endTicks, fps) + ' profil=' + (lp.label || '?') + ' audioKind=' + rows[logPlan].audioKind + ' => ' + (rows[logPlan].wantVideo ? ('V' + (rows[logPlan].vTrack + 1)) : 'V-') + ' / ' + (rows[logPlan].wantAudio ? (audioBlockLabel(rows[logPlan].aTrack, rows[logPlan].aSpan) + ' channels=' + rows[logPlan].aSpan + ' source=' + rows[logPlan].aSpanSource) : 'A-'));
    }

    var audioNeeded = Math.max(getTrackCounts(seq).a, maxPlannedTracksFromRows(rows, 'audio'));
    var videoNeeded = Math.max(getTrackCounts(seq).v, maxPlannedTracksFromRows(rows, 'video'));
    tryAddTracks(seq, videoNeeded, audioNeeded, dbg);

    // Ważne: najpierw wstawiamy osobne audio, potem pliki video+audio.
    // Dzięki temu wielokanałowy WAV nie nadpisuje później audio z kamer na dolnych ścieżkach.
    rows.sort(function (a, b) {
      var aExt = (a.audioKind === 'external') ? 0 : 1;
      var bExt = (b.audioKind === 'external') ? 0 : 1;
      if (aExt !== bExt) { return aExt - bExt; }
      if (a.targetTicks !== b.targetTicks) { return a.targetTicks - b.targetTicks; }
      return String(a.name).localeCompare(String(b.name));
    });

    var inserted = 0;
    var failed = [];
    var usedV = [];
    var usedA = [];
    for (var r = 0; r < rows.length; r++) {
      debugPush(dbg, '--- próba wstawienia #' + (r + 1) + ' z ' + rows.length + ': "' + rows[r].name + '" targetTicks=' + rows[r].targetTicks + ' (' + ticksToText(rows[r].targetTicks, fps) + ')');
      debugPush(dbg, 'Ścieżki przed tym itemem: ' + trackCountsText(seq));
      var rowInsertMode = rows[r].insertMode || insertType;
      if (insertWithMode(seq, rows[r].item, rows[r].targetTicks, rowInsertMode, rows[r].vTrack, rows[r].aTrack, dbg)) {
        inserted++;
        if (rows[r].vTrack >= 0) { usedV.push('V' + (rows[r].vTrack + 1)); }
        if (rows[r].aTrack >= 0) { usedA.push(audioBlockLabel(rows[r].aTrack, rows[r].aSpan)); }
        debugPush(dbg, 'STATUS itemu: OK');
      } else {
        failed.push(rows[r].name);
        debugPush(dbg, 'STATUS itemu: FAILED');
      }
      debugPush(dbg, 'Ścieżki po tym itemie: ' + trackCountsText(seq));
    }

    var msg = 'Synchronizacja po Timecode zakończona. Wstawiono: ' + inserted + ' / ' + rows.length + '. Tryb: ' + mode + ', typ: ' + insertType + '.';
    function uniq(arr) { var seen = {}; var out = []; for (var i = 0; i < arr.length; i++) { if (!seen[arr[i]]) { seen[arr[i]] = true; out.push(arr[i]); } } return out; }
    if (usedV.length) { msg += '\nZaplanowane ścieżki video: ' + uniq(usedV).join(', '); }
    if (usedA.length) { msg += '\nZaplanowane ścieżki audio: ' + uniq(usedA).join(', '); }
    if (skippedByInsertType.length) { msg += '\nPominięto przez tryb ' + String(insertType || 'Both') + ': ' + skippedByInsertType.slice(0, 6).join(', '); }
    if (skippedByInsertType.length > 6) { msg += ' ...+' + (skippedByInsertType.length - 6); }
    if (skipped.length) { msg += '\nPominięto bez czytelnego timecode: ' + skipped.slice(0, 6).join(', '); }
    if (skipped.length > 6) { msg += ' ...+' + (skipped.length - 6); }
    if (failed.length) { msg += '\nNie udało się wstawić: ' + failed.slice(0, 6).join(', '); }
    if (failed.length > 6) { msg += ' ...+' + (failed.length - 6); }

    if (verboseDebug) {
      debugPush(dbg, 'Ścieżki finalnie: ' + trackCountsText(seq));
      msg += '\n\n' + dbg.join('\n');
    }
    return msg;
  }

  AEDRNO.syncSelectedByTimecode = function (mode, offsetText, insertType) {
    return syncSelectedByTimecodeCore(mode, offsetText, insertType, false);
  };


}());
