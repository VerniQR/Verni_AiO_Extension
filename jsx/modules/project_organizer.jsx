(function () {
  var BIN_TYPE = 2; // ProjectItemType.BIN is 2 in Premiere ExtendScript.
  var ORGANIZER_ROOT_BIN_NAME = 'VerniAiO';

  function safeLower(s) {
    try { return String(s || '').toLowerCase(); } catch (e) { return ''; }
  }

  function splitKeywords(csv) {
    var out = [];
    var parts = String(csv || '').split(',');
    for (var i = 0; i < parts.length; i++) {
      var k = parts[i].replace(/^\s+|\s+$/g, '');
      if (k.length) { out.push(k.toLowerCase()); }
    }
    return out;
  }

  function getMediaPath(item) {
    try {
      if (item && item.getMediaPath) { return item.getMediaPath() || ''; }
    } catch (e) {}
    return '';
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
      if (report) { report.createdBins.push(name); }
      return bin;
    } catch (e) {
      return null;
    }
  }

  function ensureChildBin(parentBin, name, report) {
    var bin = null;
    if (!parentBin || !name) { return null; }
    bin = findChildBin(parentBin, name);
    if (bin) { return bin; }

    try {
      var rootBin = findChildBin(app.project.rootItem, name);
      if (rootBin && !sameItem(rootBin, parentBin)) {
        if (moveItem(rootBin, parentBin)) {
          if (report) {
            report.movedBins = report.movedBins || [];
            report.movedBins.push(name + ' -> ' + ORGANIZER_ROOT_BIN_NAME);
          }
          return rootBin;
        }
      }
    } catch (moveOldBinErr) {}

    try {
      bin = parentBin.createBin(name);
      if (report) { report.createdBins.push(ORGANIZER_ROOT_BIN_NAME + '/' + name); }
      return bin;
    } catch (e) {
      return null;
    }
  }

  function ensureOrganizerBin(report) {
    return ensureRootBin(ORGANIZER_ROOT_BIN_NAME, report);
  }

  function itemKey(item) {
    try {
      if (item && item.nodeId !== undefined && item.nodeId !== null) {
        return 'node:' + String(item.nodeId);
      }
    } catch (e1) {}

    try {
      if (item && app && app.project && app.project.sequences) {
        for (var i = 0; i < app.project.sequences.numSequences; i++) {
          var seq = app.project.sequences[i];
          if (seq && seq.projectItem && seq.projectItem === item) {
            if (seq.sequenceID !== undefined && seq.sequenceID !== null) {
              return 'seqid:' + String(seq.sequenceID);
            }
            return 'seq:' + String(i) + ':' + String(seq.name || item.name || '');
          }
        }
      }
    } catch (e2) {}

    try {
      if (item) {
        return 'name:' + String(item.name || '') + '|media:' + String(getMediaPath(item) || '');
      }
    } catch (e3) {}

    return '';
  }

  function markItemLocation(item, locationMap, insideAeBin, insideNestBin, insideExternalBin) {
    if (!locationMap) { return; }
    var key = itemKey(item);
    if (!key) { return; }

    var current = locationMap[key] || { insideAeBin: false, insideNestBin: false, insideExternalBin: false };
    current.insideAeBin = current.insideAeBin || !!insideAeBin;
    current.insideNestBin = current.insideNestBin || !!insideNestBin;
    current.insideExternalBin = current.insideExternalBin || !!insideExternalBin;
    locationMap[key] = current;
  }

  function markItemInsideTarget(item, targetBinName, aeBinName, nestBinName, externalBinName, locationMap) {
    if (!locationMap) { return; }
    var key = itemKey(item);
    if (!key) { return; }

    var current = locationMap[key] || { insideAeBin: false, insideNestBin: false, insideExternalBin: false };
    if (targetBinName === aeBinName) { current.insideAeBin = true; }
    if (targetBinName === nestBinName) { current.insideNestBin = true; }
    if (targetBinName === externalBinName) { current.insideExternalBin = true; }
    locationMap[key] = current;
  }

  function collectItems(parent, arr, locationMap, aeBinName, nestBinName, externalBinName, insideAeBin, insideNestBin, insideExternalBin) {
    if (!parent || !parent.children) { return; }

    for (var i = 0; i < parent.children.numItems; i++) {
      var child = parent.children[i];
      var childInsideAe = insideAeBin;
      var childInsideNest = insideNestBin;
      var childInsideExternal = insideExternalBin;

      if (isBin(child)) {
        if (child.name === aeBinName) { childInsideAe = true; }
        if (child.name === nestBinName) { childInsideNest = true; }
        if (child.name === externalBinName) { childInsideExternal = true; }
        collectItems(child, arr, locationMap, aeBinName, nestBinName, externalBinName, childInsideAe, childInsideNest, childInsideExternal);
      } else {
        arr.push(child);
        markItemLocation(child, locationMap, childInsideAe, childInsideNest, childInsideExternal);
      }
    }
  }

  function itemIsInsideTargetByMap(item, binName, locationMap, aeBinName, nestBinName, externalBinName) {
    try {
      if (!locationMap) { return false; }
      var key = itemKey(item);
      var location = key ? locationMap[key] : null;
      if (!location) { return false; }
      if (binName === aeBinName && location.insideAeBin) { return true; }
      if (binName === nestBinName && location.insideNestBin) { return true; }
      if (binName === externalBinName && location.insideExternalBin) { return true; }
    } catch (e) {}
    return false;
  }

  function collectExternalBinCandidates(parent, arr, externalBinName, aeBinName, nestBinName, externalKeywords, insideExternal, seenMap) {
    if (!parent || !parent.children) { return; }
    if (!seenMap) { seenMap = {}; }

    for (var i = 0; i < parent.children.numItems; i++) {
      var child = parent.children[i];
      if (!isBin(child)) { continue; }

      var childName = String(child.name || '');
      var childInsideExternal = insideExternal || (childName === externalBinName);

      // Nigdy nie przenosimy binow systemowych/tworzonych przez ten organizer ani binow juz bedacych w External Extension.
      if (!childInsideExternal && childName !== aeBinName && childName !== nestBinName && childName !== externalBinName) {
        if (looksLikeExternalExtension(child, externalKeywords)) {
          var key = itemKey(child) || ('binname:' + childName);
          if (!seenMap[key]) {
            seenMap[key] = true;
            arr.push(child);
          }
          // Nie schodzimy glebiej w ten bin jako osobny kandydat - przeniesienie calego binu zabierze jego zawartosc.
          continue;
        }
      }

      collectExternalBinCandidates(child, arr, externalBinName, aeBinName, nestBinName, externalKeywords, childInsideExternal, seenMap);
    }
  }

  function hasAny(text, keywords) {
    var t = safeLower(text);
    for (var i = 0; i < keywords.length; i++) {
      if (t.indexOf(keywords[i]) !== -1) { return true; }
    }
    return false;
  }

  function extensionLooksLikeVideo(pathOrName) {
    var t = safeLower(pathOrName);
    return /\.(mov|mp4|mxf|avi|m4v|mpg|mpeg|prores|webm)$/i.test(t);
  }

  function looksLikeDynamicLink(item) {
    var name = item ? item.name : '';
    var path = getMediaPath(item);
    var n = safeLower(name);
    var p = safeLower(path);

    if (p.indexOf('.aep') !== -1) { return true; }
    if (n.indexOf('after effects') !== -1) { return true; }
    if (n.indexOf('dynamic link') !== -1) { return true; }
    if (n.indexOf('dynamic relink') !== -1) { return true; }
    return false;
  }

  function looksLikeRenderAndReplace(item, keywords, moveVideoNearAE) {
    var name = item ? item.name : '';
    var path = getMediaPath(item);
    var joined = name + ' ' + path;

    if (hasAny(joined, keywords)) { return true; }

    if (moveVideoNearAE && extensionLooksLikeVideo(path || name)) {
      var l = safeLower(joined);
      if (l.indexOf('ae') !== -1 && (l.indexOf('render') !== -1 || l.indexOf('dynamic') !== -1)) {
        return true;
      }
    }
    return false;
  }

  function looksLikeExternalExtension(item, externalKeywords) {
    var name = item ? item.name : '';
    var path = getMediaPath(item);
    var joined = name + ' ' + path;
    return hasAny(joined, externalKeywords);
  }

  function alreadyInsideParentBin(item, binName) {
    try {
      var parent = item ? item.parent : null;
      while (parent) {
        if (parent.name === binName) { return true; }
        parent = parent.parent;
      }
    } catch (e) {}
    return false;
  }

  function isProjectSequenceItem(item) {
    try {
      // Most sequence project items expose no normal media path. Cross-check with app.project.sequences by projectItem.
      if (!item || getMediaPath(item)) { return false; }
      if (!app.project.sequences) { return false; }
      for (var i = 0; i < app.project.sequences.numSequences; i++) {
        var seq = app.project.sequences[i];
        if (seq && seq.projectItem && seq.projectItem === item) { return true; }
      }
    } catch (e) {}
    return false;
  }


  function looksLikeNestSequence(item, nestKeywords) {
    var name = item ? item.name : '';
    var n = safeLower(name);

    // Default Premiere nest names are usually variants of "Nested Sequence".
    if (n.indexOf('nested sequence') !== -1) { return true; }
    if (n.indexOf('nested') !== -1) { return true; }
    if (n.indexOf('nest') !== -1) { return true; }

    // Custom user naming support.
    if (hasAny(name, nestKeywords)) { return true; }

    return false;
  }

  function alreadyInsideBin(item, binName, locationMap, aeBinName, nestBinName, externalBinName) {
    try {
      if (locationMap) {
        var key = itemKey(item);
        var location = key ? locationMap[key] : null;
        if (location) {
          if (binName === aeBinName && location.insideAeBin) { return true; }
          if (binName === nestBinName && location.insideNestBin) { return true; }
          if (binName === externalBinName && location.insideExternalBin) { return true; }
        }
      }
    } catch (e1) {}

    try {
      var parent = item.parent;
      while (parent) {
        if (parent.name === binName) { return true; }
        parent = parent.parent;
      }
    } catch (e2) {}
    return false;
  }

  function sameItem(a, b) {
    try { if (a && b && a === b) { return true; } } catch (e1) {}
    try {
      var ak = itemKey(a);
      var bk = itemKey(b);
      if (ak && bk && ak === bk) { return true; }
    } catch (e2) {}
    return false;
  }

  function isDirectChildOf(item, targetBin) {
    try {
      if (!item || !targetBin || !targetBin.children) { return false; }
      for (var i = 0; i < targetBin.children.numItems; i++) {
        if (sameItem(targetBin.children[i], item)) { return true; }
      }
    } catch (e) {}
    return false;
  }

  function moveItem(item, targetBin) {
    try {
      if (!item || !targetBin) { return false; }
      // Najwazniejsze: nie wolamy moveBin, jezeli element juz jest w docelowym BIN-ie.
      // Samo moveBin na tym samym miejscu potrafi dopisywac Premiere akcje "Move Project Items" do historii.
      if (isDirectChildOf(item, targetBin)) { return false; }
      item.moveBin(targetBin);
      return true;
    } catch (e) {
      return false;
    }
  }

  function processNestCandidate(it, nestBin, nestBinName, nestKeywords, counters, locationMap, aeBinName, externalBinName) {
    if (!it) { return; }

    var keywordNestMatch = looksLikeNestSequence(it, nestKeywords);

    if (!alreadyInsideBin(it, nestBinName, locationMap, aeBinName, nestBinName, externalBinName) && keywordNestMatch) {
      counters.matchedNest++;
      if (moveItem(it, nestBin)) {
        markItemInsideTarget(it, nestBinName, aeBinName, nestBinName, externalBinName, locationMap);
        counters.movedNest++;
        counters.namesNest.push(it.name);
      } else {
        counters.failed++;
      }
    }

  }

  AEDRNO.scanAndOrganize = function (aeBinName, keywordCsv, moveVideoNearAE, nestBinName, nestKeywordCsv, moveNests, externalBinName, externalKeywordCsv, moveExternal) {
    if (!app || !app.project || !app.project.rootItem) {
      return 'Nie widzę otwartego projektu Premiere.';
    }

    aeBinName = aeBinName || 'AE Dynamic Relink';
    nestBinName = nestBinName || 'NEST';
    externalBinName = externalBinName || 'External Extension';
    if (moveExternal === undefined || moveExternal === null) { moveExternal = true; }

    var report = { createdBins: [], movedBins: [] };
    var organizerBin = ensureOrganizerBin(report);
    if (!organizerBin) { return 'Nie udało się stworzyć/znaleźć binu: ' + ORGANIZER_ROOT_BIN_NAME; }

    var aeBin = ensureChildBin(organizerBin, aeBinName, report);
    if (!aeBin) { return 'Nie udało się stworzyć/znaleźć binu: ' + aeBinName; }

    var nestBin = null;
    if (moveNests) {
      nestBin = ensureChildBin(organizerBin, nestBinName, report);
      if (!nestBin) { return 'Nie udało się stworzyć/znaleźć binu: ' + nestBinName; }
    }

    var externalBin = null;
    if (moveExternal) {
      externalBin = ensureChildBin(organizerBin, externalBinName, report);
      if (!externalBin) { return 'Nie udało się stworzyć/znaleźć binu: ' + externalBinName; }
    }

    var keywords = splitKeywords(keywordCsv);
    var nestKeywords = splitKeywords(nestKeywordCsv);
    var externalKeywords = splitKeywords(externalKeywordCsv || 'Atom,Motion Graphics Template Media,FireCut,Premiere Composer Files');
    var items = [];
    var locationMap = {};
    collectItems(app.project.rootItem, items, locationMap, aeBinName, nestBinName, externalBinName, false, false, false);

    var movedAE = 0;
    var matchedAE = 0;
    var namesAE = [];
    var movedExternal = 0;
    var matchedExternal = 0;
    var namesExternal = [];
    var counters = {
      movedNest: 0,
      matchedNest: 0,
      failed: 0,
      namesNest: []
    };

    var externalBinCandidates = [];
    if (moveExternal) {
      collectExternalBinCandidates(app.project.rootItem, externalBinCandidates, externalBinName, aeBinName, nestBinName, externalKeywords, false, {});
    }

    if (moveExternal && externalBin) {
      for (var eb = 0; eb < externalBinCandidates.length; eb++) {
        var binCandidate = externalBinCandidates[eb];
        if (!binCandidate) { continue; }
        if (itemIsInsideTargetByMap(binCandidate, externalBinName, locationMap, aeBinName, nestBinName, externalBinName)) { continue; }
        if (alreadyInsideParentBin(binCandidate, externalBinName) || isDirectChildOf(binCandidate, externalBin)) { continue; }
        matchedExternal++;
        if (moveItem(binCandidate, externalBin)) {
          movedExternal++;
          namesExternal.push('[BIN] ' + binCandidate.name);
          markItemInsideTarget(binCandidate, externalBinName, aeBinName, nestBinName, externalBinName, locationMap);
        } else {
          counters.failed++;
        }
      }
    }

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it) { continue; }

      if (moveExternal && externalBin && !itemIsInsideTargetByMap(it, externalBinName, locationMap, aeBinName, nestBinName, externalBinName) && !alreadyInsideParentBin(it, externalBinName) && !isDirectChildOf(it, externalBin)) {
        var externalMatch = looksLikeExternalExtension(it, externalKeywords);
        if (externalMatch) {
          matchedExternal++;
          if (moveItem(it, externalBin)) {
            markItemInsideTarget(it, externalBinName, aeBinName, nestBinName, externalBinName, locationMap);
            movedExternal++;
            namesExternal.push(it.name);
          } else {
            counters.failed++;
          }
          continue;
        }
      }

      if (!alreadyInsideBin(it, aeBinName, locationMap, aeBinName, nestBinName, externalBinName)) {
        var aeMatch = looksLikeDynamicLink(it) || looksLikeRenderAndReplace(it, keywords, moveVideoNearAE);
        if (aeMatch) {
          matchedAE++;
          if (moveItem(it, aeBin)) {
            markItemInsideTarget(it, aeBinName, aeBinName, nestBinName, externalBinName, locationMap);
            movedAE++;
            namesAE.push(it.name);
          } else {
            counters.failed++;
          }
          continue;
        }
      }

      if (moveNests && isProjectSequenceItem(it)) {
        processNestCandidate(it, nestBin, nestBinName, nestKeywords, counters, locationMap, aeBinName, externalBinName);
      }
    }

    // Extra pass directly over app.project.sequences. Some Premiere builds expose manual Nest
    // more reliably here than as a normal child item in the Project panel traversal.
    if (moveNests && app.project.sequences) {
      try {
        for (var sIndex = 0; sIndex < app.project.sequences.numSequences; sIndex++) {
          var seq = app.project.sequences[sIndex];
          if (seq && seq.projectItem) {
            processNestCandidate(seq.projectItem, nestBin, nestBinName, nestKeywords, counters, locationMap, aeBinName, externalBinName);
          }
        }
      } catch (seqLoopError) {}
    }


    if (movedAE === 0 && movedExternal === 0 && counters.movedNest === 0 && counters.failed === 0 && report.createdBins.length === 0 && (!report.movedBins || report.movedBins.length === 0)) {
      return 'Skan OK. Nic nowego do przeniesienia - nie wykonano moveBin.';
    }

    var msg = '';
    if (report.createdBins.length) {
      msg += 'Utworzono bin: ' + report.createdBins.join(', ') + '\n';
    }
    if (report.movedBins && report.movedBins.length) {
      msg += 'Przeniesiono stare biny do ' + ORGANIZER_ROOT_BIN_NAME + ': ' + report.movedBins.join(', ') + '\n';
    }
    msg += 'Przeniesiono AE/Dynamic: ' + movedAE + ' / trafień: ' + matchedAE + '\n';
    msg += 'Przeniesiono External Extension: ' + movedExternal + ' / trafień: ' + matchedExternal + '\n';
    msg += 'Przeniesiono NEST: ' + counters.movedNest + ' / trafień: ' + counters.matchedNest;
    if (counters.failed) { msg += ' / błędy: ' + counters.failed; }

    if (namesAE.length) { msg += '\nAE:\n' + namesAE.slice(0, 6).join('\n'); }
    if (namesAE.length > 6) { msg += '\n...+' + (namesAE.length - 6); }
    if (namesExternal.length) { msg += '\nExternal Extension:\n' + namesExternal.slice(0, 6).join('\n'); }
    if (namesExternal.length > 6) { msg += '\n...+' + (namesExternal.length - 6); }
    if (counters.namesNest.length) { msg += '\nNEST:\n' + counters.namesNest.slice(0, 6).join('\n'); }
    if (counters.namesNest.length > 6) { msg += '\n...+' + (counters.namesNest.length - 6); }
    return msg;
  };

}());
