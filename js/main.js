(function () {
  var cs;
  var timer = null;
  var folderSyncTimer = null;
  var folderSyncRunning = false;
  var ORGANIZER_AUTO_CHECK_INTERVAL_SECONDS = 10;
  var FOLDER_SYNC_INTERVAL_MS = 5000;
  var folderSyncLinkTimer = null;
  var projectTimerInterval = null;
  var projectTimerSaveInterval = null;
  var projectTimerProjectCheckInterval = null;
  var projectTimerSessionStartedAt = null;
  var projectTimerBaseMs = 0;
  var projectTimerCurrentKey = null;
  var projectTimerCurrentInfo = null;
  var projectTimerStorePath = null;
  var projectSettingsData = null;
  var syncFolders = [];
  var organizerAutoCheckEnabled = true;
  var folderSyncEnabled = false;
  var folderSyncStartupReady = false;
  var folderSyncStartupChecked = false;
  var folderSyncStartupMissing = false;
  var storagePrefix = 'AEDRNO_';
  var debugMode = false;
  var backgroundLogsEnabled = false;
  var evalScriptInFlight = {};
  var progressOverlayVisible = false;
  var progressTimer = null;
  var progressValue = 0;
  var progressHideTimer = null;
  var progressMinimized = false;
  var progressDetailVisible = false;
  var progressDetailText = "";
  var startupLoadingActive = false;
  var startupLoadingFinished = false;
  var startupLoadingTimer = null;
  var copyTextBlobClipboard = null;
  var copyTextPositionChoiceCallback = null;

  function esc(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r?\n/g, " ");
  }

  function byId(id) { return document.getElementById(id); }

  function clampProgress(value) {
    value = parseInt(value, 10);
    if (isNaN(value)) { value = 0; }
    return Math.max(0, Math.min(100, value));
  }

  function applyProgressOverlayClass() {
    var overlay = byId('verniProgressOverlay');
    if (!overlay) { return; }
    overlay.className = 'verni-progress-overlay' + (progressOverlayVisible ? ' is-visible' : '') + (progressMinimized ? ' is-minimized' : '');
    try { overlay.setAttribute('aria-hidden', progressOverlayVisible ? 'false' : 'true'); } catch (ignore) {}
    var btn = byId('verniProgressMinimize');
    if (btn) {
      btn.textContent = progressMinimized ? '□' : '−';
      btn.title = progressMinimized ? 'Powieksz pasek postepu' : 'Zmniejsz pasek postepu';
      try { btn.setAttribute('aria-label', btn.title); } catch (ignore2) {}
    }
  }

  function setPanelProgress(value, message) {
    progressValue = clampProgress(value);
    var bar = byId('verniProgressBar');
    var percent = byId('verniProgressPercent');
    var text = byId('verniProgressText');
    if (bar) { bar.style.width = progressValue + '%'; }
    if (percent) { percent.textContent = progressValue + '%'; }
    if (text && message) { text.textContent = message; }
  }

  function setPanelProgressDetail(message, visible) {
    progressDetailText = String(message || '');
    progressDetailVisible = visible !== false && !!progressDetailText;
    var detail = byId('verniProgressDetail');
    if (!detail) { return; }
    detail.textContent = progressDetailText;
    if (progressDetailVisible) { detail.className = 'verni-progress-detail'; }
    else { detail.className = 'verni-progress-detail hidden'; }
  }

  function startPanelProgress(message) {
    var overlay = byId('verniProgressOverlay');
    if (!overlay) { return; }
    if (progressHideTimer) { clearTimeout(progressHideTimer); progressHideTimer = null; }
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    progressOverlayVisible = true;
    progressMinimized = false;
    setPanelProgressDetail('', false);
    applyProgressOverlayClass();
    setPanelProgress(0, message || 'Przetwarzanie...');

    // v1.12.183: pasek nie pompuje sztucznie 0 -> 92%; MEDIA OFFLINE ma realne etapy i licznik skanu.
    // Pokazujemy tylko etapy ustawiane przez konkretną funkcję.
  }

  function togglePanelProgressMinimized() {
    if (!progressOverlayVisible) { return; }
    progressMinimized = !progressMinimized;
    applyProgressOverlayClass();
  }

  function finishPanelProgress(message) {
    var overlay = byId('verniProgressOverlay');
    if (!overlay) { return; }
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    setPanelProgress(100, message || 'Gotowe');
    progressOverlayVisible = false;
    progressHideTimer = setTimeout(function () {
      progressMinimized = false;
      applyProgressOverlayClass();
      setPanelProgress(0, 'Przetwarzanie...');
      setPanelProgressDetail('', false);
      progressHideTimer = null;
    }, 350);
  }

  function failPanelProgress(message) {
    finishPanelProgress(message || 'Zakończono');
  }

  function runPanelAction(message, fn, moduleName, separatorType) {
    var actionModule = moduleName || message || 'Akcja';
    var actionType = separatorType || 'manual';
    logSeparator(actionModule, 'START', actionType);
    startPanelProgress(message);
    var finished = false;
    function done(doneMessage) {
      if (finished) { return; }
      finished = true;
      finishPanelProgress(doneMessage || 'Gotowe');
      logSeparator(actionModule, 'KONIEC', actionType);
    }
    try {
      fn(done);
    } catch (e) {
      logError('System', errorText(e));
      logSeparator(actionModule, 'BLAD', 'error');
      failPanelProgress('Błąd');
    }
  }

  window.VerniProgress = {
    start: startPanelProgress,
    set: setPanelProgress,
    detail: setPanelProgressDetail,
    finish: finishPanelProgress,
    run: runPanelAction
  };

  function startStartupLoadingOverlay() {
    startupLoadingActive = true;
    startupLoadingFinished = false;
    startPanelProgress('Trwa ładowanie wtyczki');
    setPanelProgress(6, 'Trwa ładowanie wtyczki');
    if (startupLoadingTimer) { clearTimeout(startupLoadingTimer); startupLoadingTimer = null; }
    // Awaryjny bezpiecznik: nie zostawiamy panelu zablokowanego, gdy Premiere/CEP nie odda odpowiedzi.
    startupLoadingTimer = setTimeout(function () {
      if (startupLoadingFinished) { return; }
      startupLoadingFinished = true;
      startupLoadingActive = false;
      logWarn('System', 'Ładowanie ustawień projektu trwało za długo - odblokowuję panel awaryjnie.');
      finishPanelProgress('Wtyczka gotowa');
    }, 15000);
  }

  function finishStartupLoadingOverlay(message) {
    if (startupLoadingFinished) { return; }
    startupLoadingFinished = true;
    startupLoadingActive = false;
    if (startupLoadingTimer) { clearTimeout(startupLoadingTimer); startupLoadingTimer = null; }
    setPanelProgress(100, message || 'Wtyczka gotowa');
    finishPanelProgress(message || 'Wtyczka gotowa');
  }

  function formatLogPrefix(module, level) {
    var prefix = '';
    if (module) { prefix += '[' + module + '] '; }
    if (level && level !== 'INFO') { prefix += '[' + level + '] '; }
    return prefix;
  }

  function normalizeLogText(value) {
    var s = String(value == null ? '' : value);

    // CEP + ExtendScript can sometimes return UTF-8 text as mojibake.
    // Logs stay ASCII-only, while the main UI can still use Polish text.
    var replacements = {
      'Ä…': 'a', 'Ä‡': 'c', 'Ä™': 'e', 'Ĺ‚': 'l', 'Ĺ„': 'n', 'Ăł': 'o', 'Ă“': 'O', 'Ĺ›': 's', 'ĹĽ': 'z', 'Ĺş': 'z',
      'Ä„': 'A', 'Ä†': 'C', 'ÄĘ': 'E', 'ĹŁ': 'L', 'ĹŃ': 'N', 'Ĺš': 'S', 'Ĺ»': 'Z', 'Ĺą': 'Z',
      'Ňā': 'l', 'Ňľ': 'z', 'ná': 'c', 'nô': 'e', 'ô': 'e', '√≥': 'o', '≈Ç': 'l', '≈ā': 's', '≈ľ': 'z', '≈ļ': 'z',
      'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ż': 'z', 'ź': 'z',
      'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ż': 'Z', 'Ź': 'Z',
      '—': '-', '–': '-', '→': '->', '←': '<-', '✓': 'OK', '×': 'x'
    };

    for (var key in replacements) {
      if (Object.prototype.hasOwnProperty.call(replacements, key)) {
        s = s.split(key).join(replacements[key]);
      }
    }
    return s;
  }

  function prependLogNode(node) {
    var el = byId('log');
    if (!el || !node) { return; }
    try { el.insertBefore(node, el.firstChild); } catch (e) {
      try { el.textContent = (node.textContent || '') + '\n' + el.textContent; } catch (ignore) {}
    }
  }

  function log(msg, module, level, debugOnly) {
    if (debugOnly && !debugMode) { return; }
    var el = byId('log');
    if (!el) { return; }
    var stamp = new Date().toLocaleTimeString();
    var safeModule = normalizeLogText(module || '');
    var safeMsg = normalizeLogText(msg);
    var line = document.createElement('span');
    line.className = 'log-line log-level-' + String(level || 'INFO').toLowerCase();
    line.textContent = '[' + stamp + '] ' + formatLogPrefix(safeModule, level || 'INFO') + safeMsg + '\n';
    prependLogNode(line);
  }

  function logSeparator(module, phase, type) {
    var el = byId('log');
    if (!el) { return; }
    var stamp = new Date().toLocaleTimeString();
    var safeModule = normalizeLogText(module || 'Akcja');
    var safePhase = normalizeLogText(phase || 'START');
    var line = document.createElement('span');
    var safeType = type === 'background' ? 'background' : (type === 'error' ? 'error' : 'manual');
    line.className = 'log-line log-separator log-separator-' + safeType;
    line.textContent = '\n[' + stamp + '] [' + safeModule + '] ' + safePhase + ' ' + repeatText('-', 58) + '\n\n';
    prependLogNode(line);
  }

  function repeatText(text, count) {
    var out = '';
    for (var i = 0; i < count; i++) { out += text; }
    return out;
  }

  function logInfo(module, msg) { log(msg, module, 'INFO', false); }
  function logWarn(module, msg) { log(msg, module, 'WARN', false); }
  function logError(module, msg) { log(msg, module, 'ERROR', false); }
  function logDebug(module, msg) { log(msg, module, 'DEBUG', true); }

  function setDebugMode(enabled, silent) {
    debugMode = enabled === true;
    try { localStorage.setItem(storagePrefix + 'debugMode', debugMode ? '1' : '0'); } catch (e) {}
    var toggle = byId('debugModeToggle');
    if (toggle) { toggle.checked = debugMode; }
    if (!silent) {
      logInfo('System', debugMode ? 'Debug Mode włączony. Logi będą bardziej szczegółowe.' : 'Debug Mode wyłączony. Logi wróciły do trybu zwykłego.');
    }
  }

  function initDebugMode() {
    var enabled = false;
    try { enabled = localStorage.getItem(storagePrefix + 'debugMode') === '1'; } catch (e) {}
    setDebugMode(enabled, true);
    var toggle = byId('debugModeToggle');
    if (toggle) {
      toggle.onchange = function () { setDebugMode(toggle.checked, false); };
    }
  }


  function setBackgroundLogsEnabled(enabled, silent) {
    backgroundLogsEnabled = enabled === true;
    try { localStorage.setItem(storagePrefix + 'backgroundLogsEnabled', backgroundLogsEnabled ? '1' : '0'); } catch (e) {}
    var toggle = byId('backgroundLogsToggle');
    if (toggle) { toggle.checked = backgroundLogsEnabled; }
    if (!silent) {
      logInfo('System', backgroundLogsEnabled ? 'Logi AutoSync/Organizer/Timer wlaczone.' : 'Logi AutoSync/Organizer/Timer wylaczone.');
    }
  }

  function initBackgroundLogsToggle() {
    var enabled = false;
    try { enabled = localStorage.getItem(storagePrefix + 'backgroundLogsEnabled') === '1'; } catch (e) {}
    setBackgroundLogsEnabled(enabled, true);
    var toggle = byId('backgroundLogsToggle');
    if (toggle) {
      toggle.onchange = function () { setBackgroundLogsEnabled(toggle.checked, false); };
    }
  }


  function updateIosToggle(id, enabled) {
    var toggle = byId(id);
    if (!toggle) { return; }
    if (enabled) { toggle.classList.add('is-on'); }
    else { toggle.classList.remove('is-on'); }
    try { toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false'); } catch (e) {}
  }


  function updateFolderSyncToggleAvailability(ready, reason) {
    folderSyncStartupReady = ready === true;
    var toggle = byId('folderSyncModuleToggle');
    var checkbox = byId('folderSyncEnabled');
    if (checkbox) { checkbox.disabled = !folderSyncStartupReady; }
    if (toggle) {
      try { toggle.disabled = !folderSyncStartupReady; } catch (e0) {}
      if (folderSyncStartupReady) {
        toggle.classList.remove('is-disabled');
        toggle.title = 'Włącz lub wyłącz Auto-Sync folderów';
        try { toggle.setAttribute('aria-disabled', 'false'); } catch (e1) {}
      } else {
        toggle.classList.add('is-disabled');
        toggle.title = reason || 'Auto-Sync zostanie odblokowany po sprawdzeniu JSON-a projektu i ścieżek folderów.';
        try { toggle.setAttribute('aria-disabled', 'true'); } catch (e2) {}
      }
    }
  }

  function setFolderSyncVisualState(enabled) {
    folderSyncEnabled = enabled === true;
    var checkbox = byId('folderSyncEnabled');
    if (checkbox) { checkbox.checked = folderSyncEnabled; }
    updateIosToggle('folderSyncModuleToggle', folderSyncEnabled);
  }

  function setOrganizerAutoCheckEnabled(enabled, silent) {
    organizerAutoCheckEnabled = enabled !== false;
    var auto = byId('autoStart');
    if (auto) { auto.checked = organizerAutoCheckEnabled; }
    updateIosToggle('organizerAutoCheckToggle', organizerAutoCheckEnabled);
    try { localStorage.setItem(storagePrefix + 'organizerAutoCheckEnabled', organizerAutoCheckEnabled ? '1' : '0'); } catch (e) {}
    if (organizerAutoCheckEnabled) {
      startWatch(true);
      if (!silent) { logInfo('Organizer', 'Segregowanie Auto-Check wlaczone.'); }
    } else {
      stopWatch(true);
      if (!silent) { logInfo('Organizer', 'Segregowanie Auto-Check wylaczone.'); }
    }
  }

  function setFolderSyncEnabled(enabled, silent) {
    var wantsOn = enabled !== false;
    if (wantsOn && !folderSyncStartupReady) {
      setFolderSyncVisualState(false);
      stopFolderSyncTimer();
      if (!silent) {
        if (folderSyncStartupMissing) {
          logWarn('AutoSync', 'Auto-Sync nie może zostać włączony, bo nie znaleziono jednego lub więcej folderów z JSON-a projektu. Wskaż brakujące ścieżki ręcznie.');
        } else {
          logWarn('AutoSync', 'Auto-Sync jest jeszcze zablokowany - czekam na sprawdzenie JSON-a projektu i ścieżek folderów.');
        }
      }
      return;
    }
    setFolderSyncVisualState(wantsOn);
    saveFolderSyncEnabled();
    if (folderSyncEnabled) {
      startFolderSyncTimer();
      if (!silent) { logInfo('AutoSync', 'Automatyczna synchronizacja folderow wlaczona.'); }
    } else {
      stopFolderSyncTimer();
      if (!silent) { logInfo('AutoSync', 'Automatyczna synchronizacja folderow wylaczona.'); }
    }
  }

  function bindModuleToggles() {
    updateIosToggle('organizerAutoCheckToggle', organizerAutoCheckEnabled);
    updateIosToggle('folderSyncModuleToggle', folderSyncEnabled);
    var orgToggle = byId('organizerAutoCheckToggle');
    if (orgToggle) {
      orgToggle.onclick = function (e) {
        if (e && e.stopPropagation) { e.stopPropagation(); }
        setOrganizerAutoCheckEnabled(!organizerAutoCheckEnabled, false);
      };
    }
    var fsToggle = byId('folderSyncModuleToggle');
    if (fsToggle) {
      fsToggle.onclick = function (e) {
        if (e && e.stopPropagation) { e.stopPropagation(); }
        if (!folderSyncStartupReady && !folderSyncEnabled) {
          setFolderSyncEnabled(true, false);
          return;
        }
        setFolderSyncEnabled(!folderSyncEnabled, false);
      };
    }
  }

  /* ── Globalne rozwijane listy ponad panelem CEP ── */
  var verniSelectMenu = null;
  var verniSelectActive = null;

  function closeVerniSelectMenu() {
    if (verniSelectMenu && verniSelectMenu.parentNode) {
      verniSelectMenu.parentNode.removeChild(verniSelectMenu);
    }
    verniSelectMenu = null;
    if (verniSelectActive) {
      try { verniSelectActive.classList.remove('verni-select-open'); } catch (ignore) {}
    }
    verniSelectActive = null;
  }

  function dispatchVerniSelectChange(select) {
    try {
      var ev = document.createEvent('HTMLEvents');
      ev.initEvent('change', true, false);
      select.dispatchEvent(ev);
    } catch (e1) {
      try {
        if (typeof select.onchange === 'function') { select.onchange(); }
      } catch (e2) {}
    }
  }

  function positionVerniSelectMenu(select, menu) {
    var rect = select.getBoundingClientRect();
    var viewportH = window.innerHeight || document.documentElement.clientHeight || 600;
    var viewportW = window.innerWidth || document.documentElement.clientWidth || 360;
    var gap = 4;
    var margin = 6;
    var maxMenuH = 220;
    var itemH = 24;

    try {
      var firstOption = menu && menu.children && menu.children.length ? menu.children[0] : null;
      if (firstOption && firstOption.offsetHeight) { itemH = Math.max(18, firstOption.offsetHeight); }
    } catch (ignore) {}

    var optionCount = select && select.options ? select.options.length : 0;
    var fullMenuH = Math.max(itemH, optionCount * itemH);
    var below = Math.max(0, viewportH - rect.bottom - gap - margin);
    var above = Math.max(0, rect.top - gap - margin);
    var belowVisible = Math.floor(below / itemH);

    // Otwieraj w dol tylko wtedy, gdy pod selectem miesci sie sensowny fragment listy.
    // Przy 4 pozycjach lub mniej lista idzie do gory, zeby nie znikala / nie ladowala losowo na srodku panelu.
    var openUp = belowVisible < 5 && above > below;
    var available = openUp ? above : below;
    if (available < itemH && !openUp && above > below) {
      openUp = true;
      available = above;
    }

    var maxH = Math.max(itemH, Math.min(fullMenuH, maxMenuH, Math.max(itemH, available)));
    var width = Math.max(40, Math.min(rect.width, viewportW - (margin * 2)));
    var left = Math.max(margin, Math.min(rect.left, viewportW - width - margin));
    var top;

    if (openUp) {
      top = rect.top - maxH - gap;
      if (top < margin) {
        maxH = Math.max(itemH, rect.top - gap - margin);
        top = Math.max(margin, rect.top - maxH - gap);
      }
    } else {
      top = rect.bottom + gap;
      if (top + maxH > viewportH - margin) {
        maxH = Math.max(itemH, viewportH - top - margin);
      }
    }

    menu.className = 'verni-select-menu' + (openUp ? ' opens-up' : ' opens-down');
    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(top) + 'px';
    menu.style.width = Math.round(width) + 'px';
    menu.style.maxHeight = Math.round(maxH) + 'px';
  }

  function openVerniSelectMenu(select) {
    if (!select || select.disabled || select.multiple) { return; }
    if (verniSelectActive === select && verniSelectMenu) {
      closeVerniSelectMenu();
      return;
    }
    closeVerniSelectMenu();
    verniSelectActive = select;
    try { select.classList.add('verni-select-open'); } catch (ignore) {}

    var menu = document.createElement('div');
    menu.className = 'verni-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.onmousedown = function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      return false;
    };
    menu.onwheel = function (e) {
      if (e && e.stopPropagation) { e.stopPropagation(); }
    };
    menu.onscroll = function (e) {
      if (e && e.stopPropagation) { e.stopPropagation(); }
    };

    for (var i = 0; i < select.options.length; i++) {
      var opt = select.options[i];
      if (!opt) { continue; }
      var item = document.createElement('div');
      item.className = 'verni-select-option' + (opt.selected ? ' is-selected' : '') + (opt.disabled ? ' is-disabled' : '');
      item.setAttribute('role', 'option');
      item.setAttribute('data-value', opt.value);
      item.setAttribute('data-index', String(i));
      item.textContent = opt.text;
      item.onclick = function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        var idx = parseInt(this.getAttribute('data-index'), 10);
        if (isNaN(idx) || !verniSelectActive || !verniSelectActive.options[idx] || verniSelectActive.options[idx].disabled) {
          closeVerniSelectMenu();
          return false;
        }
        var oldValue = verniSelectActive.value;
        verniSelectActive.selectedIndex = idx;
        if (verniSelectActive.value !== oldValue) { dispatchVerniSelectChange(verniSelectActive); }
        closeVerniSelectMenu();
        return false;
      };
      menu.appendChild(item);
    }

    document.body.appendChild(menu);
    verniSelectMenu = menu;
    positionVerniSelectMenu(select, menu);
    try {
      var selected = menu.querySelector('.is-selected');
      if (selected && selected.scrollIntoView) { selected.scrollIntoView({ block: 'nearest' }); }
    } catch (ignore2) {}
  }

  function installGlobalSelectOverlay() {
    function selectFromTarget(target) {
      while (target && target !== document && target.tagName) {
        if (String(target.tagName).toLowerCase() === 'select') { return target; }
        target = target.parentNode;
      }
      return null;
    }

    document.addEventListener('mousedown', function (e) {
      var select = selectFromTarget(e && e.target);
      if (select) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        openVerniSelectMenu(select);
        return false;
      }
      if (verniSelectMenu && !(verniSelectMenu.contains && verniSelectMenu.contains(e && e.target))) {
        closeVerniSelectMenu();
      }
    }, true);

    document.addEventListener('click', function (e) {
      var select = selectFromTarget(e && e.target);
      if (select) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        return false;
      }
    }, true);

    window.addEventListener('resize', closeVerniSelectMenu, true);
    window.addEventListener('scroll', function (e) {
      var target = e && e.target;
      if (verniSelectMenu && target && (target === verniSelectMenu || (verniSelectMenu.contains && verniSelectMenu.contains(target)))) {
        return;
      }
      closeVerniSelectMenu();
    }, true);
    document.addEventListener('keydown', function (e) {
      e = e || window.event;
      var key = e.key || e.keyCode;
      if (key === 'Escape' || key === 27) { closeVerniSelectMenu(); }
    }, true);
  }

  function installGlobalDropGuard() {
    function isAllowedDropTarget(target) {
      var drop = byId('folderSyncDrop');
      if (!drop || !target) { return false; }
      return target === drop || (drop.contains && drop.contains(target));
    }

    function blockPanelDropNavigation(e) {
      if (isAllowedDropTarget(e && e.target)) { return; }
      try {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer) { e.dataTransfer.dropEffect = 'none'; }
        }
      } catch (ignore) {}
      return false;
    }

    var events = ['dragenter', 'dragover', 'dragleave', 'drop'];
    for (var i = 0; i < events.length; i++) {
      try { window.addEventListener(events[i], blockPanelDropNavigation, true); } catch (e1) {}
      try { document.addEventListener(events[i], blockPanelDropNavigation, true); } catch (e2) {}
    }
  }

  function errorText(e) {
    try {
      if (!e) { return 'Nieznany błąd'; }
      var out = '';
      if (e.name) { out += e.name + ': '; }
      out += e.message || String(e);
      if (e.line) { out += ' | line: ' + e.line; }
      return out;
    } catch (ignore) {
      return 'Nieznany błąd';
    }
  }

  function extendScriptStringLiteral(s) {
    return "'" + String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ') + "'";
  }

  function summarizeEvalCodeForLog(code, label) {
    var s = String(code || '');
    var isUnNest = /UN NEST/i.test(String(label || '')) || /unNestNative|unNestSelected|undoLastUnNest/i.test(s);
    if (!isUnNest && s.length <= 900) { return s; }
    if (!isUnNest && s.length > 900) { return s.substring(0, 900) + ' ... [ucięto ' + s.length + ' znaków]'; }
    var fn = 'UN NEST evalScript';
    var m = s.match(/AEDRNO\.([A-Za-z0-9_]+)/);
    if (m && m[1]) { fn = 'AEDRNO.' + m[1]; }
    var payloadInfo = '';
    try {
      var mm = s.match(/'((?:\\.|[^'])*)'/);
      if (mm && mm[1]) {
        var raw = mm[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
        if (raw && raw.charAt(0) === '{') {
          var obj = JSON.parse(raw);
          payloadInfo = ' | payload: parent=' + (obj.parentSequenceName || '?') + ', nested=' + (obj.nestedSequenceName || '?') + ', delete=' + obj.deleteProjectSequenceAfterPaste + ', multicam=' + obj.isMulticamNest + ', snapshotKeys=' + (obj.prePasteSnapshot ? Object.keys(obj.prePasteSnapshot).length : 0);
        }
      }
    } catch (e) {}
    return fn + payloadInfo + ' | codeLength=' + s.length + ' [payload ukryty w debug logu]';
  }

  function getExtensionRootPath() {
    try {
      if (cs && cs.getSystemPath && window.SystemPath) {
        var p = cs.getSystemPath(SystemPath.EXTENSION);
        if (p) { return String(p).replace(/\\/g, '/'); }
      }
    } catch (e) {}
    return '';
  }

  function buildSafeEvalScript(code, requiredFn) {
    var hostPath = getExtensionRootPath();
    var codeLiteral = extendScriptStringLiteral(code);
    var fnLiteral = extendScriptStringLiteral(requiredFn || '');
    var hostLiteral = extendScriptStringLiteral(hostPath ? (hostPath + '/jsx/host.jsx') : '');

    // v1.12.181: this script must run at ExtendScript top-level, not inside an IIFE.
    // $.evalFile() called from inside a function can make "var AEDRNO" from modules local to that call,
    // which makes the loader report OK and the next evalScript report the function as missing.
    return "var __verniRes='';" +
      "function __verniErr(e){var out='';try{if(e&&e.name){out+=e.name+': ';}}catch(_e1){}try{out+=(e&&e.message)?e.message:String(e);}catch(_e2){out+='Nieznany blad';}try{if(e&&e.line){out+=' | line: '+e.line;}}catch(_e3){}return out;}" +
      "try{" +
      "var __fn=" + fnLiteral + ";" +
      "var __host=" + hostLiteral + ";" +
      "if(__host && (typeof AEDRNO==='undefined' || (__fn && (!AEDRNO || !AEDRNO[__fn])))){ $.evalFile(new File(__host)); }" +
      "if(__fn && (typeof AEDRNO==='undefined' || !AEDRNO || !AEDRNO[__fn])){__verniRes='BLAD ExtendScript: modul nie jest zaladowany albo brakuje funkcji AEDRNO.'+__fn;}" +
      "else{var __tmp=eval(" + codeLiteral + ");__verniRes=(__tmp===undefined||__tmp===null)?'':String(__tmp);}" +
      "}catch(e){__verniRes='BLAD ExtendScript: '+__verniErr(e);}" +
      "__verniRes;";
  }

  function evalScriptLogged(label, code, cb, requiredFn, guardKey, options) {
    options = options || {};
    var quietDebug = options.quietDebug === true;
    var key = guardKey || requiredFn || label || code;
    if (key && evalScriptInFlight[key]) {
      if (!quietDebug) { logDebug(label, 'evalScript pominięty — poprzednie wywołanie nadal trwa | key: ' + key); }
      if (cb) { cb('Pominięto: poprzednie wywołanie nadal trwa.'); }
      return false;
    }
    if (key) { evalScriptInFlight[key] = true; }

    function releaseGuard() {
      if (key && evalScriptInFlight[key]) { delete evalScriptInFlight[key]; }
    }

    var startedAt = new Date().getTime();
    var safeCode = buildSafeEvalScript(code, requiredFn);
    if (!quietDebug) { logDebug(label, 'evalScript start | code: ' + summarizeEvalCodeForLog(code, label) + (requiredFn ? ' | required: AEDRNO.' + requiredFn : '') + (key ? ' | key: ' + key : '')); }
    try {
      cs.evalScript(safeCode, function (res) {
        releaseGuard();
        var elapsed = new Date().getTime() - startedAt;
        var responseLength = res ? String(res).length : 0;
        if (!quietDebug) { logDebug(label, 'evalScript koniec | czas: ' + elapsed + ' ms | odpowiedź: ' + responseLength + ' znaków' + (key ? ' | key: ' + key : '')); }
        if (res === 'EvalScript error.') {
          logError(label, 'EvalScript error. Premiere zwrócił błąd bez szczegółów. Sprawdź ścieżkę instalacji i moduły JSX.');
        } else if (res && (String(res).indexOf('BŁĄD ExtendScript:') === 0 || String(res).indexOf('BLAD ExtendScript:') === 0)) {
          logError(label, String(res).replace(/^(BŁĄD|BLAD) ExtendScript:\s*/, ''));
        }
        if (cb) { cb(res); }
      });
    } catch (e) {
      releaseGuard();
      logError(label, 'Błąd CEP: ' + errorText(e));
      if (cb) { cb(''); }
    }
    return true;
  }

  /* ── Główne zakładki (fioletowe) ── */
  window.toggleMain = function (id) {
    var body = byId('mbody-' + id);
    var arrow = byId('marrow-' + id);
    if (body.classList.contains('open')) {
      body.classList.remove('open');
      arrow.textContent = '▶';
    } else {
      body.classList.add('open');
      arrow.textContent = '▼';
    }
  };

  /* ── Pod-zakładki (pomarańczowe) ── */
  window.toggleSub = function (id) {
    var body = byId(id);
    var arrow = byId('arrow-' + id);
    if (body.classList.contains('open')) {
      body.classList.remove('open');
      arrow.textContent = '▶';
    } else {
      body.classList.add('open');
      arrow.textContent = '▼';
    }
  };

  /* ── Logi ── */
  window.toggleLog = function () {
    var el = byId('log');
    var arrow = byId('logArrow');
    var hint = byId('logToggle').querySelector('.log-hint');
    if (el.classList.contains('log-hidden')) {
      el.classList.remove('log-hidden');
      arrow.textContent = '▼';
      hint.textContent = '(kliknij, aby zwinąć)';
    } else {
      el.classList.add('log-hidden');
      arrow.textContent = '▶';
      hint.textContent = '(kliknij, aby rozwinąć)';
    }
  };

  /* ── Zapis ustawień ── */
  function saveSettings() {
    try {
      localStorage.setItem(storagePrefix + 'aeBinName', byId('aeBinName').value || 'AE Dynamic Relink');
      localStorage.setItem(storagePrefix + 'nestBinName', byId('nestBinName').value || 'NEST');
      var externalBinInput = byId('externalBinName');
      var externalKeywordsInput = byId('externalKeywords');
      localStorage.setItem(storagePrefix + 'externalBinName', externalBinInput ? (externalBinInput.value || 'External Extension') : 'External Extension');
      localStorage.setItem(storagePrefix + 'externalKeywords', externalKeywordsInput ? (externalKeywordsInput.value || 'Atom,Motion Graphics Template Media,FireCut,Premiere Composer Files') : 'Atom,Motion Graphics Template Media,FireCut,Premiere Composer Files');
      localStorage.setItem(storagePrefix + 'interval', String(ORGANIZER_AUTO_CHECK_INTERVAL_SECONDS));
      localStorage.setItem(storagePrefix + 'keywords', byId('keywords').value || '');
      localStorage.setItem(storagePrefix + 'nestKeywords', byId('nestKeywords').value || '');
      localStorage.setItem(storagePrefix + 'autoStart', organizerAutoCheckEnabled ? '1' : '0');
      localStorage.setItem(storagePrefix + 'organizerAutoCheckEnabled', organizerAutoCheckEnabled ? '1' : '0');
      localStorage.setItem(storagePrefix + 'tcSyncMode', byId('tcSyncMode').value || 'clipsTc');
      localStorage.setItem(storagePrefix + 'tcOffset', byId('tcOffset').value || '00:00:00:00');
      localStorage.setItem(storagePrefix + 'tcInsertType', byId('tcInsertType').value || 'Both');
      localStorage.setItem(storagePrefix + 'splitX', byId('splitX').value || '4');
      localStorage.setItem(storagePrefix + 'splitY', byId('splitY').value || '1');
      localStorage.setItem(storagePrefix + 'splitGapX', byId('splitGapX').value || '0');
      localStorage.setItem(storagePrefix + 'splitGapY', byId('splitGapY').value || '0');
      localStorage.setItem(storagePrefix + 'splitMode', byId('splitMode').value || 'fill');
      localStorage.setItem(storagePrefix + 'splitOrderByTracks', byId('splitOrderByTracks').checked ? '1' : '0');
    } catch (e) {}
  }

  /* ── Odczyt ustawień ── */
  function loadSettings() {
    try {
      var aeBinName = localStorage.getItem(storagePrefix + 'aeBinName');
      var nestBinName = localStorage.getItem(storagePrefix + 'nestBinName');
      var keywords = localStorage.getItem(storagePrefix + 'keywords');
      var nestKeywords = localStorage.getItem(storagePrefix + 'nestKeywords');
      var externalBinName = localStorage.getItem(storagePrefix + 'externalBinName');
      var externalKeywords = localStorage.getItem(storagePrefix + 'externalKeywords');
      var autoStart = localStorage.getItem(storagePrefix + 'autoStart');
      var organizerEnabled = localStorage.getItem(storagePrefix + 'organizerAutoCheckEnabled');
      var tcSyncMode = localStorage.getItem(storagePrefix + 'tcSyncMode');
      var tcOffset = localStorage.getItem(storagePrefix + 'tcOffset');
      var tcInsertType = localStorage.getItem(storagePrefix + 'tcInsertType');
      var splitX = localStorage.getItem(storagePrefix + 'splitX');
      var splitY = localStorage.getItem(storagePrefix + 'splitY');
      var splitGapX = localStorage.getItem(storagePrefix + 'splitGapX');
      var splitGapY = localStorage.getItem(storagePrefix + 'splitGapY');
      var splitMode = localStorage.getItem(storagePrefix + 'splitMode');
      var splitOrderByTracks = localStorage.getItem(storagePrefix + 'splitOrderByTracks');

      if (aeBinName !== null) { byId('aeBinName').value = aeBinName; }
      if (nestBinName !== null) { byId('nestBinName').value = nestBinName; }
      if (keywords !== null) { byId('keywords').value = keywords; }
      if (nestKeywords !== null) { byId('nestKeywords').value = nestKeywords; }
      if (externalBinName !== null && byId('externalBinName')) { byId('externalBinName').value = externalBinName; }
      if (externalKeywords !== null && byId('externalKeywords')) { byId('externalKeywords').value = externalKeywords; }
      if (tcSyncMode !== null) { byId('tcSyncMode').value = tcSyncMode; }
      if (tcOffset !== null) { byId('tcOffset').value = tcOffset; }
      if (tcInsertType !== null) { byId('tcInsertType').value = tcInsertType; }
      if (splitX !== null) { byId('splitX').value = splitX; }
      if (splitY !== null) { byId('splitY').value = splitY; }
      if (splitGapX !== null) { byId('splitGapX').value = splitGapX; }
      if (splitGapY !== null) { byId('splitGapY').value = splitGapY; }
      if (splitMode !== null) { byId('splitMode').value = splitMode; }
      byId('splitOrderByTracks').checked = splitOrderByTracks === null ? true : splitOrderByTracks === '1';
      updateSplitPreview();

      byId('moveVideoNearAE').checked = true;
      byId('moveNests').checked = true;
      organizerAutoCheckEnabled = organizerEnabled === null ? (autoStart === null ? true : autoStart === '1') : organizerEnabled === '1';
      byId('autoStart').checked = organizerAutoCheckEnabled;
      updateIosToggle('organizerAutoCheckToggle', organizerAutoCheckEnabled);
    } catch (e) {
      organizerAutoCheckEnabled = true;
      byId('autoStart').checked = true;
      updateIosToggle('organizerAutoCheckToggle', true);
    }
  }

  /* ── Licznik czasu pracy przy projekcie ── */
  function pad2(n) {
    n = Math.max(0, parseInt(n, 10) || 0);
    return n < 10 ? '0' + n : String(n);
  }

  function formatProjectElapsed(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    return pad2(h) + ':' + pad2(m) + ':' + pad2(s);
  }

  function projectTimerNowMs() {
    if (!projectTimerSessionStartedAt) { return projectTimerBaseMs || 0; }
    return (projectTimerBaseMs || 0) + Math.max(0, Date.now() - projectTimerSessionStartedAt);
  }

  function projectTimerGetFs() {
    try {
      if (typeof require === 'function') { return require('fs'); }
    } catch (e) {}
    return null;
  }

  function projectSettingsEmpty(info) {
    info = info || {};
    return {
      version: 1,
      app: 'Verni_AiO_Extension',
      projectName: info.name || 'Projekt Premiere',
      projectPath: info.path || '',
      settingsPath: info.settingsPath || '',
      timerMs: 0,
      folderSync: {
        enabled: false,
        folders: []
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  function projectSettingsNormalize(data, info) {
    info = info || {};
    if (!data || typeof data !== 'object') { data = projectSettingsEmpty(info); }
    data.version = 1;
    data.app = 'Verni_AiO_Extension';
    data.projectName = info.name || data.projectName || 'Projekt Premiere';
    data.projectPath = info.path || data.projectPath || '';
    data.settingsPath = info.settingsPath || data.settingsPath || '';
    data.timerMs = parseInt(data.timerMs, 10) || 0;
    if (!data.folderSync || typeof data.folderSync !== 'object') { data.folderSync = {}; }
    data.folderSync.enabled = data.folderSync.enabled === true ? true : false;
    if (!data.folderSync.folders || !data.folderSync.folders.length) { data.folderSync.folders = []; }
    for (var i = 0; i < data.folderSync.folders.length; i++) {
      if (!data.folderSync.folders[i].color || String(data.folderSync.folders[i].color) === '-1') { data.folderSync.folders[i].color = '6'; }
      if (typeof data.folderSync.folders[i].subfolders === 'undefined') { data.folderSync.folders[i].subfolders = true; }
      if (typeof data.folderSync.folders[i].linked === 'undefined') { data.folderSync.folders[i].linked = true; }
      if (typeof data.folderSync.folders[i].missingNotified === 'undefined') { data.folderSync.folders[i].missingNotified = false; }
      if (!data.folderSync.folders[i].paths || typeof data.folderSync.folders[i].paths !== 'object') { data.folderSync.folders[i].paths = {}; }
      try { ensureFolderPortableInfo(data.folderSync.folders[i]); } catch (ePortable) {}
    }
    if (!data.createdAt) { data.createdAt = Date.now(); }
    data.updatedAt = Date.now();
    return data;
  }

  function projectSettingsRead(info) {
    info = info || {};
    var txt = '';
    try {
      var fs = projectTimerGetFs();
      if (fs && info.settingsPath && fs.existsSync(info.settingsPath)) {
        txt = fs.readFileSync(info.settingsPath, 'utf8') || '';
      }
    } catch (e1) { txt = ''; }

    // WAŻNE: Auto-Sync ma być czysty dla projektu i ma korzystać wyłącznie
    // z JSON-a obok pliku .prproj. Nie czytamy już starych danych z localStorage,
    // bo to mogło przenosić foldery typu TEST między projektami.
    var data = null;
    if (txt) {
      try { data = JSON.parse(txt); } catch (e2) { data = null; }
    }
    data = projectSettingsNormalize(data, info);
    projectSettingsData = data;
    return data;
  }

  function projectSettingsWrite(data) {
    if (!data || typeof data !== 'object') { return; }
    data.updatedAt = Date.now();
    projectSettingsData = data;
    var txt = '';
    try { txt = JSON.stringify(data, null, 2); } catch (e0) { return; }
    try {
      var fs = projectTimerGetFs();
      if (fs && data.settingsPath) {
        fs.writeFileSync(data.settingsPath, txt, 'utf8');
      }
    } catch (e1) {
      logWarn('Timer', 'Nie udało się zapisać pliku ustawień projektu JSON: ' + errorText(e1));
    }
  }

  function projectTimerSaveCurrent() {
    if (!projectTimerCurrentKey || !projectTimerCurrentInfo) { return; }
    var data = projectSettingsData || projectSettingsRead(projectTimerCurrentInfo);
    data = projectSettingsNormalize(data, projectTimerCurrentInfo);
    data.timerMs = projectTimerNowMs();
    data.folderSync = data.folderSync || {};
    data.folderSync.enabled = folderSyncEnabled === false ? false : true;
    data.folderSync.folders = syncFolders || [];
    projectSettingsWrite(data);
  }

  function prepareFolderSyncFromProjectJson(showAlerts) {
    folderSyncStartupChecked = true;
    folderSyncStartupMissing = false;
    updateFolderSyncToggleAvailability(false, 'Sprawdzam JSON projektu i ścieżki Auto-Sync...');
    if (startupLoadingActive) { setPanelProgress(84, 'Sprawdzanie Auto-Sync...'); }

    var changed = false;
    var firstMissing = null;

    if (!syncFolders || !syncFolders.length) {
      updateFolderSyncToggleAvailability(true, 'Auto-Sync gotowy.');
      logInfo('AutoSync', 'JSON projektu sprawdzony. Brak folderów Auto-Sync - możesz dodać nowe foldery.');
      return true;
    }

    for (var i = 0; i < syncFolders.length; i++) {
      var f = syncFolders[i];
      try { ensureFolderPortableInfo(f); } catch (eEnsure) {}
      var beforePath = normalizePath(f.path || '');
      var resolvedPath = resolvePortableFolderPath(f);
      var finalPath = normalizePath(resolvedPath || beforePath);
      var exists = folderPathExists(finalPath);

      if (exists) {
        if (finalPath && finalPath.toLowerCase() !== beforePath.toLowerCase()) {
          f.path = finalPath;
          updateFolderPlatformPaths(f, finalPath);
          changed = true;
          logInfo('AutoSync', 'Naprawiono ścieżkę po nazwie dysku/woluminu: ' + (f.name || getBaseName(finalPath)) + ' - ' + finalPath);
        }
        if (f.linked === false || f.missingNotified) {
          f.linked = true;
          f.missingNotified = false;
          changed = true;
        }
      } else {
        folderSyncStartupMissing = true;
        if (!firstMissing) { firstMissing = f; }
        if (f.linked !== false || f.missingNotified !== true) {
          f.linked = false;
          f.missingNotified = true;
          changed = true;
        }
      }
    }

    if (changed) {
      saveSyncFolders();
      renderSyncFolders();
    }

    if (folderSyncStartupMissing) {
      updateFolderSyncToggleAvailability(false, 'Nie znaleziono folderu Auto-Sync. Wskaż brakującą ścieżkę ręcznie.');
      setFolderSyncVisualState(false);
      stopFolderSyncTimer();
      if (showAlerts && firstMissing) {
        showFolderMissingModal(firstMissing.name || getBaseName(firstMissing.path), firstMissing.path || '');
      }
      logWarn('AutoSync', 'Nie znaleziono jednego lub więcej folderów z JSON-a projektu. Auto-Sync zostaje wyłączony do ręcznego wskazania ścieżek.');
      return false;
    }

    updateFolderSyncToggleAvailability(true, 'Auto-Sync gotowy.');
    return true;
  }

  function refreshFolderSyncReadiness(showAlerts) {
    return prepareFolderSyncFromProjectJson(showAlerts === true);
  }

  function projectTimerSwitchProject(info) {
    info = info || {};
    var key = info.key || 'unknown-project';
    if (projectTimerCurrentKey && projectTimerCurrentKey !== key) {
      projectTimerSaveCurrent();
    }
    projectTimerCurrentKey = key;
    projectTimerCurrentInfo = info;

    if (startupLoadingActive) { setPanelProgress(58, 'Wczytywanie ustawień projektu...'); }
    var data = projectSettingsRead(info);
    if (startupLoadingActive) { setPanelProgress(78, 'Przygotowywanie panelu...'); }
    projectTimerBaseMs = parseInt(data.timerMs, 10) || 0;
    projectTimerSessionStartedAt = Date.now();

    syncFolders = (data.folderSync && data.folderSync.folders) ? data.folderSync.folders : [];
    try {
      for (var ps = 0; ps < syncFolders.length; ps++) {
        if (syncFolders[ps].paused !== true) { syncFolders[ps].paused = false; }
        ensureFolderPortableInfo(syncFolders[ps]);
      }
    } catch (ePauseNorm) {}

    // Auto-Sync startuje jako OFF tylko na czas kontroli JSON-a i ścieżek.
    // Gdy wszystkie foldery są dostępne albo ścieżki zostaną naprawione po nazwie woluminu,
    // wtyczka sama włącza Auto-Sync i uruchamia synchronizację.
    stopFolderSyncTimer();
    setFolderSyncVisualState(false);
    if (data.folderSync) { data.folderSync.enabled = false; }
    renderSyncFolders();
    var autoSyncReady = prepareFolderSyncFromProjectJson(true);

    data = projectSettingsData || data;
    projectSettingsWrite(data);
    if (info.settingsPath) { logInfo('Timer', 'Wczytano ustawienia projektu: ' + info.settingsPath); }
    else { logWarn('Timer', 'Projekt nie ma jeszcze ścieżki .prproj — ustawienia będą zapisane po zapisaniu projektu.'); }

    // Auto-Sync włączamy tylko raz i dopiero na samym końcu wczytywania
    // ustawień projektu, po sprawdzeniu JSON-a i ewentualnej naprawie ścieżek.
    if (autoSyncReady) {
      setFolderSyncEnabled(true, true);
      logInfo('AutoSync', 'JSON projektu i ścieżki są OK — Auto-Sync został automatycznie włączony na końcu wczytywania projektu.');
    } else {
      setFolderSyncEnabled(false, true);
    }
  }

  function projectTimerGetProjectInfo(cb) {
    if (!cs) { cb({ key: 'unknown-project', name: 'Projekt Premiere', path: '' }); return; }
    try {
      evalScriptLogged('Project Timer', 'AEDRNO.getProjectTimerIdentity()', function (res) {
        var info = null;
        try { info = JSON.parse(res || '{}'); } catch (e) { info = null; }
        if (!info || !info.key) {
          info = { key: 'unknown-project', name: 'Projekt Premiere', path: '' };
        }
        cb(info);
      }, 'getProjectTimerIdentity', 'projectTimerIdentity', { quietDebug: !backgroundLogsEnabled });
    } catch (e2) {
      cb({ key: 'unknown-project', name: 'Projekt Premiere', path: '' });
    }
  }

  function projectTimerRefreshProjectIdentity() {
    projectTimerGetProjectInfo(function (info) {
      if (!projectTimerCurrentKey || projectTimerCurrentKey !== info.key) {
        projectTimerSwitchProject(info);
      } else {
        projectTimerCurrentInfo = info;
      }
    });
  }

  function startProjectTimer(onReady) {
    var el = byId('projectTimerText');
    if (!el) { if (onReady) { onReady(); } return; }

    function tickProjectTimer() {
      el.textContent = formatProjectElapsed(projectTimerNowMs());
    }

    if (projectTimerInterval) { clearInterval(projectTimerInterval); }
    if (projectTimerSaveInterval) { clearInterval(projectTimerSaveInterval); }
    if (projectTimerProjectCheckInterval) { clearInterval(projectTimerProjectCheckInterval); }

    projectTimerGetProjectInfo(function (info) {
      projectTimerSwitchProject(info);
      tickProjectTimer();
      projectTimerInterval = setInterval(tickProjectTimer, 1000);
      projectTimerSaveInterval = setInterval(projectTimerSaveCurrent, 5000);
      projectTimerProjectCheckInterval = setInterval(projectTimerRefreshProjectIdentity, 10000);
      if (onReady) { onReady(info); }
    });
  }

  window.addEventListener('beforeunload', function () {
    try { projectTimerSaveCurrent(); } catch (e) {}
  });

  /* ── Skan ── */
  function scan(silent, done) {
    if (!organizerAutoCheckEnabled) { if (done) { done(); } return; }
    saveSettings();
    var aeBinName = byId('aeBinName').value || 'AE Dynamic Relink';
    var nestBinName = byId('nestBinName').value || 'NEST';
    var externalBinEl = byId('externalBinName');
    var externalKeywordsEl = byId('externalKeywords');
    var externalBinName = externalBinEl ? (externalBinEl.value || 'External Extension') : 'External Extension';
    var keywords = byId('keywords').value || '';
    var nestKeywords = byId('nestKeywords').value || '';
    var externalKeywords = externalKeywordsEl ? (externalKeywordsEl.value || 'Atom,Motion Graphics Template Media,FireCut,Premiere Composer Files') : 'Atom,Motion Graphics Template Media,FireCut,Premiere Composer Files';
    var moveVideoNearAE = 'true';
    var moveNests = 'true';
    var moveExternal = 'true';
    var code = "AEDRNO.scanAndOrganize('" + esc(aeBinName) + "','" + esc(keywords) + "'," + moveVideoNearAE + ",'" + esc(nestBinName) + "','" + esc(nestKeywords) + "'," + moveNests + ",'" + esc(externalBinName) + "','" + esc(externalKeywords) + "'," + moveExternal + ")";
    if (!silent || backgroundLogsEnabled) {
      logDebug('Organizer', 'Parametry skanu: aeBin=' + aeBinName + ', nestBin=' + nestBinName + ', externalBin=' + externalBinName + ', keywords=' + keywords + ', nestKeywords=' + nestKeywords + ', externalKeywords=' + externalKeywords);
    }
    if (silent && backgroundLogsEnabled) { logSeparator('Organizer Auto-Check', 'START', 'background'); }
    evalScriptLogged('Organizer', code, function (res) {
      if (!silent || backgroundLogsEnabled) {
        logInfo('Organizer', res || 'Brak odpowiedzi z Premiere.');
      }
      if (silent && backgroundLogsEnabled) { logSeparator('Organizer Auto-Check', 'KONIEC', 'background'); }
      if (done) { done(); }
    }, 'scanAndOrganize', 'organizerScan', { quietDebug: silent && !backgroundLogsEnabled });
  }

  /* ── Timecode helpers ── */
  function getTcArgs() {
    return {
      mode: byId('tcSyncMode').value || 'clipsTc',
      offset: byId('tcOffset').value || '00:00:00:00',
      insertType: byId('tcInsertType').value || 'Both'
    };
  }

  function syncByTimecode(done) {
    saveSettings();
    var a = getTcArgs();
    var code = "AEDRNO.syncSelectedByTimecode('" + esc(a.mode) + "','" + esc(a.offset) + "','" + esc(a.insertType) + "')";
    logInfo('Timecode', 'Synchronizacja: wysyłam zaznaczone pliki do Premiere...');
    logDebug('Timecode', 'Parametry: mode=' + a.mode + ', offset=' + a.offset + ', insertType=' + a.insertType);
    evalScriptLogged('Timecode', code, function (res) {
      logInfo('Timecode', res || 'Brak odpowiedzi z Premiere.');
      if (done) { done(); }
    }, 'syncSelectedByTimecode', 'timecodeSync');
  }


  /* ── Dzielenie ekranu ── */
  function getSplitArgs() {
    return {
      x: parseInt(byId('splitX').value, 10) || 1,
      y: parseInt(byId('splitY').value, 10) || 1,
      gapX: parseFloat(byId('splitGapX').value) || 0,
      gapY: parseFloat(byId('splitGapY').value) || 0,
      mode: byId('splitMode').value || 'fill',
      orderByTracks: byId('splitOrderByTracks').checked ? 'true' : 'false'
    };
  }
  function updateSplitPreview() {
    var preview = byId('splitPreview');
    if (!preview) { return; }
    var cols = Math.max(1, Math.min(12, parseInt(byId('splitX').value, 10) || 1));
    var rows = Math.max(1, Math.min(12, parseInt(byId('splitY').value, 10) || 1));
    preview.innerHTML = '';
    preview.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
    preview.style.gridTemplateRows = 'repeat(' + rows + ', 1fr)';
    for (var i = 0; i < cols * rows; i++) {
      var cell = document.createElement('div');
      cell.className = 'split-preview-cell ' + (i % 2 === 0 ? 'light' : 'dark');
      preview.appendChild(cell);
    }
  }


  function applySplitScreen(done) {
    saveSettings();
    var a = getSplitArgs();
    var code = "AEDRNO.applySplitScreen(" + a.x + "," + a.y + "," + a.gapX + "," + a.gapY + ",'" + esc(a.mode) + "'," + a.orderByTracks + ")";
    logInfo('SplitScreen', 'Wysyłam zaznaczone klipy z timeline do Premiere...');
    logDebug('SplitScreen', 'Parametry: x=' + a.x + ', y=' + a.y + ', gapX=' + a.gapX + ', gapY=' + a.gapY + ', mode=' + a.mode + ', orderByTracks=' + a.orderByTracks);
    evalScriptLogged('SplitScreen', code, function (res) {
      logInfo('SplitScreen', res || 'Brak odpowiedzi z Premiere.');
      if (done) { done(); }
    }, 'applySplitScreen', 'splitScreenApply');
  }



  /* ── Transform Tools ── */
  function clampTransformShutterAngle(value) {
    var n = parseInt(value, 10);
    if (isNaN(n)) { n = 360; }
    n = Math.max(0, Math.min(360, n));
    return n;
  }

  function setTransformShutterAngle(value) {
    var n = clampTransformShutterAngle(value);
    var input = byId('transformShutterAngle');
    var valueEl = byId('transformShutterValue');
    if (input) { input.value = String(n); }
    if (valueEl) { valueEl.textContent = String(n); }
    try { localStorage.setItem(storagePrefix + 'transformShutterAngle', String(n)); } catch (e) {}
    return n;
  }

  function getTransformShutterAngle() {
    var input = byId('transformShutterAngle');
    return setTransformShutterAngle(input ? input.value : 360);
  }

  function openShutterModal() {
    var overlay = byId('shutterModalOverlay');
    var input = byId('shutterModalInput');
    if (!overlay || !input) { return; }
    input.value = String(getTransformShutterAngle());
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    setTimeout(function () {
      try { input.focus(); input.select(); } catch (ignore) {}
    }, 30);
  }

  function closeShutterModal(save) {
    var overlay = byId('shutterModalOverlay');
    var input = byId('shutterModalInput');
    if (save && input) {
      var n = setTransformShutterAngle(input.value);
      logInfo('Transform', 'Ustawiono Shutter Angle=' + n + '.');
    }
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
    }
  }

  function openCopyTextPositionModal(cb) {
    var overlay = byId('copyTextPositionModalOverlay');
    copyTextPositionChoiceCallback = typeof cb === 'function' ? cb : null;
    if (!overlay) {
      if (copyTextPositionChoiceCallback) { copyTextPositionChoiceCallback(false); }
      copyTextPositionChoiceCallback = null;
      return;
    }
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    setTimeout(function () {
      var noBtn = byId('copyTextPositionNo');
      try { if (noBtn) { noBtn.focus(); } } catch (ignore) {}
    }, 30);
  }

  function closeCopyTextPositionModal(copyPosition, runCopy) {
    var overlay = byId('copyTextPositionModalOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
    }
    var cb = copyTextPositionChoiceCallback;
    copyTextPositionChoiceCallback = null;
    if (runCopy !== false && cb) { cb(copyPosition === true); }
  }

  function initCopyTextPositionModal() {
    var yesBtn = byId('copyTextPositionYes');
    if (yesBtn) { yesBtn.onclick = function () { closeCopyTextPositionModal(true, true); }; }

    var noBtn = byId('copyTextPositionNo');
    if (noBtn) { noBtn.onclick = function () { closeCopyTextPositionModal(false, true); }; }

    var overlay = byId('copyTextPositionModalOverlay');
    if (overlay) {
      overlay.onclick = function (e) {
        e = e || window.event;
        if (e && e.target === overlay) { closeCopyTextPositionModal(false, false); }
      };
    }
  }

  function initTransformTools() {
    var stored = null;
    try { stored = localStorage.getItem(storagePrefix + 'transformShutterAngle'); } catch (e0) {}
    setTransformShutterAngle(stored !== null && stored !== undefined ? stored : 360);

    var shutterBtn = byId('transformShutterBtn');
    if (shutterBtn) { shutterBtn.onclick = openShutterModal; }

    var modalInput = byId('shutterModalInput');
    if (modalInput) {
      modalInput.onkeydown = function (e) {
        e = e || window.event;
        if (e && e.keyCode === 13) { closeShutterModal(true); }
        if (e && e.keyCode === 27) { closeShutterModal(false); }
      };
    }
    var saveBtn = byId('shutterModalSave');
    if (saveBtn) { saveBtn.onclick = function () { closeShutterModal(true); }; }
    var cancelBtn = byId('shutterModalCancel');
    if (cancelBtn) { cancelBtn.onclick = function () { closeShutterModal(false); }; }
    var overlay = byId('shutterModalOverlay');
    if (overlay) {
      overlay.onclick = function (e) {
        e = e || window.event;
        if (e && e.target === overlay) { closeShutterModal(false); }
      };
    }

    var btn = byId('transformSendKeysBtn');
    if (btn) {
      btn.onclick = function () {
        runPanelAction('Transform...', function (done) { transferMotionToTransform(done); }, 'Transform', 'manual');
      };
    }

    initCopyTextPositionModal();

    var copyTextBtn = byId('copyTextStyleBtn');
    if (copyTextBtn) {
      copyTextBtn.onclick = function () {
        openCopyTextPositionModal(function (copyPosition) {
          runPanelAction('CopyText...', function (done) { copyTextAttributes(done, copyPosition); }, 'CopyText', 'manual');
        });
      };
    }

    var pasteTextBtn = byId('pasteTextStyleBtn');
    if (pasteTextBtn) {
      pasteTextBtn.onclick = function () {
        runPanelAction('PasteText...', function (done) { pasteTextAttributes(done); }, 'PasteText', 'manual');
      };
    }

  }

  function transferMotionToTransform(done) {
    var angle = getTransformShutterAngle();
    var code = "AEDRNO.transferMotionToTransform(" + angle + ")";
    logInfo('Transform', 'Przenoszę keyframe’y z Motion do efektu Transform. Shutter Angle=' + angle + '.');
    evalScriptLogged('Transform', code, function (res) {
      logInfo('Transform', res || 'Brak odpowiedzi z Premiere.');
      if (done) { done(); }
    }, 'transferMotionToTransform', 'transformTransfer');
  }

  function copyTextAttributes(done, copyPosition) {
    var includePosition = copyPosition === true;
    logInfo('CopyText', 'CopyText: zapisuje projekt i szukam payloadu Source Text. Pozycja=' + (includePosition ? 'TAK' : 'NIE') + '.');
    evalScriptLogged('CopyText', 'AEDRNO.getTextBlobSelectionInfo()', function (res) {
      var info = parseJsonLoose(res);
      if (!info || !info.ok) {
        logWarn('CopyText', (info && info.error) ? info.error : 'Nie udalo sie pobrac zaznaczenia Type Tool.');
        if (done) { done(); }
        return;
      }
      try {
        var project = readPremiereProjectXml(info.projectPath);
        var records = parseTypeToolTextRecords(project.xml);
        var sourceClip = info.clips && info.clips.length ? info.clips[0] : null;
        var sourceRecord = findTextRecordForClip(sourceClip, records, {});
        if (!sourceRecord || !sourceRecord.base64) {
          logWarn('CopyText', 'CopyText: nie znalazlem Source Text blob w zapisanym projekcie dla zaznaczonego klipu. Rekordow Type Tool w projekcie=' + records.length + '.');
          if (done) { done(); }
          return;
        }
        copyTextBlobClipboard = {
          version: '1.12.240',
          copiedAt: new Date().getTime(),
          copyPosition: includePosition,
          projectPath: info.projectPath,
          sourceClip: sourceClip,
          sourceRecord: {
            objectId: sourceRecord.objectId,
            componentId: sourceRecord.componentId,
            paramId: sourceRecord.paramId,
            nodeId: sourceRecord.nodeId,
            start: sourceRecord.start,
            end: sourceRecord.end,
            textPreview: sourceRecord.textPreview,
            strings: sourceRecord.strings,
            layoutParams: sourceRecord.layoutParams
          },
          sourceBase64: sourceRecord.base64
        };
        logInfo('CopyText', 'CopyText OK: zapisano styl z "' + (sourceRecord.instanceName || sourceRecord.clipName || 'Graphic') + '" | pozycja=' + (includePosition ? 'TAK' : 'NIE') + ' | bytes=' + sourceRecord.bytes + ' | text="' + sourceRecord.textPreview + '" | strings=' + sourceRecord.strings.join(' | ') + '.');
        if (done) { done(); }
      } catch (e) {
        logError('CopyText', 'CopyText blad: ' + errorText(e));
        if (done) { done(); }
      }
    }, 'getTextBlobSelectionInfo', 'copyTextBlobSelection');
  }

  function pasteTextAttributes(done) {
    if (!copyTextBlobClipboard || !copyTextBlobClipboard.sourceBase64) {
      logWarn('PasteText', 'PasteText: najpierw uzyj CopyText.');
      if (done) { done(); }
      return;
    }
    var includePosition = copyTextBlobClipboard.copyPosition === true;
    logInfo('PasteText', 'PasteText: zapisuje projekt, zachowuje tekst docelowy i wklejam styl' + (includePosition ? ' razem z pozycja.' : '.'));
    evalScriptLogged('PasteText', 'AEDRNO.getTextBlobSelectionInfo()', function (res) {
      var info = parseJsonLoose(res);
      if (!info || !info.ok) {
        logWarn('PasteText', (info && info.error) ? info.error : 'Nie udalo sie pobrac zaznaczenia Type Tool.');
        if (done) { done(); }
        return;
      }
      try {
        var project = readPremiereProjectXml(info.projectPath);
        var records = parseTypeToolTextRecords(project.xml);
        var used = {};
        var patches = [];
        var logs = [];
        var clips = info.clips || [];
        for (var i = 0; i < clips.length; i++) {
          var targetRecord = findTextRecordForClip(clips[i], records, used);
          if (!targetRecord || !targetRecord.base64) {
            logs.push('skip #' + (i + 1) + ': brak Source Text blob dla zaznaczonego klipu start=' + (clips[i] ? clips[i].start : '?') + '.');
            continue;
          }
          var merged = mergeSourceTextBlob(copyTextBlobClipboard.sourceBase64, targetRecord.base64, includePosition);
          var layoutPatches = includePosition ? buildTextLayoutPatches(copyTextBlobClipboard.sourceRecord.layoutParams, targetRecord.layoutParams) : [];
          patches.push({
            index: i,
            paramId: targetRecord.paramId,
            oldBase64: targetRecord.base64,
            newBase64: merged.base64,
            newBytes: merged.bytes,
            layoutPatches: layoutPatches,
            targetText: merged.targetText,
            bytes: merged.bytes
          });
          logs.push('target #' + (i + 1) + ': text="' + merged.targetText + '" | pozycja=' + (includePosition ? ('zrodlo, parametry=' + layoutPatches.length) : 'target') + ' | sourceBytes=' + merged.sourceBytes + ' | targetBytes=' + merged.targetBytes + ' | outBytes=' + merged.bytes + '.');
        }
        if (!patches.length) {
          logWarn('PasteText', 'PasteText blob: nie przygotowalem zadnego payloadu. Rekordow Type Tool w projekcie=' + records.length + '.\n' + logs.join('\n'));
          if (done) { done(); }
          return;
        }
        var patched = patchPremiereProjectTextBlobs(info.projectPath, project, patches);
        logInfo('PasteText', 'PasteText prproj patch OK: podmieniono ' + patched.applied + '/' + patches.length + ' payloadow w pliku projektu. Tryb=' + (includePosition ? 'styl+pozycja' : 'tylko styl') + '. Layout=' + (patched.layoutApplied || 0) + '. Backup: ' + patched.backupPath + '. Otwieram projekt ponownie.\nPasteText prepare:\n' + logs.join('\n'));
        var reopenCode = 'AEDRNO.reopenProjectAfterTextBlobPatch(' + extendScriptStringLiteral(info.projectPath) + ')';
        evalScriptLogged('PasteText', reopenCode, function (reopenRes) {
          logInfo('PasteText', reopenRes || 'Brak odpowiedzi z Premiere przy ponownym otwarciu projektu.');
          if (done) { done(); }
        }, 'reopenProjectAfterTextBlobPatch', 'pasteTextProjectReopen');
      } catch (e) {
        logError('PasteText', 'PasteText prproj patch blad: ' + errorText(e));
        if (done) { done(); }
      }
    }, 'getTextBlobSelectionInfo', 'pasteTextBlobSelection');
  }

  function getNodeBufferCtor() {
    var req = getNodeRequire();
    if (!req) { throw new Error('Brak Node require w panelu CEP. Nie moge czytac .prproj.'); }
    try { return req('buffer').Buffer; } catch (e0) {}
    try { if (typeof Buffer !== 'undefined') { return Buffer; } } catch (e1) {}
    throw new Error('Brak Buffer w panelu CEP.');
  }

  function readPremiereProjectXml(projectPath) {
    var req = getNodeRequire();
    if (!req) { throw new Error('Brak Node require w panelu CEP. Nie moge czytac .prproj.'); }
    var fs = req('fs');
    var zlib = req('zlib');
    var buffer = fs.readFileSync(projectPath);
    var isGzip = buffer && buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
    if (isGzip) { buffer = zlib.gunzipSync(buffer); }
    return { xml: buffer.toString('utf8'), compressed: isGzip };
  }

  function writePremiereProjectXml(projectPath, xml, compressed) {
    var req = getNodeRequire();
    if (!req) { throw new Error('Brak Node require w panelu CEP. Nie moge zapisac .prproj.'); }
    var fs = req('fs');
    var zlib = req('zlib');
    var BufferCtor = getNodeBufferCtor();
    var data = BufferCtor.from ? BufferCtor.from(String(xml || ''), 'utf8') : new BufferCtor(String(xml || ''), 'utf8');
    if (compressed) { data = zlib.gzipSync(data); }
    fs.writeFileSync(projectPath, data);
  }

  function copyProjectBackup(projectPath) {
    var req = getNodeRequire();
    if (!req) { throw new Error('Brak Node require w panelu CEP. Nie moge zrobic backupu .prproj.'); }
    var fs = req('fs');
    var path = req('path');
    var parsed = path.parse(projectPath);
    var stamp = formatCompactDate(new Date());
    var backupPath = path.join(parsed.dir, parsed.name + '_verni_textpaste_backup_' + stamp + parsed.ext);
    fs.copyFileSync(projectPath, backupPath);
    return backupPath;
  }

  function formatCompactDate(d) {
    function z(n) { return n < 10 ? ('0' + n) : String(n); }
    return String(d.getFullYear()) + z(d.getMonth() + 1) + z(d.getDate()) + '_' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds());
  }

  function patchPremiereProjectTextBlobs(projectPath, project, patches) {
    var backupPath = copyProjectBackup(projectPath);
    var xml = String(project.xml || '');
    var applied = 0;
    var layoutApplied = 0;
    for (var i = 0; i < patches.length; i++) {
      var patch = patches[i];
      var result = replaceSourceTextParamBlob(xml, patch.paramId, patch.oldBase64, patch.newBase64, patch.newBytes);
      xml = result.xml;
      if (result.changed) { applied += 1; }
      var layoutPatches = patch.layoutPatches || [];
      for (var lp = 0; lp < layoutPatches.length; lp++) {
        var layoutResult = replaceComponentParamStartKeyframe(xml, layoutPatches[lp]);
        xml = layoutResult.xml;
        if (layoutResult.changed) { layoutApplied += 1; }
      }
    }
    if (!applied) { throw new Error('Nie podmieniono zadnego Source Text blob w pliku projektu. Backup: ' + backupPath); }
    writePremiereProjectXml(projectPath, xml, project.compressed);
    return { applied: applied, layoutApplied: layoutApplied, backupPath: backupPath };
  }

  function replaceSourceTextParamBlob(xml, paramId, oldBase64, newBase64, newBytes) {
    var paramRe = new RegExp('(<ArbVideoComponentParam\\b[^>]*\\bObjectID="' + escapeRegex(paramId) + '"[^>]*>[\\s\\S]*?<\\/ArbVideoComponentParam>)');
    var match = paramRe.exec(xml);
    if (!match) { return { xml: xml, changed: false }; }
    var block = match[1];
    var changed = false;
    var nextBlock = block.replace(/<StartKeyframeValue\b([^>]*)>([\s\S]*?)<\/StartKeyframeValue>/, function (full, attrs, value) {
      var cleaned = String(value || '').replace(/\s+/g, '');
      if (oldBase64 && cleaned !== String(oldBase64 || '').replace(/\s+/g, '')) { return full; }
      changed = true;
      var hashMatch = String(attrs || '').match(/\bBinaryHash="([^"]*)"/);
      var newHash = buildTextBlobBinaryHash(hashMatch ? hashMatch[1] : '', newBytes);
      var nextAttrs = String(attrs || '');
      if (hashMatch) { nextAttrs = nextAttrs.replace(/\bBinaryHash="[^"]*"/, 'BinaryHash="' + newHash + '"'); }
      else { nextAttrs += ' BinaryHash="' + newHash + '"'; }
      return '<StartKeyframeValue' + nextAttrs + '>' + newBase64 + '</StartKeyframeValue>';
    });
    if (!changed) { return { xml: xml, changed: false }; }
    return { xml: xml.substring(0, match.index) + nextBlock + xml.substring(match.index + block.length), changed: true };
  }

  function replaceComponentParamStartKeyframe(xml, patch) {
    if (!patch || !patch.targetParamId || !patch.startKeyframe) { return { xml: xml, changed: false }; }
    var tagName = patch.targetTagName || 'VideoComponentParam';
    var paramRe = new RegExp('(<' + escapeRegex(tagName) + '\\b[^>]*\\bObjectID="' + escapeRegex(patch.targetParamId) + '"[^>]*>[\\s\\S]*?<\\/' + escapeRegex(tagName) + '>)');
    var match = paramRe.exec(xml);
    if (!match) { return { xml: xml, changed: false }; }
    var block = match[1];
    var changed = false;
    var nextBlock = block.replace(/<StartKeyframe\b[^>]*>[\s\S]*?<\/StartKeyframe>/, function () {
      changed = true;
      return '<StartKeyframe>' + patch.startKeyframe + '</StartKeyframe>';
    });
    if (!changed) { return { xml: xml, changed: false }; }
    return { xml: xml.substring(0, match.index) + nextBlock + xml.substring(match.index + block.length), changed: true };
  }

  function buildTextBlobBinaryHash(oldHash, byteLength) {
    var suffixValue = Number(byteLength || 0) + 12;
    var suffix = Math.max(0, suffixValue).toString(16);
    while (suffix.length < 8) { suffix = '0' + suffix; }
    if (suffix.length > 8) { suffix = suffix.substring(suffix.length - 8); }
    oldHash = String(oldHash || '');
    if (/^[0-9a-fA-F-]{28}[0-9a-fA-F]{8}$/.test(oldHash)) {
      return oldHash.substring(0, oldHash.length - 8) + suffix;
    }
    return '00000000-0000-0000-0000-0000' + suffix;
  }

  function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function decodeXmlEntities(text) {
    return String(text || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }

  function extractFirstTagValue(block, tagName) {
    var re = new RegExp('<' + tagName + '\\b[^>]*>([\\s\\S]*?)<\\/' + tagName + '>');
    var m = re.exec(block || '');
    return m ? decodeXmlEntities(m[1]) : '';
  }

  function extractFirstObjectRef(block, tagName) {
    var re = new RegExp('<' + tagName + '\\b[^>]*ObjectRef="([^"]+)"[^>]*>');
    var m = re.exec(block || '');
    return m ? m[1] : '';
  }

  function buildObjectBlockMap(xml, tagName) {
    var map = {};
    var re = new RegExp('<' + tagName + '\\b[^>]*\\bObjectID="([^"]+)"[^>]*>[\\s\\S]*?<\\/' + tagName + '>', 'g');
    var m;
    while ((m = re.exec(xml)) !== null) {
      map[m[1]] = m[0];
    }
    return map;
  }

  function getObjectBlockByTagMaps(maps, objectId) {
    for (var i = 0; i < maps.length; i++) {
      if (maps[i].map && maps[i].map[objectId]) { return { tagName: maps[i].tagName, block: maps[i].map[objectId] }; }
    }
    return null;
  }

  function extractComponentRefs(chainBlock) {
    var refs = [];
    var re = /<Component\b[^>]*\bObjectRef="([^"]+)"[^>]*>/g;
    var m;
    while ((m = re.exec(chainBlock || '')) !== null) { refs.push(m[1]); }
    return refs;
  }

  function extractParamRef(componentBlock, index) {
    var re = new RegExp('<Param\\b[^>]*\\bIndex="' + index + '"[^>]*\\bObjectRef="([^"]+)"[^>]*>');
    var m = re.exec(componentBlock || '');
    return m ? m[1] : '';
  }

  function extractParamRefs(componentBlock) {
    var refs = [];
    var re = /<Param\b[^>]*\bIndex="([^"]+)"[^>]*\bObjectRef="([^"]+)"[^>]*>/g;
    var m;
    while ((m = re.exec(componentBlock || '')) !== null) {
      refs.push({ index: Number(m[1]), objectRef: m[2] });
    }
    return refs;
  }

  function extractStartKeyframe(paramBlock) {
    var m = /<StartKeyframe\b[^>]*>([\s\S]*?)<\/StartKeyframe>/.exec(paramBlock || '');
    return m ? String(m[1] || '').replace(/\s+/g, '') : '';
  }

  function extractBase64SourceText(paramBlock) {
    var re = /<StartKeyframeValue\b[^>]*\bEncoding="base64"[^>]*>([\s\S]*?)<\/StartKeyframeValue>/;
    var m = re.exec(paramBlock || '');
    return m ? String(m[1] || '').replace(/\s+/g, '') : '';
  }

  function shouldCopyTextLayoutParam(index, name) {
    name = String(name || '').replace(/^\s+|\s+$/g, '').toLowerCase();
    if (index === 2 || index === 3 || index === 4 || index === 5 || index === 6 || index === 8) { return true; }
    return name === 'position' || name === 'scale' || name === 'horizontal scale' || name === 'rotation' || name === 'anchor point';
  }

  function readTextLayoutParams(componentBlock, paramMaps) {
    var out = [];
    var refs = extractParamRefs(componentBlock);
    for (var i = 0; i < refs.length; i++) {
      var ref = refs[i];
      var found = getObjectBlockByTagMaps(paramMaps, ref.objectRef);
      if (!found) { continue; }
      var name = decodeXmlEntities(extractFirstTagValue(found.block, 'Name'));
      if (!shouldCopyTextLayoutParam(ref.index, name)) { continue; }
      var startKeyframe = extractStartKeyframe(found.block);
      if (!startKeyframe) { continue; }
      out.push({
        index: ref.index,
        name: name,
        paramId: ref.objectRef,
        tagName: found.tagName,
        startKeyframe: startKeyframe
      });
    }
    return out;
  }

  function buildTextLayoutPatches(sourceParams, targetParams) {
    var patches = [];
    sourceParams = sourceParams || [];
    targetParams = targetParams || [];
    for (var i = 0; i < sourceParams.length; i++) {
      var src = sourceParams[i];
      var target = null;
      for (var t = 0; t < targetParams.length; t++) {
        if (targetParams[t].index === src.index) { target = targetParams[t]; break; }
      }
      if (!target) { continue; }
      patches.push({
        index: src.index,
        name: src.name,
        targetParamId: target.paramId,
        targetTagName: target.tagName,
        startKeyframe: src.startKeyframe
      });
    }
    return patches;
  }

  function parseTypeToolTextRecords(xml) {
    var records = [];
    var clipRe = /<VideoClipTrackItem\b[^>]*\bObjectID="([^"]+)"[^>]*>[\s\S]*?<\/VideoClipTrackItem>/g;
    var chains = buildObjectBlockMap(xml, 'VideoComponentChain');
    var components = buildObjectBlockMap(xml, 'VideoFilterComponent');
    var params = buildObjectBlockMap(xml, 'ArbVideoComponentParam');
    var paramMaps = [
      { tagName: 'ArbVideoComponentParam', map: params },
      { tagName: 'VideoComponentParam', map: buildObjectBlockMap(xml, 'VideoComponentParam') },
      { tagName: 'PointComponentParam', map: buildObjectBlockMap(xml, 'PointComponentParam') }
    ];
    var m;
    while ((m = clipRe.exec(xml)) !== null) {
      var clipBlock = m[0];
      var clipObjectId = m[1];
      var chainId = extractFirstObjectRef(clipBlock, 'Components');
      var chainBlock = chains[chainId];
      if (!chainBlock) { continue; }
      var componentRefs = extractComponentRefs(chainBlock);
      var startText = extractFirstTagValue(clipBlock, 'Start');
      var endText = extractFirstTagValue(clipBlock, 'End');
      var start = startText ? Number(startText) : 0;
      var end = endText ? Number(endText) : 0;
      var nodeId = extractFirstTagValue(clipBlock, 'ID');
      for (var c = 0; c < componentRefs.length; c++) {
        var componentBlock = components[componentRefs[c]];
        if (!componentBlock) { continue; }
        if (extractFirstTagValue(componentBlock, 'MatchName') !== 'AE.ADBE Text') { continue; }
        var paramId = extractParamRef(componentBlock, 0);
        var paramBlock = params[paramId];
        var base64 = extractBase64SourceText(paramBlock);
        if (!base64) { continue; }
        var blob = decodeBase64Buffer(base64);
        var tail = extractSourceTextTail(blob);
        records.push({
          clipObjectId: clipObjectId,
          componentId: componentRefs[c],
          paramId: paramId,
          chainId: chainId,
          nodeId: nodeId,
          start: start,
          end: end,
          instanceName: extractFirstTagValue(componentBlock, 'InstanceName'),
          clipName: 'Graphic',
          parentStyle: extractFirstObjectURef(componentBlock, 'ParentStyle'),
          base64: base64,
          bytes: blob.length,
          textPreview: tail ? bufferUtf8(blob, tail.textStart, tail.textEnd) : '',
          strings: extractBlobStrings(blob),
          layoutParams: readTextLayoutParams(componentBlock, paramMaps)
        });
      }
    }
    return records;
  }

  function extractFirstObjectURef(block, tagName) {
    var re = new RegExp('<' + tagName + '\\b[^>]*ObjectURef="([^"]+)"[^>]*>');
    var m = re.exec(block || '');
    return m ? m[1] : '';
  }

  function decodeBase64Buffer(base64) {
    var BufferCtor = getNodeBufferCtor();
    if (BufferCtor.from) { return BufferCtor.from(String(base64 || ''), 'base64'); }
    return new BufferCtor(String(base64 || ''), 'base64');
  }

  function allocNodeBuffer(length) {
    var BufferCtor = getNodeBufferCtor();
    if (BufferCtor.alloc) { return BufferCtor.alloc(length); }
    var b = new BufferCtor(length);
    for (var i = 0; i < length; i++) { b[i] = 0; }
    return b;
  }

  function bufferConcat(parts) {
    var BufferCtor = getNodeBufferCtor();
    if (BufferCtor.concat) { return BufferCtor.concat(parts); }
    var total = 0;
    for (var i = 0; i < parts.length; i++) { total += parts[i].length; }
    var out = allocNodeBuffer(total);
    var pos = 0;
    for (var p = 0; p < parts.length; p++) {
      parts[p].copy(out, pos);
      pos += parts[p].length;
    }
    return out;
  }

  function bufferUtf8(buffer, start, end) {
    try { return buffer.slice(start, end).toString('utf8').replace(/\r/g, '\\r').replace(/\n/g, '\\n'); } catch (e) {}
    return '';
  }

  function extractSourceTextTail(buffer) {
    if (!buffer || buffer.length < 16) { return null; }
    var min = Math.max(0, buffer.length - 8192);
    for (var offset = buffer.length - 4; offset >= min; offset--) {
      if (offset + 4 > buffer.length) { continue; }
      var len;
      try { len = buffer.readUInt32LE(offset); } catch (e0) { continue; }
      if (len < 0 || len > buffer.length) { continue; }
      var textStart = offset + 4;
      var textEnd = textStart + len;
      if (textEnd > buffer.length) { continue; }
      var pad = buffer.length - textEnd;
      if (pad < 0 || pad > 3) { continue; }
      var okPad = true;
      for (var p = 0; p < pad; p++) {
        if (buffer[textEnd + p] !== 0) { okPad = false; break; }
      }
      if (!okPad) { continue; }
      return { lenOffset: offset, textStart: textStart, textEnd: textEnd, length: len, pad: pad };
    }
    return null;
  }

  function extractBlobStrings(buffer) {
    var out = [];
    var current = '';
    function flush() {
      if (current.length >= 3) { out.push(current); }
      current = '';
    }
    for (var i = 0; i < buffer.length; i++) {
      var ch = buffer[i];
      if (ch >= 32 && ch <= 126) { current += String.fromCharCode(ch); }
      else { flush(); }
    }
    flush();
    if (out.length > 8) { out = out.slice(0, 8); }
    return out;
  }

  function findTextRecordForClip(clip, records, used) {
    if (!clip || !records || !records.length) { return null; }
    used = used || {};
    var nodeId = clip.nodeId ? String(clip.nodeId) : '';
    if (nodeId) {
      for (var n = 0; n < records.length; n++) {
        if (used[n]) { continue; }
        if (records[n].nodeId && String(records[n].nodeId) === nodeId) {
          used[n] = true;
          return records[n];
        }
      }
    }
    var start = Number(clip.start || 0);
    var end = Number(clip.end || 0);
    for (var i = 0; i < records.length; i++) {
      if (used[i]) { continue; }
      if (Number(records[i].start || 0) === start && Number(records[i].end || 0) === end) {
        used[i] = true;
        return records[i];
      }
    }
    for (var j = 0; j < records.length; j++) {
      if (used[j]) { continue; }
      if (Number(records[j].start || 0) === start) {
        used[j] = true;
        return records[j];
      }
    }
    return null;
  }

  function mergeSourceTextBlob(sourceBase64, targetBase64, copyPosition) {
    var source = decodeBase64Buffer(sourceBase64);
    var target = decodeBase64Buffer(targetBase64);
    var srcTail = extractSourceTextTail(source);
    var dstTail = extractSourceTextTail(target);
    if (!srcTail) { throw new Error('Nie znalazlem tekstowej koncowki w Source Text z Copy.'); }
    if (!dstTail) { throw new Error('Nie znalazlem tekstowej koncowki w Source Text celu.'); }

    var targetText = target.slice(dstTail.textStart, dstTail.textEnd);
    var lenBuf = allocNodeBuffer(4);
    lenBuf.writeUInt32LE(targetText.length, 0);
    var padLen = (4 - (targetText.length % 4)) % 4;
    var pad = allocNodeBuffer(padLen);
    var out = bufferConcat([source.slice(0, srcTail.lenOffset), lenBuf, targetText, pad]);
    if (out.length >= 4) { out.writeUInt32LE(Math.max(0, out.length - 12), 0); }

    // These bytes track text box metrics. Default keeps target position; optional mode keeps source position.
    if (copyPosition !== true) {
      var outMetrics = findTextMetricsOffset(out);
      var targetMetrics = findTextMetricsOffset(target);
      if (outMetrics >= 0 && targetMetrics >= 0 && targetMetrics + 8 <= target.length && outMetrics + 8 <= out.length) {
        target.copy(out, outMetrics, targetMetrics, targetMetrics + 8);
      }
    }

    return {
      base64: out.toString('base64'),
      bytes: out.length,
      sourceBytes: source.length,
      targetBytes: target.length,
      targetText: bufferUtf8(target, dstTail.textStart, dstTail.textEnd)
    };
  }

  function findTextMetricsOffset(buffer) {
    if (!buffer || buffer.length < 140) { return -1; }
    var max = Math.min(buffer.length - 16, 0x180);
    for (var offset = 0x80; offset <= max; offset += 4) {
      var a, b, c;
      try {
        a = buffer.readInt32LE(offset);
        b = buffer.readInt32LE(offset + 4);
        c = buffer.readInt32LE(offset + 8);
      } catch (e0) { continue; }
      if (a < 0 && b < 0 && c < 0 && b - a === 4 && c - b === 4) {
        return Math.max(0, offset - 8);
      }
    }
    return -1;
  }

  /* ── MULTI-NEST loader ── */
  function buildMultiNestEnsureModuleScript() {
    var root = getExtensionRootPath();
    var hostPath = root ? (root + '/jsx/host.jsx') : '';
    var modulePath = root ? (root + '/jsx/modules/multi_nest.jsx') : '';

    // v1.12.192: top-level direct loader for MULTI-NEST.
    // host.jsx loads modules from inside its own helper function, and ExtendScript can keep
    // `var AEDRNO = AEDRNO || {}` local to that evalFile call. Direct module load here makes
    // AEDRNO.multiNestSelectedClips persistent before we run the function.
    return "var __verniMultiNestLoaderLogs=[];" +
      "function __verniMultiNestLog(m){try{__verniMultiNestLoaderLogs.push(String(m));}catch(_e){}}" +
      "function __verniMultiNestErr(e){var o='';try{if(e&&e.name){o+=e.name+': ';}}catch(_e1){}try{o+=(e&&e.message)?e.message:String(e);}catch(_e2){o+='Unknown error';}try{if(e&&e.line){o+=' | line: '+e.line;}}catch(_e3){}return o;}" +
      "try{var __host=" + extendScriptStringLiteral(hostPath) + "; if(__host){$.evalFile(new File(__host)); __verniMultiNestLog('Loader: host.jsx reload OK');}else{__verniMultiNestLog('WARN Loader: extension root path is empty');}}catch(e){__verniMultiNestLog('ERROR Loader host.jsx: '+__verniMultiNestErr(e));}" +
      "try{var __module=" + extendScriptStringLiteral(modulePath) + "; if(__module && (typeof AEDRNO==='undefined' || !AEDRNO || !AEDRNO.multiNestSelectedClips || !AEDRNO.undoLastMultiNestByHistory || !AEDRNO.multiNestNativeContinue)){$.evalFile(new File(__module)); __verniMultiNestLog('Loader: multi_nest.jsx direct load OK');}}catch(e2){__verniMultiNestLog('ERROR Loader multi_nest.jsx: '+__verniMultiNestErr(e2));}" +
      "try{if(typeof AEDRNO!=='undefined' && AEDRNO && AEDRNO._moduleLoadErrors && AEDRNO._moduleLoadErrors.length){__verniMultiNestLog('MODULE LOAD ERRORS: '+AEDRNO._moduleLoadErrors.join(' || '));}}catch(e3){__verniMultiNestLog('WARN cannot read module load errors: '+__verniMultiNestErr(e3));}" +
      "try{if(typeof AEDRNO==='undefined' || !AEDRNO || !AEDRNO.multiNestSelectedClips || !AEDRNO.undoLastMultiNestByHistory || !AEDRNO.multiNestNativeContinue || !AEDRNO.multiNestUndoPrepareOne){__verniMultiNestLog('FATAL: MULTI-NEST functions are still missing after forced reload.');}else{__verniMultiNestLog('Loader: MULTI-NEST functions OK');}}catch(e4){__verniMultiNestLog('FATAL verify multi nest module: '+__verniMultiNestErr(e4));}" +
      "__verniMultiNestLoaderLogs.join('\\n');";
  }

  /* ── Media Offline Relink ── */
  function buildMediaOfflineEnsureModuleScript() {
    var root = getExtensionRootPath();
    var hostPath = root ? (root + '/jsx/host.jsx') : '';
    var modulePath = root ? (root + '/jsx/modules/media_offline_relink.jsx') : '';

    // v1.12.181: top-level loader. Do not wrap this in a function, otherwise ExtendScript
    // can load module variables into the wrapper scope only.
    return "var __verniMediaOfflineLoaderLogs=[];" +
      "function __verniMediaOfflineLog(m){try{__verniMediaOfflineLoaderLogs.push(String(m));}catch(_e){}}" +
      "function __verniMediaOfflineErr(e){var o='';try{if(e&&e.name){o+=e.name+': ';}}catch(_e1){}try{o+=(e&&e.message)?e.message:String(e);}catch(_e2){o+='Unknown error';}try{if(e&&e.line){o+=' | line: '+e.line;}}catch(_e3){}return o;}" +
      "try{var __host=" + extendScriptStringLiteral(hostPath) + "; if(__host){$.evalFile(new File(__host)); __verniMediaOfflineLog('Loader: host.jsx reload OK');}else{__verniMediaOfflineLog('WARN Loader: extension root path is empty');}}catch(e){__verniMediaOfflineLog('ERROR Loader host.jsx: '+__verniMediaOfflineErr(e));}" +
      "try{var __module=" + extendScriptStringLiteral(modulePath) + "; if(__module && (typeof AEDRNO==='undefined' || !AEDRNO || !AEDRNO.getOfflineMediaListForCEP || !AEDRNO.relinkOfflineMediaFromMap)){$.evalFile(new File(__module)); __verniMediaOfflineLog('Loader: media_offline_relink.jsx direct load OK');}}catch(e2){__verniMediaOfflineLog('ERROR Loader media_offline_relink.jsx: '+__verniMediaOfflineErr(e2));}" +
      "try{if(typeof AEDRNO!=='undefined' && AEDRNO && AEDRNO._moduleLoadErrors && AEDRNO._moduleLoadErrors.length){__verniMediaOfflineLog('MODULE LOAD ERRORS: '+AEDRNO._moduleLoadErrors.join(' || '));}}catch(e3){__verniMediaOfflineLog('WARN cannot read module load errors: '+__verniMediaOfflineErr(e3));}" +
      "try{if(typeof AEDRNO==='undefined' || !AEDRNO || !AEDRNO.getOfflineMediaListForCEP || !AEDRNO.relinkOfflineMediaFromMap){__verniMediaOfflineLog('FATAL: MEDIA OFFLINE functions are still missing after forced reload.');}else{__verniMediaOfflineLog('Loader: MEDIA OFFLINE functions OK');}}catch(e4){__verniMediaOfflineLog('FATAL verify media offline module: '+__verniMediaOfflineErr(e4));}" +
      "__verniMediaOfflineLoaderLogs.join('\\n');";
  }

  function parseJsonLoose(text) {
    try { return JSON.parse(String(text || '{}')); } catch (e1) {}
    return null;
  }

  function getNodeRequire() {
    try { if (typeof require === 'function') { return require; } } catch (e1) {}
    try { if (window && typeof window.require === 'function') { return window.require; } } catch (e2) {}
    return null;
  }

  function normalizeFsPath(path) {
    return String(path || '').replace(/\\/g, '/');
  }

  function mediaOfflineShouldSkipFolder(path, name) {
    var p = normalizeFsPath(path);
    var lp = p.toLowerCase();
    var n = String(name || '').toLowerCase();
    function hasSegment(seg) { return ('/' + lp + '/').indexOf('/' + seg + '/') >= 0; }
    if (!p || n === '.' || n === '..') { return true; }

    // v1.12.183: do not enter hidden/system/cache/symlink-heavy trees. This fixes loops like
    // /Users/.../Library/Trial/.../_refs/revlinks/link-... repeating forever and eating the scan limit.
    if (n.charAt(0) === '.' && n !== '.localized') { return true; }
    if (n === '.spotlight-v100' || n === '.fseventsd' || n === '.trashes' || n === '.trash' || n === '.temporaryitems' || n === '.documentrevisions-v100') { return true; }
    if (n === '$recycle.bin' || n === 'system volume information' || n === 'recovery' || n === 'recycler') { return true; }
    if (n === '__macosx' || n === 'node_modules' || n === '.git' || n === '.svn') { return true; }
    if (n === 'cache' || n === 'caches' || n === 'logs' || n === 'tmp' || n === 'temp') { return true; }
    if (n === 'revlinks' || n === '_refs' || n === 'trial' || n === 'treatments') { return true; }

    // macOS root/system areas.
    if (lp === '/system' || lp.indexOf('/system/') === 0) { return true; }
    if (lp === '/library' || lp.indexOf('/library/') === 0) { return true; }
    if (lp === '/biblioteki' || lp.indexOf('/biblioteki/') === 0) { return true; }
    if (lp === '/applications' || lp.indexOf('/applications/') === 0) { return true; }
    if (lp === '/private' || lp.indexOf('/private/') === 0) { return true; }
    if (lp === '/usr' || lp.indexOf('/usr/') === 0) { return true; }
    if (lp === '/bin' || lp.indexOf('/bin/') === 0) { return true; }
    if (lp === '/sbin' || lp.indexOf('/sbin/') === 0) { return true; }
    if (lp === '/cores' || lp.indexOf('/cores/') === 0) { return true; }
    if (lp === '/dev' || lp.indexOf('/dev/') === 0) { return true; }
    if (lp === '/network' || lp.indexOf('/network/') === 0) { return true; }

    // macOS user Library is also a system/cache area for this tool; it produced huge permission errors
    // and revlink loops, so MEDIA OFFLINE must skip it during quick relink search.
    if (/^\/users\/[^\/]+\/library(\/|$)/.test(lp)) { return true; }
    if (/^\/users\/[^\/]+\/biblioteki(\/|$)/.test(lp)) { return true; }

    // Windows root/system areas.
    if (/^[a-z]:\/windows(\/|$)/.test(lp)) { return true; }
    if (/^[a-z]:\/program files(\/|$)/.test(lp)) { return true; }
    if (/^[a-z]:\/program files \(x86\)(\/|$)/.test(lp)) { return true; }
    if (/^[a-z]:\/programdata(\/|$)/.test(lp)) { return true; }
    if (/^[a-z]:\/\$windows\.~/.test(lp)) { return true; }
    if (/^[a-z]:\/perflogs(\/|$)/.test(lp)) { return true; }
    if (hasSegment('appdata') || hasSegment('node_modules') || hasSegment('.git') || hasSegment('cache') || hasSegment('caches')) { return true; }
    return false;
  }

  function mediaOfflineAddRoot(out, seen, fs, pathValue) {
    if (!pathValue) { return; }
    var raw = String(pathValue || '');
    var key = normalizeFsPath(raw).replace(/\/$/, '').toLowerCase();
    if (!key || seen[key]) { return; }
    try {
      if (fs.existsSync(raw)) {
        seen[key] = true;
        out.push(raw);
      }
    } catch (e) {}
  }

  function mediaOfflineDirname(pathMod, filePath) {
    try { return pathMod.dirname(String(filePath || '')); } catch (e) { return ''; }
  }

  function mediaOfflineGetScanRoots(fs, pathMod, osMod, offlineList) {
    var roots = [];
    var seen = {};
    var platform = '';
    try { platform = osMod && osMod.platform ? osMod.platform() : ''; } catch (ignore) {}

    // Highest priority: folders near the old offline paths. Example:
    // old=/Users/krygor/Desktop/media offline.png -> scan Desktop first, then home.
    for (var oi = 0; oi < (offlineList || []).length; oi++) {
      var oldPath = String((offlineList[oi] && (offlineList[oi].oldPath || offlineList[oi].path || offlineList[oi].mediaPath)) || '');
      var oldDir = mediaOfflineDirname(pathMod, oldPath);
      if (oldDir && !mediaOfflineShouldSkipFolder(oldDir, pathMod.basename(oldDir))) { mediaOfflineAddRoot(roots, seen, fs, oldDir); }
      var parent = oldDir ? mediaOfflineDirname(pathMod, oldDir) : '';
      if (parent && !mediaOfflineShouldSkipFolder(parent, pathMod.basename(parent))) { mediaOfflineAddRoot(roots, seen, fs, parent); }
    }

    if (platform === 'win32') {
      var homeWin = '';
      try { homeWin = osMod.homedir ? osMod.homedir() : ''; } catch (e0) {}
      if (homeWin) {
        var commonWin = ['Desktop', 'Downloads', 'Documents', 'Videos', 'Pictures', 'Music'];
        for (var wi = 0; wi < commonWin.length; wi++) { mediaOfflineAddRoot(roots, seen, fs, pathMod.join(homeWin, commonWin[wi])); }
        mediaOfflineAddRoot(roots, seen, fs, homeWin);
      }
      for (var c = 67; c <= 90; c++) {
        var drive = String.fromCharCode(c) + ':\\';
        mediaOfflineAddRoot(roots, seen, fs, drive);
      }
    } else {
      var home = '';
      try { home = osMod.homedir ? osMod.homedir() : ''; } catch (e1) {}
      if (home) {
        var common = ['Desktop', 'Downloads', 'Documents', 'Movies', 'Pictures', 'Music', 'Creative Cloud Files'];
        for (var hi = 0; hi < common.length; hi++) { mediaOfflineAddRoot(roots, seen, fs, pathMod.join(home, common[hi])); }
        mediaOfflineAddRoot(roots, seen, fs, home);
      }
      try {
        if (fs.existsSync('/Volumes')) {
          var vols = fs.readdirSync('/Volumes');
          for (var i = 0; i < vols.length; i++) {
            var vp = pathMod.join('/Volumes', vols[i]);
            var n = String(vols[i] || '').toLowerCase();
            if (n === 'macintosh hd' || n === 'macintosh hd - data') { continue; }
            if (mediaOfflineShouldSkipFolder(vp, vols[i])) { continue; }
            try { if (fs.statSync(vp).isDirectory()) { mediaOfflineAddRoot(roots, seen, fs, vp); } } catch (ignore3) {}
          }
        }
      } catch (e3) {}
      if (!roots.length) { mediaOfflineAddRoot(roots, seen, fs, '/Users'); }
    }
    return roots;
  }

  function scanOfflineMediaInCEP(offlineList, progressDone, finalCallback) {
    var req = getNodeRequire();
    if (!req) { finalCallback({ ok: false, error: 'Node require is not available in CEP panel.', map: {}, stats: {} }); return; }
    var fs, pathMod, osMod;
    try { fs = req('fs'); pathMod = req('path'); osMod = req('os'); } catch (e0) { finalCallback({ ok: false, error: 'Cannot load Node fs/path/os: ' + errorText(e0), map: {}, stats: {} }); return; }

    var targets = {};
    var unique = [];
    for (var i = 0; i < offlineList.length; i++) {
      var name = String(offlineList[i].name || '');
      if (!name) { continue; }
      var key = name.toLowerCase();
      if (!targets[key]) { targets[key] = { name: name, key: key, found: '' }; unique.push(key); }
    }
    var roots = mediaOfflineGetScanRoots(fs, pathMod, osMod, offlineList);
    var queue = roots.slice();
    var queueIndex = 0;
    var visitedDirs = {};
    var foundCount = 0;
    var stats = { roots: roots.length, folders: 0, files: 0, skippedFolders: 0, errors: 0 };
    var maxFolders = 500000;
    var started = new Date().getTime();
    var maxMs = 20 * 60 * 1000;
    var lastUi = 0;

    logInfo('Media Offline', 'Scan roots: ' + roots.join(' | '));
    logInfo('Media Offline', 'Szukam tylko nazw: ' + unique.map(function (k) { return targets[k].name; }).join(' | '));
    setPanelProgressDetail('Szukam: ' + unique.map(function (k) { return targets[k].name; }).join(' | ') + '\nStart: ' + roots.join(' | '), true);

    function makeMap() {
      var out = {};
      for (var i = 0; i < unique.length; i++) {
        var k = unique[i];
        if (targets[k] && targets[k].found) { out[k] = targets[k].found; }
      }
      return out;
    }

    function updateUi(currentFolder, force) {
      var now = new Date().getTime();
      if (!force && now - lastUi < 120) { return; }
      lastUi = now;
      var base = unique.length > 0 ? Math.round((foundCount / unique.length) * 70) : 0;
      var pct = Math.min(82, 12 + base);
      setPanelProgress(pct, 'Media Offline: skanowanie dyskow...');
      setPanelProgressDetail('Szukam: ' + unique.map(function (k) { return targets[k].name + (targets[k].found ? ' = FOUND' : ''); }).join(' | ') + '\nTeraz skanuje: ' + currentFolder + '\nFoldery: ' + stats.folders + ' | Pliki: ' + stats.files + ' | Pominiete: ' + stats.skippedFolders + ' | Bledy: ' + stats.errors, true);
    }

    function done(ok, reason) {
      var elapsed = new Date().getTime() - started;
      stats.elapsedMs = elapsed;
      stats.found = foundCount;
      if (reason) { stats.reason = reason; }
      setPanelProgress(94, 'Media Offline: koncze skanowanie...');
      setPanelProgressDetail('Skan zakonczony: ' + (reason || 'OK') + '\nZnalezione: ' + foundCount + '/' + unique.length + ' | Foldery: ' + stats.folders + ' | Pliki: ' + stats.files + ' | Czas ms: ' + elapsed, true);
      finalCallback({ ok: ok, error: ok ? '' : reason, map: makeMap(), stats: stats });
    }

    function processChunk() {
      var processed = 0;
      while (queueIndex < queue.length && processed < 120) {
        if (foundCount >= unique.length && unique.length > 0) { done(true, 'all targets found'); return; }
        if (stats.folders >= maxFolders) { done(true, 'folder limit reached'); return; }
        if ((new Date().getTime() - started) > maxMs) { done(true, 'time limit reached'); return; }
        var dir = queue[queueIndex++];
        processed++;
        var baseName = '';
        try { baseName = pathMod.basename(dir); } catch (ignore1) {}
        if (mediaOfflineShouldSkipFolder(dir, baseName)) { stats.skippedFolders++; continue; }

        var lst = null;
        try { lst = fs.lstatSync(dir); } catch (lse) { stats.errors++; continue; }
        try { if (lst && lst.isSymbolicLink && lst.isSymbolicLink()) { stats.skippedFolders++; continue; } } catch (sym0) {}
        try { if (!lst || !lst.isDirectory || !lst.isDirectory()) { continue; } } catch (dirCheck) { continue; }

        var realDir = '';
        try { realDir = normalizeFsPath(fs.realpathSync(dir)).toLowerCase(); } catch (realErr) { realDir = normalizeFsPath(dir).toLowerCase(); }
        if (visitedDirs[realDir]) { stats.skippedFolders++; continue; }
        visitedDirs[realDir] = true;

        stats.folders++;
        updateUi(normalizeFsPath(dir), false);
        var entries = null;
        try { entries = fs.readdirSync(dir); } catch (e1) { stats.errors++; continue; }
        for (var i = 0; i < entries.length; i++) {
          var entryName = String(entries[i] || '');
          var full = pathMod.join(dir, entryName);
          var st = null;
          try { st = fs.lstatSync(full); } catch (e2) { stats.errors++; continue; }
          try { if (st && st.isSymbolicLink && st.isSymbolicLink()) { stats.skippedFolders++; continue; } } catch (sym1) {}
          if (st && st.isDirectory && st.isDirectory()) {
            if (mediaOfflineShouldSkipFolder(full, entryName)) { stats.skippedFolders++; }
            else { queue.push(full); }
          } else if (st && st.isFile && st.isFile()) {
            stats.files++;
            var key = entryName.toLowerCase();
            if (targets[key] && !targets[key].found) {
              targets[key].found = full;
              foundCount++;
              logInfo('Media Offline', 'FOUND candidate: ' + targets[key].name + ' -> ' + normalizeFsPath(full));
              updateUi(normalizeFsPath(dir), true);
              if (foundCount >= unique.length) { done(true, 'all targets found'); return; }
            }
          }
        }
      }
      if (queueIndex >= queue.length) { done(true, 'scan finished'); return; }
      setTimeout(processChunk, 1);
    }

    setTimeout(processChunk, 1);
  }

  function relinkOfflineMedia(done) {
    logInfo('Media Offline', 'Sprawdzam projekt pod katem Media Offline / brakujacych sciezek...');
    logInfo('Media Offline', 'Najpierw Premiere sprawdzi liste offline mediow, potem panel skanuje komputer tylko po dokladnych nazwach brakujacych plikow.');
    setPanelProgress(4, 'Media Offline: ladowanie modulu...');
    evalScriptLogged('Media Offline', buildMediaOfflineEnsureModuleScript(), function (loaderRes) {
      logInfo('Media Offline', loaderRes || 'Brak odpowiedzi loadera.');
      setPanelProgress(8, 'Media Offline: sprawdzanie projektu...');
      evalScriptLogged('Media Offline', 'AEDRNO.getOfflineMediaListForCEP()', function (listRes) {
        var parsed = parseJsonLoose(listRes);
        if (!parsed || parsed.ok === false) {
          logError('Media Offline', 'Nie udalo sie pobrac listy offline mediow: ' + (parsed && parsed.error ? parsed.error : String(listRes || 'brak odpowiedzi')));
          if (done) { done('Media Offline: blad listy'); }
          return;
        }
        if (parsed.logs && parsed.logs.length) {
          for (var l = 0; l < parsed.logs.length; l++) { logInfo('Media Offline', parsed.logs[l]); }
        }
        var offline = parsed.offline || [];
        if (!offline.length) {
          setPanelProgress(100, 'Media Offline: brak offline mediow');
          setPanelProgressDetail('', false);
          logInfo('Media Offline', 'No Media Offline items found. Nothing to relink.');
          if (done) { done('Brak Media Offline'); }
          return;
        }
        var names = [];
        var seen = {};
        for (var i = 0; i < offline.length; i++) {
          var nm = String(offline[i].name || '');
          var key = nm.toLowerCase();
          if (nm && !seen[key]) { seen[key] = true; names.push(nm); }
        }
        setPanelProgress(12, 'Media Offline: szukam ' + names.length + ' nazw plikow...');
        setPanelProgressDetail('Szukam: ' + names.join(' | '), true);
        scanOfflineMediaInCEP(offline, setPanelProgress, function (scanResult) {
          if (!scanResult || !scanResult.ok) {
            logError('Media Offline', 'Scan error: ' + (scanResult && scanResult.error ? scanResult.error : 'unknown error'));
            if (done) { done('Media Offline: blad skanu'); }
            return;
          }
          var stats = scanResult.stats || {};
          logInfo('Media Offline', 'Scan stats: roots=' + (stats.roots || 0) + ', folders=' + (stats.folders || 0) + ', files=' + (stats.files || 0) + ', skippedFolders=' + (stats.skippedFolders || 0) + ', errors=' + (stats.errors || 0) + ', found=' + (stats.found || 0) + ', reason=' + (stats.reason || ''));
          setPanelProgress(96, 'Media Offline: relinkowanie w Premiere...');
          var mapJson = JSON.stringify(scanResult.map || {});
          var code = 'AEDRNO.relinkOfflineMediaFromMap(' + extendScriptStringLiteral(mapJson) + ')';
          evalScriptLogged('Media Offline', code, function (relinkRes) {
            logInfo('Media Offline', relinkRes || 'Brak odpowiedzi relinkowania.');
            setPanelProgressDetail('', false);
            if (done) { done('Media Offline: gotowe'); }
          }, 'relinkOfflineMediaFromMap', 'mediaOfflineRelinkApply');
        });
      }, 'getOfflineMediaListForCEP', 'mediaOfflineList');
    }, null, 'mediaOfflineLoader');
  }


  /* ── UN NEST / MULTI-NEST history undo ── */
  var lastUnNestUndoPayload = null;
  var lastMultiNestUndoPayload = null;
  var lastHistoryUndoAction = '';
  var suppressUnNestUndoRegistration = false;

  function extractUnNestUndoPayload(res) {
    var text = String(res || '');
    var startMarker = '__UNNEST_UNDO__';
    var endMarker = '__END_UNNEST_UNDO__';
    var s = text.indexOf(startMarker);
    var e = text.indexOf(endMarker);
    if (s >= 0 && e > s) {
      if (!suppressUnNestUndoRegistration) {
        lastUnNestUndoPayload = text.substring(s + startMarker.length, e);
        lastHistoryUndoAction = 'UN_NEST';
      }
      text = text.substring(0, s) + text.substring(e + endMarker.length);
    }
    return text;
  }

  function parseJsonSafe(text) {
    try { return JSON.parse(String(text || '{}')); } catch (e0) {}
    return null;
  }

  function extractMultiNestUndoPayload(res) {
    var text = String(res || '');
    var startMarker = '__MULTINEST_UNDO__';
    var endMarker = '__END_MULTINEST_UNDO__';
    var s = text.indexOf(startMarker);
    var e = text.indexOf(endMarker);
    if (s >= 0 && e > s) {
      lastMultiNestUndoPayload = text.substring(s + startMarker.length, e);
      lastHistoryUndoAction = 'MULTI_NEST';
      text = text.substring(0, s) + text.substring(e + endMarker.length);
    }
    return text;
  }

  function extractMarkerPayload(text, startMarker, endMarker) {
    var source = String(text || '');
    var s = source.indexOf(startMarker);
    var e = source.indexOf(endMarker);
    if (s >= 0 && e > s) {
      return {
        payload: source.substring(s + startMarker.length, e),
        clean: source.substring(0, s) + source.substring(e + endMarker.length)
      };
    }
    return { payload: null, clean: source };
  }

  function getHostPlatform() {
    try {
      if (typeof process !== 'undefined' && process && process.platform) {
        return String(process.platform).toLowerCase();
      }
    } catch (e0) {}
    try {
      var os = require('os');
      if (os && os.platform) { return String(os.platform()).toLowerCase(); }
    } catch (e1) {}
    try {
      var path = String(cs.getSystemPath(SystemPath.EXTENSION) || '').toLowerCase();
      if (path.indexOf('/library/application support/adobe/cep/') >= 0 || path.indexOf('/users/') === 0) { return 'darwin'; }
      if (/^[a-z]:\\/.test(path) || path.indexOf('\\appdata\\') >= 0) { return 'win32'; }
    } catch (e2) {}
    return 'unknown';
  }

  function unNestNowMs() {
    try { return Date.now ? Date.now() : (new Date()).getTime(); } catch (e) { return (new Date()).getTime(); }
  }

  function unNestSpeedDebug(label, startedAt, totalStartedAt) {
    if (!debugMode) { return; }
    var now = unNestNowMs();
    var stepMs = startedAt ? (now - startedAt) : 0;
    var totalMs = totalStartedAt ? (now - totalStartedAt) : stepMs;
    logDebug('UN NEST Speed', label + ' | krok: ' + stepMs + ' ms | razem: ' + totalMs + ' ms');
  }

  function runMacSendKey(keyName, cb) {
    var done = false;
    function finish(ok, msg) {
      if (done) { return; }
      done = true;
      if (cb) { cb(ok, msg || ''); }
    }
    try {
      if (typeof require !== 'function') {
        finish(false, 'Node/require niedostępne w panelu CEP.');
        return;
      }
      var childProcess = require('child_process');
      var key = String(keyName || '').replace(/\\/g, '\\\\').replace(/\"/g, '\\\"');

      // v1.12.119: nie aktywujemy aplikacji po sztywnej nazwie
      // `Adobe Premiere Pro`, bo na macOS nazwa procesu bywa np.
      // `Adobe Premiere Pro 2025` albo AppleScript jej nie znajduje.
      // Zamiast tego szukamy procesu Premiere po bundle id/nazwie
      // przez System Events i wysyłamy skrót do frontowej aplikacji.
      var script = [
        'tell application "System Events"',
        'set targetProcess to missing value',
        'try',
        'set premiereList to every process whose bundle identifier contains "com.adobe.PremierePro"',
        'if (count of premiereList) > 0 then set targetProcess to item 1 of premiereList',
        'end try',
        'if targetProcess is missing value then',
        'try',
        'set premiereListByName to every process whose name contains "Premiere"',
        'if (count of premiereListByName) > 0 then set targetProcess to item 1 of premiereListByName',
        'end try',
        'end if',
        'if targetProcess is not missing value then',
        'set frontmost of targetProcess to true',
        'delay 0.006',
        'keystroke "' + key + '" using command down',
        'delay 0.004',
        'return "OK: sent Cmd+' + key.toUpperCase() + ' to " & name of targetProcess',
        'else',
        'delay 0.004',
        'keystroke "' + key + '" using command down',
        'delay 0.004',
        'return "OK: sent Cmd+' + key.toUpperCase() + ' to current frontmost app"',
        'end if',
        'end tell'
      ];
      var args = script.map(function (line) { return '-e ' + JSON.stringify(line); }).join(' ');
      childProcess.exec('osascript ' + args, function (err, stdout, stderr) {
        if (err) { finish(false, String(stderr || err.message || err)); }
        else { finish(true, String(stdout || stderr || 'OK')); }
      });
    } catch (e) {
      finish(false, String(e));
    }
  }

  function getWindowsSendKeysScriptPath() {
    try {
      if (typeof require !== 'function') { return ''; }
      var fs = require('fs');
      var path = require('path');
      var os = require('os');
      var dir = path.join(os.tmpdir(), 'Verni_AiO_Extension');
      try { if (!fs.existsSync(dir)) { fs.mkdirSync(dir); } } catch (mk) {}
      var file = path.join(dir, 'verni_sendkeys_fast.vbs');
      var body = [
        'On Error Resume Next',
        'Dim shell, keyArg',
        'Set shell = CreateObject("WScript.Shell")',
        'keyArg = ""',
        'If WScript.Arguments.Count > 0 Then keyArg = WScript.Arguments(0)',
        'shell.AppActivate "Adobe Premiere Pro"',
        'WScript.Sleep 6',
        'shell.SendKeys keyArg',
        'WScript.Sleep 4',
        'If Err.Number <> 0 Then',
        '  WScript.Echo "WARN: " & Err.Description',
        'Else',
        '  WScript.Echo "OK: sent " & keyArg',
        'End If'
      ].join('\r\n');
      try {
        if (!fs.existsSync(file) || String(fs.readFileSync(file, 'utf8') || '') !== body) {
          fs.writeFileSync(file, body, 'utf8');
        }
      } catch (wr) {
        fs.writeFileSync(file, body, 'utf8');
      }
      return file;
    } catch (e) {
      return '';
    }
  }

  function runWindowsSendKeyPowerShellFallback(keyName, cb) {
    var done = false;
    function finish(ok, msg) {
      if (done) { return; }
      done = true;
      if (cb) { cb(ok, msg || ''); }
    }
    try {
      if (typeof require !== 'function') {
        finish(false, 'Node/require niedostepne w panelu CEP.');
        return;
      }
      var childProcess = require('child_process');
      var map = { c: '^c', v: '^v', w: '^w' };
      var keys = map[String(keyName || '').toLowerCase()] || String(keyName || '');
      var safeKeys = String(keys || '').replace(/'/g, "''");
      var ps = "$wshell = New-Object -ComObject WScript.Shell; " +
        "$null = $wshell.AppActivate('Adobe Premiere Pro'); " +
        "Start-Sleep -Milliseconds 8; " +
        "$wshell.SendKeys('" + safeKeys + "'); " +
        "Start-Sleep -Milliseconds 4";
      childProcess.exec('powershell -NoProfile -ExecutionPolicy Bypass -Command ' + JSON.stringify(ps), { windowsHide: true }, function (err, stdout, stderr) {
        if (err) { finish(false, String(stderr || err.message || err)); }
        else { finish(true, String(stdout || stderr || 'OK: sent via PowerShell fallback')); }
      });
    } catch (e) {
      finish(false, String(e));
    }
  }

  function runWindowsSendKey(keyName, cb) {
    var done = false;
    function finish(ok, msg) {
      if (done) { return; }
      done = true;
      if (cb) { cb(ok, msg || ''); }
    }
    try {
      if (typeof require !== 'function') {
        finish(false, 'Node/require niedostepne w panelu CEP.');
        return;
      }
      var childProcess = require('child_process');
      var map = { c: '^c', v: '^v', w: '^w' };
      var keys = map[String(keyName || '').toLowerCase()] || String(keyName || '');
      var scriptPath = getWindowsSendKeysScriptPath();
      if (!scriptPath) {
        runWindowsSendKeyPowerShellFallback(keyName, finish);
        return;
      }
      // v1.12.128: cscript/VBScript startuje zwykle szybciej niz pelny PowerShell.
      childProcess.execFile('cscript.exe', ['//nologo', scriptPath, keys], { windowsHide: true }, function (err, stdout, stderr) {
        if (!err) {
          finish(true, String(stdout || stderr || 'OK: sent via cscript'));
          return;
        }
        runWindowsSendKeyPowerShellFallback(keyName, function (ok2, msg2) {
          finish(ok2, ok2 ? String(msg2 || 'OK via fallback') : String(stderr || err.message || msg2 || err));
        });
      });
    } catch (e) {
      runWindowsSendKeyPowerShellFallback(keyName, finish);
    }
  }

  function runNativeSendKey(keyName, cb) {
    var platform = getHostPlatform();
    if (platform === 'darwin' || platform === 'mac' || platform === 'macos') {
      runMacSendKey(keyName, function (ok, msg) {
        if (cb) { cb(ok, msg, 'macOS', 'Cmd+' + String(keyName || '').toUpperCase()); }
      });
      return;
    }
    if (platform.indexOf('win') === 0) {
      runWindowsSendKey(keyName, function (ok, msg) {
        if (cb) { cb(ok, msg, 'Windows', 'Ctrl+' + String(keyName || '').toUpperCase()); }
      });
      return;
    }
    if (cb) { cb(false, 'Nieobsługiwany albo nierozpoznany system dla skrótów natywnych: ' + platform, platform, ''); }
  }

  function runMacPressEnterForPremiereDialog(cb) {
    var done = false;
    function finish(ok, msg) {
      if (done) { return; }
      done = true;
      if (cb) { cb(ok, msg || ''); }
    }
    try {
      if (typeof require !== 'function') { finish(false, 'Node/require niedostępne w panelu CEP.'); return; }
      var childProcess = require('child_process');
      var script = [
        'tell application "System Events"',
        'set targetProcess to missing value',
        'try',
        'set premiereList to every process whose bundle identifier contains "com.adobe.PremierePro"',
        'if (count of premiereList) > 0 then set targetProcess to item 1 of premiereList',
        'end try',
        'if targetProcess is missing value then',
        'try',
        'set premiereListByName to every process whose name contains "Premiere"',
        'if (count of premiereListByName) > 0 then set targetProcess to item 1 of premiereListByName',
        'end try',
        'end if',
        'if targetProcess is missing value then return "SKIP: Premiere process not found"',
        'set frontmost of targetProcess to true',
        'delay 0.02',
        'set dialogFound to false',
        'try',
        'if (count of (windows of targetProcess whose subrole is "AXDialog")) > 0 then set dialogFound to true',
        'end try',
        'try',
        'repeat with w in windows of targetProcess',
        'if (count of sheets of w) > 0 then set dialogFound to true',
        'end repeat',
        'end try',
        'if dialogFound then',
        'key code 36',
        'delay 0.02',
        'return "OK: sent Enter to Premiere dialog"',
        'else',
        'return "SKIP: no Premiere dialog"',
        'end if',
        'end tell'
      ];
      var args = script.map(function (line) { return '-e ' + JSON.stringify(line); }).join(' ');
      childProcess.exec('osascript ' + args, function (err, stdout, stderr) {
        if (err) { finish(false, String(stderr || err.message || err)); }
        else { finish(true, String(stdout || stderr || 'OK')); }
      });
    } catch (e) { finish(false, String(e)); }
  }

  function runNativeEnterForNestDialog(cb) {
    var platform = getHostPlatform();
    if (platform === 'darwin' || platform === 'mac' || platform === 'macos') {
      runMacPressEnterForPremiereDialog(function (ok, msg) {
        if (cb) { cb(ok, msg, 'macOS', 'Enter'); }
      });
      return;
    }
    if (platform.indexOf('win') === 0) {
      runWindowsSendKey('{ENTER}', function (ok, msg) {
        if (cb) { cb(ok, msg, 'Windows', 'Enter'); }
      });
      return;
    }
    if (cb) { cb(false, 'Nieobsługiwany system dla Enter dialogu: ' + platform, platform, ''); }
  }

  function runMacPremiereClipNestMenu(cb) {
    var done = false;
    function finish(ok, msg) {
      if (done) { return; }
      done = true;
      if (cb) { cb(ok, msg || ''); }
    }
    try {
      if (typeof require !== 'function') { finish(false, 'Node/require niedostępne w panelu CEP.'); return; }
      var childProcess = require('child_process');
      var script = [
        'tell application "System Events"',
        'set targetProcess to missing value',
        'try',
        'set premiereList to every process whose bundle identifier contains "com.adobe.PremierePro"',
        'if (count of premiereList) > 0 then set targetProcess to item 1 of premiereList',
        'end try',
        'if targetProcess is missing value then',
        'try',
        'set premiereListByName to every process whose name contains "Premiere"',
        'if (count of premiereListByName) > 0 then set targetProcess to item 1 of premiereListByName',
        'end try',
        'end if',
        'if targetProcess is missing value then return "FAIL: Premiere process not found"',
        'set frontmost of targetProcess to true',
        'delay 0.04',
        'tell targetProcess',
        'set clipMenu to missing value',
        'repeat with menuName in {"Clip", "Klip"}',
        'try',
        'set clipMenu to menu bar item (contents of menuName) of menu bar 1',
        'exit repeat',
        'end try',
        'end repeat',
        'if clipMenu is missing value then return "FAIL: Clip menu not found"',
        'click clipMenu',
        'delay 0.08',
        'set nestItem to missing value',
        'try',
        'repeat with mi in menu items of menu 1 of clipMenu',
        'try',
        'set itemName to name of mi',
        'if itemName contains "Nest" or itemName contains "Zagnie" then',
        'set nestItem to mi',
        'exit repeat',
        'end if',
        'end try',
        'end repeat',
        'end try',
        'if nestItem is missing value then',
        'key code 53',
        'return "FAIL: Nest menu item not found"',
        'end if',
        'click nestItem',
        'delay 0.04',
        'return "OK: clicked " & name of nestItem',
        'end tell',
        'end tell'
      ];
      var args = script.map(function (line) { return '-e ' + JSON.stringify(line); }).join(' ');
      childProcess.exec('osascript ' + args, function (err, stdout, stderr) {
        var out = String(stdout || stderr || '');
        if (err) { finish(false, String(stderr || err.message || err)); }
        else if (out.indexOf('OK:') >= 0) { finish(true, out); }
        else { finish(false, out || 'Nie udalo sie kliknac Clip > Nest.'); }
      });
    } catch (e) { finish(false, String(e)); }
  }

  function runWindowsPremiereClipNestMenu(cb) {
    if (cb) {
      cb(false, 'Windows fallback dla Clip > Nest nie jest jeszcze dostepny w tym buildzie.');
    }
  }

  function runNativePremiereClipNestMenu(cb) {
    var platform = getHostPlatform();
    if (platform === 'darwin' || platform === 'mac' || platform === 'macos') {
      runMacPremiereClipNestMenu(function (ok, msg) {
        if (cb) { cb(ok, msg, 'macOS'); }
      });
      return;
    }
    if (platform.indexOf('win') === 0) {
      runWindowsPremiereClipNestMenu(function (ok, msg) {
        if (cb) { cb(ok, msg, 'Windows'); }
      });
      return;
    }
    if (cb) { cb(false, 'Nieobsługiwany system dla Clip > Nest: ' + platform, platform); }
  }

  function startMultiNestNativeDialogConfirmPump() {
    var active = true;
    var busy = false;
    var attempts = 0;
    var confirmed = 0;
    var platform = getHostPlatform();
    var delayMs = (platform === 'darwin' || platform === 'mac' || platform === 'macos') ? 180 : 320;
    var maxAttempts = 240;
    var timer = null;

    function stop() {
      active = false;
      try { if (timer) { clearInterval(timer); } } catch (e0) {}
      try {
        if (debugMode) {
          logDebug('MULTI-NEST', 'Native Nest dialog Enter pump stop. attempts=' + attempts + ', confirmed=' + confirmed + '.');
        }
      } catch (e1) {}
    }

    function tick() {
      if (!active || busy) { return; }
      attempts++;
      if (attempts > maxAttempts) { stop(); return; }
      busy = true;
      runNativeEnterForNestDialog(function (ok, msg) {
        busy = false;
        try {
          if (ok && String(msg || '').indexOf('OK:') >= 0) {
            confirmed++;
            if (debugMode) { logDebug('MULTI-NEST', 'Native Nest dialog Enter: ' + String(msg || 'OK')); }
          }
        } catch (e0) {}
      });
    }

    timer = setInterval(tick, delayMs);
    setTimeout(tick, 80);
    return stop;
  }


  function runMacNudgeUp(cb) {
    var done = false;
    function finish(ok, msg) {
      if (done) { return; }
      done = true;
      if (cb) { cb(ok, msg || ''); }
    }
    try {
      if (typeof require !== 'function') { finish(false, 'Node/require niedostępne w panelu CEP.'); return; }
      var childProcess = require('child_process');
      var script = [
        'tell application "System Events"',
        'set targetProcess to missing value',
        'try',
        'set premiereList to every process whose bundle identifier contains "com.adobe.PremierePro"',
        'if (count of premiereList) > 0 then set targetProcess to item 1 of premiereList',
        'end try',
        'if targetProcess is missing value then',
        'try',
        'set premiereListByName to every process whose name contains "Premiere"',
        'if (count of premiereListByName) > 0 then set targetProcess to item 1 of premiereListByName',
        'end try',
        'end if',
        'if targetProcess is not missing value then set frontmost of targetProcess to true',
        'delay 0.006',
        'key code 126 using option down',
        'delay 0.004',
        'return "OK: sent Option+Up"',
        'end tell'
      ];
      var args = script.map(function (line) { return '-e ' + JSON.stringify(line); }).join(' ');
      childProcess.exec('osascript ' + args, function (err, stdout, stderr) {
        if (err) { finish(false, String(stderr || err.message || err)); }
        else { finish(true, String(stdout || stderr || 'OK')); }
      });
    } catch (e) { finish(false, String(e)); }
  }

  function runWindowsNudgeUp(cb) {
    var done = false;
    function finish(ok, msg) {
      if (done) { return; }
      done = true;
      if (cb) { cb(ok, msg || ''); }
    }
    try {
      if (typeof require !== 'function') { finish(false, 'Node/require niedostepne w panelu CEP.'); return; }
      var childProcess = require('child_process');
      var keys = '%{UP}';
      var scriptPath = getWindowsSendKeysScriptPath();
      if (scriptPath) {
        childProcess.execFile('cscript.exe', ['//nologo', scriptPath, keys], { windowsHide: true }, function (err, stdout, stderr) {
          if (!err) { finish(true, String(stdout || stderr || 'OK: sent Alt+Up via cscript')); return; }
          var ps = "$wshell = New-Object -ComObject WScript.Shell; $null = $wshell.AppActivate('Adobe Premiere Pro'); Start-Sleep -Milliseconds 8; $wshell.SendKeys('%{UP}'); Start-Sleep -Milliseconds 4";
          childProcess.exec('powershell -NoProfile -ExecutionPolicy Bypass -Command ' + JSON.stringify(ps), { windowsHide: true }, function (err2, stdout2, stderr2) {
            if (err2) { finish(false, String(stderr2 || err2.message || err2)); }
            else { finish(true, String(stdout2 || stderr2 || 'OK: sent Alt+Up via PowerShell')); }
          });
        });
      } else {
        var ps2 = "$wshell = New-Object -ComObject WScript.Shell; $null = $wshell.AppActivate('Adobe Premiere Pro'); Start-Sleep -Milliseconds 8; $wshell.SendKeys('%{UP}'); Start-Sleep -Milliseconds 4";
        childProcess.exec('powershell -NoProfile -ExecutionPolicy Bypass -Command ' + JSON.stringify(ps2), { windowsHide: true }, function (err3, stdout3, stderr3) {
          if (err3) { finish(false, String(stderr3 || err3.message || err3)); }
          else { finish(true, String(stdout3 || stderr3 || 'OK: sent Alt+Up via PowerShell')); }
        });
      }
    } catch (e) { finish(false, String(e)); }
  }

  function runNativeNudgeUp(cb) {
    var platform = getHostPlatform();
    if (platform === 'darwin' || platform === 'mac' || platform === 'macos') { runMacNudgeUp(function (ok, msg) { if (cb) { cb(ok, msg, 'macOS', 'Option+Up'); } }); return; }
    if (platform.indexOf('win') === 0) { runWindowsNudgeUp(function (ok, msg) { if (cb) { cb(ok, msg, 'Windows', 'Alt+Up'); } }); return; }
    if (cb) { cb(false, 'Nieobsługiwany system dla przesuwania klipów w górę: ' + platform, platform, ''); }
  }

  function runNativeNudgeUpTimes(times, cb) {
    var total = Math.max(0, Number(times) || 0);
    var doneCount = 0;
    function step() {
      if (doneCount >= total) { if (cb) { cb(true, 'OK: nudge up x' + total); } return; }
      runNativeNudgeUp(function (ok, msg, platform, label) {
        if (!ok) { if (cb) { cb(false, String(msg || 'nudge failed'), platform, label); } return; }
        doneCount++;
        setTimeout(step, 12);
      });
    }
    step();
  }

  function runNativeUnNestKeyboardFlow(copyPayload, firstLogText, done) {
    var unNestTotalStartedAt = unNestNowMs();
    var unNestStepStartedAt = unNestTotalStartedAt;
    function markUnNestSpeed(label) {
      unNestSpeedDebug(label, unNestStepStartedAt, unNestTotalStartedAt);
      unNestStepStartedAt = unNestNowMs();
    }
    if (firstLogText) { logInfo('UN NEST', firstLogText); }
    try { setPanelProgress(8, 'UN NEST: przygotowanie natywnego copy/paste...'); } catch (ignoreProgress0) {}
    var platform = getHostPlatform();
    var isMac = (platform === 'darwin' || platform === 'mac' || platform === 'macos');
    var copyLabel = isMac ? 'Cmd+C' : 'Ctrl+C';
    var pasteLabel = isMac ? 'Cmd+V' : 'Ctrl+V';
    var closeLabel = isMac ? 'Cmd+W' : 'Ctrl+W';

    function continueAfterCopyClose(updatedCopyPayload) {
      try { setPanelProgress(42, 'UN NEST: przygotowuję sekwencję główną do wklejenia...'); } catch (ignoreProgress1) {}
      var code = 'AEDRNO.unNestNativePreparePasteAfterKeyboardCopy(' + extendScriptStringLiteral(updatedCopyPayload || copyPayload) + ')';
      evalHostAndRun(code, function (res2) {
        var mNudge = extractMarkerPayload(res2, '__UNNEST_NATIVE_NUDGE_UP__', '__END_UNNEST_NATIVE_NUDGE_UP__');
        var cleanNudge = extractUnNestUndoPayload(mNudge.clean);
        if (mNudge.payload) {
          if (cleanNudge) { logInfo('UN NEST', cleanNudge); }
          markUnNestSpeed('Prepare Local Video Protect');
          var nudgeSteps = 1;
          try { nudgeSteps = Math.max(1, Number(JSON.parse(mNudge.payload).localVideoNudgeSteps) || 1); } catch (nudgeParseErr) {}
          logInfo('UN NEST', 'Native Copy/Paste: przesuwam lokalnie zaznaczone kolizje video o ' + nudgeSteps + ' ścieżk' + (nudgeSteps === 1 ? 'ę' : 'i') + ' w górę.');
          runNativeNudgeUpTimes(nudgeSteps, function (nudgeOk, nudgeMsg, nudgePlatform, nudgeLabel) {
            if (!nudgeOk) {
              logInfo('UN NEST', 'Native Copy/Paste: nie udało się lokalnie przesunąć kolizji video przez ' + (nudgeLabel || 'Alt/Option+Up') + ': ' + nudgeMsg);
              if (done) { done(); }
              return;
            }
            logDebug('UN NEST', 'Native Copy/Paste: lokalne przesunięcie video OK. ' + nudgeMsg);
            markUnNestSpeed('Local Video Protect nudge');
            continueAfterCopyClose(mNudge.payload);
          });
          return;
        }

        var mPaste = extractMarkerPayload(res2, '__UNNEST_NATIVE_PASTE__', '__END_UNNEST_NATIVE_PASTE__');
        var clean2 = extractUnNestUndoPayload(mPaste.clean);
        if (clean2) { logInfo('UN NEST', clean2); }
        markUnNestSpeed('Prepare Paste po Copy');
        if (!mPaste.payload) {
          logInfo('UN NEST', 'Native Copy/Paste: brak etapu Paste po przygotowaniu sekwencji głównej.');
          if (done) { done(); }
          return;
        }
        try { setPanelProgress(62, 'UN NEST: wklejam skopiowaną zawartość NEST-a...'); } catch (ignoreProgress2) {}
        logInfo('UN NEST', 'Native Copy/Paste: sekwencja główna gotowa — wklejam od razu bez dodatkowej pauzy.');
        logInfo('UN NEST', 'Native Copy/Paste: próbuję wykonać prawdziwe ' + pasteLabel + ' przez panel CEP/' + (isMac ? 'macOS' : 'Windows') + '.');
        runNativeSendKey('v', function (pasteOk, pasteMsg) {
          if (!pasteOk) {
            logInfo('UN NEST', 'Native Copy/Paste: ' + pasteLabel + ' nie zadziałało: ' + pasteMsg);
            if (done) { done(); }
            return;
          }
          logDebug('UN NEST', 'Native Copy/Paste: ' + pasteLabel + ' wysłane. ' + pasteMsg);
          markUnNestSpeed(pasteLabel + ' wyslane');
          try { setPanelProgress(78, 'UN NEST: finalizuję wklejenie i sprzątam timeline...'); } catch (ignoreProgress3) {}
          var finishCode = 'AEDRNO.unNestNativeFinalizeKeyboardPaste(' + extendScriptStringLiteral(mPaste.payload) + ')';
          evalHostAndRun(finishCode, function (res3) {
            var mClose = extractMarkerPayload(res3, '__UNNEST_NATIVE_CLOSE_SOURCE__', '__END_UNNEST_NATIVE_CLOSE_SOURCE__');
            var clean3 = extractUnNestUndoPayload(mClose.clean);
            logInfo('UN NEST', clean3 || 'Native Copy/Paste: zakończono, ale brak odpowiedzi z Premiere.');
            markUnNestSpeed('Finalize po Paste');
            if (mClose.payload) {
              logInfo('UN NEST', 'Native Copy/Paste: zamykam otwartą zakładkę sekwencji NEST przez ' + closeLabel + '.');
              try { setPanelProgress(90, 'UN NEST: zamykam zakładkę źródłowego NEST-a...'); } catch (ignoreProgress4) {}
              runNativeSendKey('w', function (closeOk, closeMsg) {
                if (!closeOk) {
                  logInfo('UN NEST', 'Native Copy/Paste: nie udało się zamknąć zakładki NEST przez ' + closeLabel + ': ' + closeMsg);
                  if (done) { done(); }
                  return;
                }
                logDebug('UN NEST', 'Native Copy/Paste: ' + closeLabel + ' wysłane. ' + closeMsg);
                markUnNestSpeed(closeLabel + ' wyslane');
                var afterCloseCode = 'AEDRNO.unNestNativeAfterCloseSourceTab(' + extendScriptStringLiteral(mClose.payload) + ')';
                evalHostAndRun(afterCloseCode, function (res4) {
                  var clean4 = extractUnNestUndoPayload(res4);
                  if (clean4) { logInfo('UN NEST', clean4); }
                  markUnNestSpeed('After Close cleanup');
                  if (done) { done(); }
                });
              });
            } else if (done) {
              markUnNestSpeed('UN NEST koniec bez zamykania taba');
              done();
            }
          });
        });
      });
    }

    try { setPanelProgress(18, 'UN NEST: kopiuję zawartość źródłowego NEST-a...'); } catch (ignoreProgress5) {}
    logInfo('UN NEST', 'Native Copy/Paste: próbuję wykonać prawdziwe ' + copyLabel + ' przez panel CEP/' + (isMac ? 'macOS' : 'Windows') + '.');
    runNativeSendKey('c', function (copyOk, copyMsg) {
      if (!copyOk) {
        logInfo('UN NEST', 'Native Copy/Paste: ' + copyLabel + ' nie zadziałało: ' + copyMsg);
        if (done) { done(); }
        return;
      }
      logDebug('UN NEST', 'Native Copy/Paste: ' + copyLabel + ' wysłane. ' + copyMsg);
      markUnNestSpeed(copyLabel + ' wyslane');
      try { setPanelProgress(30, 'UN NEST: wracam ze źródłowego NEST-a do sekwencji głównej...'); } catch (ignoreProgress6) {}
      logInfo('UN NEST', 'Native Copy/Paste: zamykam od razu źródłową zakładkę NEST przez ' + closeLabel + ' po ' + copyLabel + '.');
      runNativeSendKey('w', function (closeAfterCopyOk, closeAfterCopyMsg) {
        var payloadForPrepare = copyPayload;
        if (closeAfterCopyOk) {
          logDebug('UN NEST', 'Native Copy/Paste: ' + closeLabel + ' po kopiowaniu wysłane. ' + closeAfterCopyMsg);
          markUnNestSpeed(closeLabel + ' po Copy wyslane');
          try {
            var parsedPayload = JSON.parse(copyPayload);
            parsedPayload.sourceTabClosedAfterCopy = true;
            payloadForPrepare = JSON.stringify(parsedPayload);
          } catch (payloadErr) {}
        } else {
          logInfo('UN NEST', 'Native Copy/Paste: nie udało się zamknąć zakładki NEST zaraz po kopiowaniu przez ' + closeLabel + '. Kontynuuję starym flow. ' + closeAfterCopyMsg);
        }
        continueAfterCopyClose(payloadForPrepare);
      });
    });
  }

  function evalHostAndRun(script, cb) {
    try {
      var extRoot = '';
      try { extRoot = cs.getSystemPath(SystemPath.EXTENSION); } catch (e0) { extRoot = ''; }
      if (extRoot) {
        extRoot = String(extRoot).replace(/\\/g, '/');
        var hostFile = extRoot + '/jsx/host.jsx';
        var code = '$.evalFile(new File(' + extendScriptStringLiteral(hostFile) + ')); ' + script;
        evalScriptLogged('UN NEST reload host.jsx', code, cb, 'unNestSelected', 'unNestSelected');
        return;
      }
    } catch (e1) {}
    evalScriptLogged('UN NEST', script, cb, 'unNestSelected', 'unNestSelected');
  }

  function evalHostAndRunForMultiNestUndo(script, cb, key) {
    try {
      var extRoot = '';
      try { extRoot = cs.getSystemPath(SystemPath.EXTENSION); } catch (e0) { extRoot = ''; }
      if (extRoot) {
        extRoot = String(extRoot).replace(/\\/g, '/');
        var hostFile = extRoot + '/jsx/host.jsx';
        var code = '$.evalFile(new File(' + extendScriptStringLiteral(hostFile) + ')); ' + script;
        evalScriptLogged('MULTI-NEST Undo reload host.jsx', code, cb, 'multiNestUndoPrepareOne', key || 'multiNestUndoPrepareOne');
        return;
      }
    } catch (e1) {}
    evalScriptLogged('MULTI-NEST Undo', script, cb, 'multiNestUndoPrepareOne', key || 'multiNestUndoPrepareOne');
  }

  function unNestSelected(done) {
    try { setPanelProgress(5, 'UN NEST: analizuję zaznaczony NEST...'); } catch (ignoreProgress7) {}
    logInfo('UN NEST', 'Próbuję rozpakować zaznaczoną sekwencję NEST...');
    evalHostAndRun('AEDRNO.unNestSelected()', function (res) {
      var nativeCopy = extractMarkerPayload(res, '__UNNEST_NATIVE_COPY__', '__END_UNNEST_NATIVE_COPY__');
      var clean = extractUnNestUndoPayload(nativeCopy.clean);
      if (nativeCopy.payload) {
        runNativeUnNestKeyboardFlow(nativeCopy.payload, clean, done);
        return;
      }
      logInfo('UN NEST', clean || 'Brak odpowiedzi z Premiere.');
      if (done) { done(); }
    });
  }

  function handleMultiNestNativeMenuResponse(res, done, stopNativeNestPump) {
    var menuStep = extractMarkerPayload(res, '__MULTINEST_NATIVE_MENU__', '__END_MULTINEST_NATIVE_MENU__');
    var clean = extractMultiNestUndoPayload(menuStep.clean);
    if (clean) { logInfo('MULTI-NEST', clean); }

    if (!menuStep.payload) {
      try { if (stopNativeNestPump) { stopNativeNestPump(); } } catch (stopNestPumpErr0) {}
      setPanelProgress(100, 'MULTI-NEST: gotowe');
      if (done) { done('MULTI-NEST gotowe'); }
      return;
    }

    var stepInfo = null;
    try { stepInfo = JSON.parse(menuStep.payload); } catch (parseStepErr) { stepInfo = null; }
    try {
      var pct = 20;
      if (stepInfo && stepInfo.total) {
        pct = Math.min(95, 20 + Math.round((Number(stepInfo.index || 0) / Math.max(1, Number(stepInfo.total || 1))) * 70));
      }
      setPanelProgress(pct, 'MULTI-NEST: natywny Nest ' + ((stepInfo ? Number(stepInfo.index || 0) : 0) + 1) + '/' + (stepInfo ? stepInfo.total : '?'));
    } catch (ignoreProgressStep) {}

    logInfo('MULTI-NEST', 'Native menu: klikam Clip > Nest dla ' + (stepInfo ? (stepInfo.type + stepInfo.track + ' "' + (stepInfo.clipName || '') + '"') : 'kolejnego klipu') + '.');
    runNativePremiereClipNestMenu(function (menuOk, menuMsg, platform) {
      logInfo('MULTI-NEST', 'Native menu ' + (menuOk ? 'OK' : 'FAIL') + ' (' + (platform || '?') + '): ' + String(menuMsg || ''));

      function continueAfterNativeMenu() {
        var code = 'AEDRNO.multiNestNativeContinue(' +
          extendScriptStringLiteral(menuStep.payload) + ',' +
          (menuOk ? '1' : '0') + ',' +
          extendScriptStringLiteral(String(menuMsg || '')) +
          ')';
        evalScriptLogged('MULTI-NEST', code, function (nextRes) {
          handleMultiNestNativeMenuResponse(nextRes, done, stopNativeNestPump);
        }, 'multiNestNativeContinue', 'multiNestNativeContinue');
      }

      if (!menuOk) {
        setTimeout(continueAfterNativeMenu, 160);
        return;
      }

      setTimeout(function () {
        runNativeEnterForNestDialog(function (enterOk, enterMsg, enterPlatform, enterLabel) {
          if (debugMode) {
            logDebug('MULTI-NEST', 'Native dialog confirm ' + (enterOk ? 'OK' : 'SKIP/FAIL') + ' (' + (enterPlatform || platform || '?') + ' ' + (enterLabel || 'Enter') + '): ' + String(enterMsg || ''));
          }
          setTimeout(continueAfterNativeMenu, 620);
        });
      }, 220);
    });
  }

  function multiNestSelected(done) {
    try { setPanelProgress(6, 'MULTI-NEST: ladowanie modulu...'); } catch (ignoreProgressMn0) {}
    logInfo('MULTI-NEST', 'Tworze osobny NEST dla kazdego zaznaczonego klipu na timeline.');
    evalScriptLogged('MULTI-NEST', buildMultiNestEnsureModuleScript(), function (loaderRes) {
      logInfo('MULTI-NEST', loaderRes || 'Brak odpowiedzi loadera.');
      try { setPanelProgress(18, 'MULTI-NEST: analizuje zaznaczone klipy...'); } catch (ignoreProgressMn1) {}
      evalScriptLogged('MULTI-NEST', 'AEDRNO.multiNestSelectedClips()', function (res) {
        var clean = extractMultiNestUndoPayload(res);
        try {
          var undoInfo = parseJsonSafe(lastMultiNestUndoPayload);
          if (undoInfo && undoInfo.undoMode === 'snapshotUnNestBatch') {
            logInfo('MULTI-NEST', 'Snapshot cofania zapisany: ' + ((undoInfo.items && undoInfo.items.length) || 0) + ' NEST-ów.');
          }
        } catch (undoInfoErr) {}
        logInfo('MULTI-NEST', clean || 'Brak odpowiedzi z Premiere.');
        setPanelProgress(100, 'MULTI-NEST: gotowe');
        if (done) { done('MULTI-NEST gotowe'); }
      }, 'multiNestSelectedClips', 'multiNestSelectedClips');
    }, null, 'multiNestLoader');
  }

  function undoLastUnNest(done) {
    if (!lastUnNestUndoPayload) {
      logInfo('Cofanie', 'Brak zapisanego UN NEST do cofnięcia.');
      if (done) { done(); }
      return;
    }
    logInfo('Cofanie', 'Próbuję cofnąć ostatni UN NEST prawdziwym Undo Premiere...');
    var code = 'AEDRNO.undoLastUnNestByHistory(' + extendScriptStringLiteral(lastUnNestUndoPayload) + ')';
    evalHostAndRun(code, function (res) {
      logInfo('Cofanie', res || 'Brak odpowiedzi z Premiere.');
      if (done) { done(); }
    });
  }

  function runMultiNestSnapshotUndo(payloadJson, done) {
    var info = parseJsonSafe(payloadJson);
    var items = [];
    try { items = info && info.items && info.items.length ? info.items.slice(0) : []; } catch (itemsErr) { items = []; }
    if (!items.length) {
      logInfo('Cofanie', 'Ten MULTI-NEST nie ma snapshotu do cofnięcia bez historii. Uruchom MultiNest ponownie w tej wersji i wtedy cofanie będzie dostępne.');
      if (done) { done(); }
      return;
    }

    var total = items.length;
    var index = total - 1;
    var nativeStarted = 0;
    suppressUnNestUndoRegistration = true;
    logInfo('Cofanie', 'Cofam MULTI-NEST przez rozpakowanie snapshotu: ' + total + ' NEST-ów, od końca do początku.');

    function finishBatch() {
      suppressUnNestUndoRegistration = false;
      lastUnNestUndoPayload = null;
      if (nativeStarted > 0) {
        lastMultiNestUndoPayload = null;
        lastHistoryUndoAction = '';
      } else {
        lastHistoryUndoAction = 'MULTI_NEST';
      }
      try { setPanelProgress(100, 'Cofanie MULTI-NEST: gotowe'); } catch (ignoreProgressFinish) {}
      if (nativeStarted > 0) {
        logInfo('Cofanie', 'MULTI-NEST Undo zakończony. Snapshot ostatniego MultiNest został wyczyszczony.');
      } else {
        logInfo('Cofanie', 'MULTI-NEST Undo nie rozpoczął żadnego rozpakowania, więc snapshot zostaje do kolejnej próby.');
      }
      if (done) { done('Cofanie MULTI-NEST gotowe'); }
    }

    function step() {
      if (index < 0) {
        finishBatch();
        return;
      }
      var item = items[index] || {};
      var visibleNo = total - index;
      try { setPanelProgress(Math.min(96, 8 + Math.round((visibleNo - 1) / Math.max(1, total) * 86)), 'Cofanie MULTI-NEST: NEST ' + visibleNo + '/' + total); } catch (ignoreProgressStep) {}
      var request = {
        module: 'MULTI_NEST_UNDO_BATCH',
        version: info && info.version ? info.version : '',
        index: index,
        total: total,
        item: item
      };
      var code = 'AEDRNO.multiNestUndoPrepareOne(' + extendScriptStringLiteral(JSON.stringify(request)) + ')';
      evalHostAndRunForMultiNestUndo(code, function (res) {
        var nativeCopy = extractMarkerPayload(res, '__UNNEST_NATIVE_COPY__', '__END_UNNEST_NATIVE_COPY__');
        var clean = nativeCopy.clean || '';
        if (clean) { logInfo('MULTI-NEST Undo', clean); }
        if (!nativeCopy.payload) {
          logInfo('MULTI-NEST Undo', 'Nie udało się przygotować rozpakowania NEST-a #' + visibleNo + '. Przechodzę do następnego, jeśli istnieje.');
          index--;
          step();
          return;
        }
        nativeStarted++;
        runNativeUnNestKeyboardFlow(nativeCopy.payload, '', function () {
          index--;
          step();
        });
      }, 'multiNestUndoPrepareOne:' + index);
    }

    step();
  }

  function undoLastMultiNest(done) {
    if (!lastMultiNestUndoPayload) {
      logInfo('Cofanie', 'Brak zapisanego MULTI-NEST do cofnięcia.');
      if (done) { done(); }
      return;
    }
    var info = parseJsonSafe(lastMultiNestUndoPayload);
    if (info && info.undoMode === 'snapshotUnNestBatch') {
      runMultiNestSnapshotUndo(lastMultiNestUndoPayload, done);
      return;
    }
    logInfo('Cofanie', 'Ten zapis MULTI-NEST jest ze starszego trybu. Próbuję awaryjnie cofnąć go historią Premiere...');
    evalScriptLogged('MULTI-NEST Undo', buildMultiNestEnsureModuleScript(), function (loaderRes) {
      logInfo('MULTI-NEST Undo', loaderRes || 'Brak odpowiedzi loadera.');
      var code = 'AEDRNO.undoLastMultiNestByHistory(' + extendScriptStringLiteral(lastMultiNestUndoPayload) + ')';
      evalScriptLogged('MULTI-NEST Undo', code, function (res) {
        logInfo('Cofanie', res || 'Brak odpowiedzi z Premiere.');
        if (done) { done(); }
      }, 'undoLastMultiNestByHistory', 'multiNestUndo');
    }, null, 'multiNestUndoLoader');
  }

  function undoLastHistoryAction(done) {
    if (lastHistoryUndoAction === 'MULTI_NEST' && lastMultiNestUndoPayload) {
      undoLastMultiNest(done);
      return;
    }
    if (lastHistoryUndoAction === 'UN_NEST' && lastUnNestUndoPayload) {
      undoLastUnNest(done);
      return;
    }
    if (lastMultiNestUndoPayload) {
      undoLastMultiNest(done);
      return;
    }
    if (lastUnNestUndoPayload) {
      undoLastUnNest(done);
      return;
    }
    logInfo('Cofanie', 'Brak operacji UN NEST albo MULTI-NEST do cofnięcia.');
    if (done) { done(); }
  }

  /* ── Auto-Sync folderów systemowych ── */
  function normalizePath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/\/+$/g, '');
  }

  function getBaseName(path) {
    var p = normalizePath(path);
    var parts = p.split('/');
    return parts[parts.length - 1] || 'Folder';
  }

  function pathParts(path) {
    var p = normalizePath(path);
    if (!p) { return []; }
    return p.split('/').filter(function (part) { return !!part; });
  }

  var windowsLogicalDisksCache = { stamp: 0, disks: [] };

  function isWindowsPanelRuntime() {
    try {
      if (typeof process !== 'undefined' && process && process.platform === 'win32') { return true; }
    } catch (e0) {}
    try {
      if (typeof navigator !== 'undefined' && /Win/i.test(String(navigator.platform || ''))) { return true; }
    } catch (e1) {}
    return false;
  }

  function windowsLogicalDisksCached() {
    var now = Date.now();
    if (windowsLogicalDisksCache && windowsLogicalDisksCache.disks && (now - windowsLogicalDisksCache.stamp) < 10000) {
      return windowsLogicalDisksCache.disks;
    }
    var disks = [];
    try {
      if (!isWindowsPanelRuntime() || typeof require !== 'function') {
        windowsLogicalDisksCache = { stamp: now, disks: disks };
        return disks;
      }
      var childProcess = require('child_process');
      var out = '';
      try {
        var ps = "$ErrorActionPreference='SilentlyContinue'; " +
          "Get-CimInstance Win32_LogicalDisk | " +
          "Select-Object DeviceID,VolumeName | ConvertTo-Json -Compress";
        out = childProcess.execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
          windowsHide: true,
          encoding: 'utf8',
          timeout: 2500
        }) || '';
        if (out) {
          var parsed = JSON.parse(String(out).trim() || '[]');
          if (parsed && !parsed.length) { parsed = [parsed]; }
          for (var i = 0; parsed && i < parsed.length; i++) {
            if (parsed[i] && parsed[i].DeviceID) {
              disks.push({ device: String(parsed[i].DeviceID).toUpperCase(), label: String(parsed[i].VolumeName || '') });
            }
          }
        }
      } catch (psErr) {
        try {
          out = childProcess.execFileSync('wmic.exe', ['logicaldisk', 'get', 'DeviceID,VolumeName', '/format:csv'], {
            windowsHide: true,
            encoding: 'utf8',
            timeout: 2500
          }) || '';
          var lines = String(out || '').split(/\r?\n/);
          for (var l = 0; l < lines.length; l++) {
            var line = String(lines[l] || '').trim();
            if (!line || line.indexOf('DeviceID') >= 0) { continue; }
            var cols = line.split(',');
            if (cols.length >= 3 && /^[A-Za-z]:$/.test(String(cols[1] || '').trim())) {
              disks.push({ device: String(cols[1]).trim().toUpperCase(), label: String(cols[2] || '').trim() });
            }
          }
        } catch (wmicErr) {}
      }
    } catch (e2) {}
    windowsLogicalDisksCache = { stamp: now, disks: disks };
    return disks;
  }

  function normalizeVolumeLabelForCompare(s) {
    return String(s || '').trim().toLowerCase();
  }

  function windowsDriveLabelForRoot(driveRoot) {
    driveRoot = String(driveRoot || '').toUpperCase().replace(/\\/g, '/').replace(/\/+$/g, '');
    if (!/^[A-Z]:$/.test(driveRoot)) { return ''; }
    var disks = windowsLogicalDisksCached();
    for (var i = 0; i < disks.length; i++) {
      if (String(disks[i].device || '').toUpperCase() === driveRoot) { return String(disks[i].label || ''); }
    }
    return '';
  }

  function getVolumeNameFromPath(path) {
    var p = normalizePath(path);
    var parts = pathParts(p);
    if (!parts.length) { return ''; }

    // macOS /Volumes/SAMSUNG T7/SFX
    if (parts[0] === 'Volumes' && parts.length > 1) { return parts[1]; }

    // Windows E:/SFX. Zapisujemy nazwę woluminu, jeżeli da się ją odczytać,
    // żeby ścieżki mogły przechodzić między Windows i macOS po nazwie dysku.
    if (/^[A-Za-z]:$/.test(parts[0])) {
      var label = windowsDriveLabelForRoot(parts[0]);
      return label || parts[0].toUpperCase();
    }

    // Linux /media/user/SAMSUNG T7/SFX albo /run/media/user/SAMSUNG T7/SFX
    if ((parts[0] === 'media' || parts[0] === 'mnt') && parts.length > 1) {
      return parts.length > 2 ? parts[2] : parts[1];
    }
    if (parts[0] === 'run' && parts[1] === 'media' && parts.length > 3) { return parts[3]; }

    return parts[0];
  }

  function getPathInsideVolume(path) {
    var parts = pathParts(path);
    if (!parts.length) { return ''; }

    if (parts[0] === 'Volumes' && parts.length > 2) { return parts.slice(2).join('/'); }
    if (/^[A-Za-z]:$/.test(parts[0])) { return parts.slice(1).join('/'); }
    if ((parts[0] === 'media' || parts[0] === 'mnt') && parts.length > 2) { return parts.slice(3).join('/'); }
    if (parts[0] === 'run' && parts[1] === 'media' && parts.length > 4) { return parts.slice(4).join('/'); }

    return parts.slice(1).join('/');
  }

  function buildPortablePathInfo(path) {
    path = normalizePath(path);
    return {
      originalPath: path,
      volumeName: getVolumeNameFromPath(path),
      relativePath: getPathInsideVolume(path)
    };
  }

  function isWindowsPath(path) {
    return /^[A-Za-z]:\//.test(normalizePath(path));
  }

  function isMacVolumesPath(path) {
    return normalizePath(path).indexOf('/Volumes/') === 0;
  }

  function macPathFromPortable(volumeName, rel) {
    volumeName = String(volumeName || '').trim();
    rel = normalizePath(rel || '');
    if (!volumeName || /^[A-Za-z]:$/.test(volumeName)) { return ''; }
    return joinPathPortable('/Volumes/' + volumeName, rel);
  }

  function updateFolderPlatformPaths(folder, path) {
    if (!folder) { return; }
    path = normalizePath(path || folder.path || '');
    if (!path) { return; }
    var info = buildPortablePathInfo(path);
    folder.volumeName = folder.volumeName || info.volumeName;
    folder.relativePath = folder.relativePath || info.relativePath;
    folder.portablePath = { volumeName: folder.volumeName || '', relativePath: folder.relativePath || '' };
    folder.paths = folder.paths || {};

    if (isWindowsPath(path)) { folder.paths.windows = path; folder.windowsPath = path; }
    if (isMacVolumesPath(path)) { folder.paths.macos = path; folder.macosPath = path; }

    if (!folder.paths.macos && folder.volumeName && folder.relativePath) {
      var mp = macPathFromPortable(folder.volumeName, folder.relativePath);
      if (mp) { folder.paths.macos = mp; folder.macosPath = mp; }
    }
    if (!folder.paths.windows && folder.windowsPath) { folder.paths.windows = normalizePath(folder.windowsPath); }
    if (!folder.paths.macos && folder.macosPath) { folder.paths.macos = normalizePath(folder.macosPath); }
  }

  function joinPathPortable(root, rel) {
    root = normalizePath(root);
    rel = normalizePath(rel);
    if (!root) { return rel; }
    if (!rel) { return root; }
    return root + '/' + rel;
  }

  function folderExistsRaw(path) {
    path = normalizePath(path);
    if (!path) { return false; }
    try {
      var fs = projectTimerGetFs();
      if (fs && fs.existsSync(path)) {
        try { return fs.statSync(path).isDirectory(); } catch (e1) { return true; }
      }
    } catch (e2) {}
    return false;
  }

  function candidateVolumeRoots(volumeName) {
    var roots = [];
    volumeName = String(volumeName || '').trim();
    if (!volumeName) { return roots; }

    try {
      var fs = projectTimerGetFs();

      // macOS
      if (fs && fs.existsSync('/Volumes')) {
        roots.push('/Volumes/' + volumeName);
      }

      // Windows: jeżeli zapisany "volumeName" jest nazwą woluminu z macOS
      // np. /Volumes/WK DZIK/..., znajdź aktualną literę dysku o tej samej nazwie.
      try {
        var disks = windowsLogicalDisksCached();
        var wanted = normalizeVolumeLabelForCompare(volumeName);
        for (var d = 0; d < disks.length; d++) {
          var dev = String(disks[d].device || '').toUpperCase();
          var label = normalizeVolumeLabelForCompare(disks[d].label || '');
          if (dev && label && label === wanted) { roots.push(dev); }
        }
      } catch (winLabelErr) {}

      // Windows fallback: jeżeli zapisany "volumeName" jest literą dysku, sprawdź ten dysk.
      if (/^[A-Za-z]:$/.test(volumeName)) {
        try {
          if (fs && fs.existsSync(volumeName + '/')) { roots.push(volumeName.toUpperCase()); }
        } catch (winDriveErr) {}
      }

      // Linux / inne montowania awaryjne.
      var fallbackRoots = ['/media', '/mnt', '/run/media'];
      for (var r = 0; r < fallbackRoots.length; r++) {
        try {
          if (fs && fs.existsSync(fallbackRoots[r])) {
            roots.push(fallbackRoots[r] + '/' + volumeName);
          }
        } catch (e3) {}
      }
    } catch (e4) {}

    var seen = {};
    var clean = [];
    for (var x = 0; x < roots.length; x++) {
      var rr = normalizePath(roots[x]);
      if (rr && !seen[rr.toLowerCase()]) { seen[rr.toLowerCase()] = true; clean.push(rr); }
    }
    return clean;
  }

  function resolvePortableFolderPath(folder) {
    if (!folder) { return ''; }
    ensureFolderPortableInfo(folder);

    var platformCandidates = [];
    try {
      if (isWindowsPanelRuntime()) {
        if (folder.paths && folder.paths.windows) { platformCandidates.push(folder.paths.windows); }
        if (folder.windowsPath) { platformCandidates.push(folder.windowsPath); }
      } else {
        if (folder.paths && folder.paths.macos) { platformCandidates.push(folder.paths.macos); }
        if (folder.macosPath) { platformCandidates.push(folder.macosPath); }
      }
    } catch (ePlatform) {}
    var p = normalizePath(folder.path || '');
    if (p) { platformCandidates.push(p); }
    var seenCandidates = {};
    for (var pc = 0; pc < platformCandidates.length; pc++) {
      var candidatePath = normalizePath(platformCandidates[pc]);
      var keyCandidate = candidatePath.toLowerCase();
      if (candidatePath && !seenCandidates[keyCandidate]) {
        seenCandidates[keyCandidate] = true;
        if (folderExistsRaw(candidatePath)) { return candidatePath; }
      }
    }

    var volumeName = folder.volumeName || (folder.portablePath && folder.portablePath.volumeName) || '';
    var rel = folder.relativePath || (folder.portablePath && folder.portablePath.relativePath) || '';
    if (!volumeName || !rel) { return p; }

    var roots = candidateVolumeRoots(volumeName);
    for (var i = 0; i < roots.length; i++) {
      var candidate = joinPathPortable(roots[i], rel);
      if (folderExistsRaw(candidate)) { return candidate; }
    }
    return p;
  }

  function ensureFolderPortableInfo(folder) {
    if (!folder) { return; }
    var basePath = folder.path || folder.windowsPath || folder.macosPath || (folder.paths && (folder.paths.windows || folder.paths.macos)) || '';
    if (!basePath && folder.volumeName && folder.relativePath) { basePath = macPathFromPortable(folder.volumeName, folder.relativePath); }
    if (!basePath) { return; }
    folder.path = normalizePath(folder.path || basePath);
    updateFolderPlatformPaths(folder, basePath);
  }

  var premiereLabelColors = [
    { value: '0', name: 'Violet', hex: '#8e63c7' },
    { value: '1', name: 'Iris', hex: '#6d7fd6' },
    { value: '2', name: 'Caribbean', hex: '#35a6b8' },
    { value: '3', name: 'Lavender', hex: '#b58ad8' },
    { value: '4', name: 'Cerulean', hex: '#4d9de0' },
    { value: '5', name: 'Forest', hex: '#3f8f55' },
    { value: '6', name: 'Rose', hex: '#d65a8a' },
    { value: '7', name: 'Mango', hex: '#f0a23a' },
    { value: '8', name: 'Purple', hex: '#9b59b6' },
    { value: '9', name: 'Blue', hex: '#3b7ddd' },
    { value: '10', name: 'Teal', hex: '#2aa198' },
    { value: '11', name: 'Magenta', hex: '#d33682' },
    { value: '12', name: 'Tan', hex: '#c2a476' },
    { value: '13', name: 'Green', hex: '#5cb85c' },
    { value: '14', name: 'Brown', hex: '#8b5a2b' },
    { value: '15', name: 'Yellow', hex: '#ffd84d' }
  ];

  function colorHex(value) {
    value = String(value);
    for (var i = 0; i < premiereLabelColors.length; i++) {
      if (premiereLabelColors[i].value === value) { return premiereLabelColors[i].hex; }
    }
    return '#555555';
  }

  function colorOptions(selected) {
    selected = String(selected);
    var html = '';
    for (var i = 0; i < premiereLabelColors.length; i++) {
      var opt = premiereLabelColors[i];
      html += '<option value="' + opt.value + '"' + (selected === opt.value ? ' selected' : '') + '>' + opt.name + '</option>';
    }
    return html;
  }

  function nextAutoSyncColorValue() {
    if (!premiereLabelColors.length) { return '0'; }
    var idx = 0;
    try { idx = syncFolders ? syncFolders.length : 0; } catch (e) { idx = 0; }
    return premiereLabelColors[idx % premiereLabelColors.length].value;
  }


  function subfolderOptions(selected) {
    selected = String(selected === false ? 'false' : selected);
    var onSelected = selected !== 'false' ? ' selected' : '';
    var offSelected = selected === 'false' ? ' selected' : '';
    return '<option value="true"' + onSelected + '>Włączone</option><option value="false"' + offSelected + '>Wyłączone</option>';
  }

  function saveSyncFolders() {
    try { projectTimerSaveCurrent(); } catch (e) {}
  }

  function saveFolderSyncEnabled() {
    try { projectTimerSaveCurrent(); } catch (e) {}
  }

  function loadSyncFolders() {
    // Foldery Auto-Sync są teraz wczytywane z pliku ustawień konkretnego projektu:
    // (nazwa projektu)_verni_settings.json obok pliku .prproj.
    if (!syncFolders) { syncFolders = []; }
  }

  function htmlEsc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function folderPathExists(path) {
    return folderExistsRaw(path);
  }

  function setFolderLinkedState(idx, linked, notifyMissing) {
    if (isNaN(idx) || !syncFolders[idx]) { return; }
    var f = syncFolders[idx];
    var changed = (f.linked !== linked);
    f.linked = !!linked;
    if (linked) { f.missingNotified = false; }
    if (!linked && notifyMissing && !f.missingNotified) {
      f.missingNotified = true;
      showFolderMissingModal(f.name || getBaseName(f.path), f.path || '');
    }
    if (changed || notifyMissing) {
      saveSyncFolders();
      renderSyncFolders();
    }
  }

  function showFolderMissingModal(name, path) {
    var overlay = byId('folderSyncMissingOverlay');
    var question = byId('folderSyncMissingQuestion');
    if (question) {
      question.textContent = 'Nie znaleziono folderu "' + (name || 'Auto-Sync') + '". Sprawdź, czy folder nie został przeniesiony albo usunięty. Ścieżka: ' + (path || 'brak ścieżki');
    }
    if (overlay) { overlay.classList.remove('hidden'); }
  }

  function closeFolderMissingModal() {
    var overlay = byId('folderSyncMissingOverlay');
    if (overlay) { overlay.classList.add('hidden'); }
  }

  function checkFolderLinks(showAlerts) {
    if (!syncFolders || !syncFolders.length) { return; }
    var changed = false;
    for (var i = 0; i < syncFolders.length; i++) {
      var f = syncFolders[i];
      ensureFolderPortableInfo(f);
      var resolvedPath = resolvePortableFolderPath(f);
      var exists = folderPathExists(resolvedPath || f.path);

      if (exists && resolvedPath && normalizePath(resolvedPath).toLowerCase() !== normalizePath(f.path).toLowerCase()) {
        f.path = resolvedPath;
        f.linked = true;
        f.missingNotified = false;
        changed = true;
      }

      if (exists) {
        if (f.linked === false || f.missingNotified) {
          f.linked = true;
          f.missingNotified = false;
          changed = true;
        }
      } else {
        if (f.linked !== false) {
          f.linked = false;
          changed = true;
        }
        if (showAlerts && !f.missingNotified) {
          f.missingNotified = true;
          changed = true;
          showFolderMissingModal(f.name || getBaseName(f.path), f.path || '');
        }
      }
    }
    if (changed) {
      saveSyncFolders();
      renderSyncFolders();
    }
  }

  function startFolderLinkTimer() {
    stopFolderLinkTimer();
    checkFolderLinks(false);
    folderSyncLinkTimer = setInterval(function () { checkFolderLinks(true); }, 10000);
  }

  function stopFolderLinkTimer() {
    if (folderSyncLinkTimer) {
      clearInterval(folderSyncLinkTimer);
      folderSyncLinkTimer = null;
    }
  }

  function applyRelinkedFolderPath(idx, rawPath) {
    if (isNaN(idx) || !syncFolders[idx]) { return; }
    var path = normalizePath(rawPath || '');
    if (!path || path === '__CANCEL__') { return; }
    syncFolders[idx].path = path;
    var portable = buildPortablePathInfo(path);
    syncFolders[idx].volumeName = portable.volumeName;
    syncFolders[idx].relativePath = portable.relativePath;
    syncFolders[idx].portablePath = { volumeName: portable.volumeName, relativePath: portable.relativePath };
    updateFolderPlatformPaths(syncFolders[idx], path);
    syncFolders[idx].linked = true;
    syncFolders[idx].missingNotified = false;
    if (!syncFolders[idx].name) { syncFolders[idx].name = getBaseName(path); }
    saveSyncFolders();
    renderSyncFolders();
    refreshFolderSyncReadiness(false);
    logInfo('AutoSync', 'Zmieniono ścieżkę folderu: ' + syncFolders[idx].name + ' — ' + path);
    if (folderSyncEnabled) { syncOneFolder(syncFolders[idx], false, true); }
  }

  function addSyncFolderFromDialog(rawPath) {
    var path = normalizePath(rawPath || '');
    if (!path || path === '__CANCEL__') { return; }
    addSyncFolder(path);
  }

  function chooseFolderForAutoSyncAdd() {
    try {
      if (window.cep && window.cep.fs && window.cep.fs.showOpenDialogEx) {
        var result = window.cep.fs.showOpenDialogEx(false, true, 'Wskaż folder do Auto-Sync', '', [], '');
        if (result && result.err === 0 && result.data && result.data.length) {
          addSyncFolderFromDialog(result.data[0]);
        }
        // Jeżeli dialog CEP został otwarty, anulowanie jest końcem akcji.
        // Nie odpalamy drugiego fallbackowego eksploratora po kliknięciu „Anuluj”.
        if (result) { return; }
      }
    } catch (e1) {
      logWarn('AutoSync', 'Wybór folderu przez CEP nie zadziałał, próbuję przez Premiere: ' + e1);
    }

    try {
      if (window.cep && window.cep.fs && window.cep.fs.showOpenDialog) {
        var result2 = window.cep.fs.showOpenDialog(false, true, 'Wskaż folder do Auto-Sync', '', []);
        if (result2 && result2.err === 0 && result2.data && result2.data.length) {
          addSyncFolderFromDialog(result2.data[0]);
        }
        // Tak samo tutaj: anulowanie wyboru folderu nie ma przechodzić do kolejnego dialogu.
        if (result2) { return; }
      }
    } catch (e2) {
      logWarn('AutoSync', 'Fallback wyboru folderu przez CEP nie zadziałał, próbuję przez Premiere: ' + e2);
    }

    evalScriptLogged('AutoSync wybór folderu', 'AEDRNO.selectFolderDialog()', function (res) {
      addSyncFolderFromDialog(res || '');
    }, 'selectFolderDialog', 'autoSyncAddFolderSelect');
  }

  function relinkSyncFolder(idx) {
    if (isNaN(idx) || !syncFolders[idx]) { return; }

    try {
      if (window.cep && window.cep.fs && window.cep.fs.showOpenDialogEx) {
        var result = window.cep.fs.showOpenDialogEx(false, true, 'Wskaż nową ścieżkę folderu Auto-Sync', '', [], '');
        if (result && result.err === 0 && result.data && result.data.length) {
          applyRelinkedFolderPath(idx, result.data[0]);
        }
        if (result) { return; }
      }
    } catch (e1) {
      logWarn('AutoSync', 'Wybór folderu przez CEP nie zadziałał, próbuję przez Premiere: ' + e1);
    }

    try {
      if (window.cep && window.cep.fs && window.cep.fs.showOpenDialog) {
        var result2 = window.cep.fs.showOpenDialog(false, true, 'Wskaż nową ścieżkę folderu Auto-Sync', '', []);
        if (result2 && result2.err === 0 && result2.data && result2.data.length) {
          applyRelinkedFolderPath(idx, result2.data[0]);
        }
        if (result2) { return; }
      }
    } catch (e2) {
      logWarn('AutoSync', 'Fallback wyboru folderu przez CEP nie zadziałał, próbuję przez Premiere: ' + e2);
    }

    evalScriptLogged('AutoSync wybór folderu', 'AEDRNO.selectFolderDialog()', function (res) {
      applyRelinkedFolderPath(idx, res || '');
    }, 'selectFolderDialog', 'autoSyncSelectFolder');
  }

  var pendingFolderSyncRemoveIndex = -1;

  function closeFolderRemoveConfirm() {
    var overlay = byId('folderSyncConfirmOverlay');
    if (overlay) { overlay.classList.add('hidden'); }
    pendingFolderSyncRemoveIndex = -1;
  }

  function openFolderRemoveConfirm(idx) {
    if (isNaN(idx) || !syncFolders[idx]) { return; }
    pendingFolderSyncRemoveIndex = idx;
    var overlay = byId('folderSyncConfirmOverlay');
    var question = byId('folderSyncConfirmQuestion');
    if (question) {
      question.textContent = 'Czy chcesz usunąć ' + syncFolders[idx].name + ' z automatycznej synchronizacji?';
    }
    if (overlay) { overlay.classList.remove('hidden'); }
  }

  function confirmFolderRemove() {
    var idx = pendingFolderSyncRemoveIndex;
    if (!isNaN(idx) && syncFolders[idx]) {
      var name = syncFolders[idx].name;
      syncFolders.splice(idx, 1);
      saveSyncFolders();
      renderSyncFolders();
      refreshFolderSyncReadiness(false);
      logInfo('AutoSync', 'Usunięto folder: ' + name);
    }
    closeFolderRemoveConfirm();
  }

  function renderSyncFolders() {
    var list = byId('folderSyncList');
    if (!list) { return; }
    if (!syncFolders.length) {
      list.innerHTML = '<div class="folder-sync-empty">Brak dodanych folderów do Auto-Sync.</div>';
      return;
    }
    list.innerHTML = '';
    for (var i = 0; i < syncFolders.length; i++) {
      var f = syncFolders[i];
      var row = document.createElement('div');
      row.className = 'folder-sync-row';
      var linkOk = f.linked !== false;
      var safeName = htmlEsc(f.name);
      var safePath = htmlEsc(f.path);
      row.innerHTML = '' +
        '<div class="folder-sync-name" title="' + safeName + '"><span class="folder-sync-mobile-label">Nazwa folderu</span><span class="folder-sync-value">' + safeName + '</span></div>' +
        '<div class="folder-sync-link"><span class="folder-sync-mobile-label">Link</span><span class="folder-sync-link-inner">' +
          '<span class="folder-sync-link-status ' + (linkOk ? 'ok' : 'bad') + '" title="' + (linkOk ? 'Folder poprawnie podlinkowany' : 'Folder nie istnieje pod zapisaną ścieżką') + '">' + (linkOk ? '✓' : '×') + '</span>' +
          (linkOk ? '' : '<button class="folder-sync-relink" data-index="' + i + '" title="Wskaż nową ścieżkę folderu">📁</button>') +
        '</span></div>' +
        '<div class="folder-sync-path" title="' + safePath + '"><span class="folder-sync-mobile-label">Ścieżka folderu systemowego</span><span class="folder-sync-value">' + safePath + '</span></div>' +
        '<div class="folder-sync-subfolders-cell"><span class="folder-sync-mobile-label">Synchronizacja<br>podfolderów</span><select class="folder-sync-subfolders" data-index="' + i + '">' + subfolderOptions(f.subfolders) + '</select></div>' +
        '<div class="folder-sync-color-cell"><span class="folder-sync-mobile-label">Kolor</span><div class="folder-sync-color-control"><span class="folder-sync-color-swatch" style="background:' + colorHex(f.color) + '"></span><select class="folder-sync-color" data-index="' + i + '">' + colorOptions(f.color) + '</select></div></div>' +
        '<div class="folder-sync-folder-status ' + (f.paused === true ? 'paused' : 'active') + '"><span class="folder-sync-mobile-label">Status</span><span class="folder-sync-value">' + (f.paused === true ? 'Auto-Sync zatrzymany' : 'Auto-Sync aktywny') + '</span></div>' +
        '<div class="folder-sync-row-actions"><span class="folder-sync-mobile-label">Akcje</span><div class="folder-sync-actions-buttons">' +
          '<button class="folder-sync-folder-pause ' + (f.paused === true ? 'is-paused' : '') + '" data-index="' + i + '" title="' + (f.paused === true ? 'Wznów synchronizację tego folderu' : 'Pauzuj synchronizację tego folderu') + '">' + (f.paused === true ? '▶' : '<span class="pause-bars" aria-hidden="true"></span>') + '</button>' +
          '<button class="folder-sync-remove" data-index="' + i + '" title="Usuń synchronizację">×</button>' +
        '</div></div>';
      list.appendChild(row);
    }

    var pauseButtons = list.querySelectorAll('.folder-sync-folder-pause');
    for (var pb = 0; pb < pauseButtons.length; pb++) {
      pauseButtons[pb].onclick = function () {
        var idx = parseInt(this.getAttribute('data-index'), 10);
        if (!isNaN(idx) && syncFolders[idx]) {
          syncFolders[idx].paused = syncFolders[idx].paused === true ? false : true;
          saveSyncFolders();
          renderSyncFolders();
          logInfo('AutoSync', (syncFolders[idx].paused === true ? 'Zapauzowano folder: ' : 'Wznowiono folder: ') + syncFolders[idx].name);
          if (syncFolders[idx].paused !== true) { syncOneFolder(syncFolders[idx], false); }
        }
      };
    }

    var removes = list.querySelectorAll('.folder-sync-remove');
    for (var r = 0; r < removes.length; r++) {
      removes[r].onclick = function () {
        var idx = parseInt(this.getAttribute('data-index'), 10);
        openFolderRemoveConfirm(idx);
      };
    }

    var relinks = list.querySelectorAll('.folder-sync-relink');
    for (var rl = 0; rl < relinks.length; rl++) {
      relinks[rl].onclick = function () {
        var idx = parseInt(this.getAttribute('data-index'), 10);
        relinkSyncFolder(idx);
      };
    }

    var subfolderSelects = list.querySelectorAll('.folder-sync-subfolders');
    for (var sfSel = 0; sfSel < subfolderSelects.length; sfSel++) {
      subfolderSelects[sfSel].onchange = function () {
        var idx = parseInt(this.getAttribute('data-index'), 10);
        if (!isNaN(idx) && syncFolders[idx]) {
          syncFolders[idx].subfolders = this.value !== 'false';
          saveSyncFolders();
          syncOneFolder(syncFolders[idx], false);
        }
      };
    }

    var selects = list.querySelectorAll('.folder-sync-color');
    for (var c = 0; c < selects.length; c++) {
      selects[c].onchange = function () {
        var idx = parseInt(this.getAttribute('data-index'), 10);
        if (!isNaN(idx) && syncFolders[idx]) {
          syncFolders[idx].color = this.value;
          var swatch = this.parentNode ? this.parentNode.querySelector('.folder-sync-color-swatch') : null;
          if (swatch) { swatch.style.background = colorHex(this.value); }
          saveSyncFolders();
          syncOneFolder(syncFolders[idx], false, false, true);
        }
      };
    }
  }

  function addSyncFolder(path) {
    path = normalizePath(path);
    if (!path) { return; }
    if (!projectTimerCurrentInfo || !projectTimerCurrentInfo.settingsPath) {
      logWarn('AutoSync', 'Najpierw zapisz projekt .prproj. Foldery Auto-Sync są zapisywane wyłącznie w JSON-ie obok projektu.');
      return;
    }
    for (var i = 0; i < syncFolders.length; i++) {
      if (normalizePath(syncFolders[i].path).toLowerCase() === path.toLowerCase()) {
        logWarn('AutoSync', 'Ten folder jest już dodany: ' + path);
        return;
      }
    }
    var portable = buildPortablePathInfo(path);
    var folder = {
      name: getBaseName(path),
      path: path,
      volumeName: portable.volumeName,
      relativePath: portable.relativePath,
      portablePath: { volumeName: portable.volumeName, relativePath: portable.relativePath },
      paths: {},
      color: nextAutoSyncColorValue(),
      subfolders: true,
      linked: true,
      missingNotified: false,
      paused: false
    };
    updateFolderPlatformPaths(folder, path);
    syncFolders.push(folder);
    saveSyncFolders();
    renderSyncFolders();
    refreshFolderSyncReadiness(false);
    logInfo('AutoSync', 'Dodano folder: ' + folder.name + ' — ' + folder.path);
    if (folderSyncEnabled) { syncOneFolder(folder, false); }
  }

  function getDroppedPaths(e) {
    var out = [];
    try {
      var files = e.dataTransfer.files;
      for (var i = 0; files && i < files.length; i++) {
        var p = files[i].path || files[i].name || '';
        if (p) { out.push(p); }
      }
    } catch (err) {}
    try {
      var txt = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list') || '';
      if (txt && !out.length) {
        var lines = txt.split(/\r?\n/);
        for (var j = 0; j < lines.length; j++) {
          var line = lines[j].replace(/^file:\/\//, '').replace(/^\/+([A-Za-z]:)/, '$1');
          if (line) { out.push(decodeURIComponent(line)); }
        }
      }
    } catch (err2) {}
    return out;
  }

  function bindFolderSyncUI() {
    var drop = byId('folderSyncDrop');
    if (!drop) { return; }
    drop.ondragover = function (e) {
      e.preventDefault();
      drop.classList.add('drag-over');
    };
    drop.ondragleave = function (e) {
      e.preventDefault();
      drop.classList.remove('drag-over');
    };
    drop.ondrop = function (e) {
      e.preventDefault();
      drop.classList.remove('drag-over');
      var paths = getDroppedPaths(e);
      if (!paths.length) {
        logWarn('AutoSync', 'Nie udało się odczytać ścieżki folderu z drag & drop. Spróbuj przeciągnąć folder bezpośrednio z Eksploratora plików albo kliknij pole i wybierz folder.');
        return;
      }
      for (var i = 0; i < paths.length; i++) { addSyncFolder(paths[i]); }
    };
    drop.onclick = function () {
      chooseFolderForAutoSyncAdd();
    };
    drop.onkeydown = function (e) {
      e = e || window.event;
      var key = e.key || e.keyCode;
      if (key === 'Enter' || key === ' ' || key === 13 || key === 32) {
        if (e.preventDefault) { e.preventDefault(); }
        chooseFolderForAutoSyncAdd();
      }
    };
    var enabled = byId('folderSyncEnabled');
    if (enabled) {
      enabled.checked = folderSyncEnabled;
      enabled.onchange = function () { setFolderSyncEnabled(!!this.checked, false); };
    }
    updateIosToggle('folderSyncModuleToggle', folderSyncEnabled);
    var now = byId('folderSyncNow');
    if (now) { now.onclick = function () { runPanelAction('Synchronizacja folderów...', function (done) { syncAllFolders(false, done); }, 'AutoSync / Synchronizuj teraz', 'manual'); }; }
  }

  function syncOneFolder(folder, silent, relinkMode, done) {
    if (!folder || !folder.path) { if (done) { done(); } return; }
    if (folder.paused === true) {
      if (!silent) { logInfo('AutoSync', 'Folder jest zapauzowany: ' + (folder.name || folder.path)); }
      if (done) { done(); }
      return;
    }
    ensureFolderPortableInfo(folder);
    var resolvedPath = resolvePortableFolderPath(folder);
    if (resolvedPath && normalizePath(resolvedPath).toLowerCase() !== normalizePath(folder.path).toLowerCase()) {
      folder.path = resolvedPath;
      updateFolderPlatformPaths(folder, resolvedPath);
      folder.linked = true;
      folder.missingNotified = false;
      saveSyncFolders();
      renderSyncFolders();
      if (!silent) { logInfo('AutoSync', 'Odnaleziono folder po nazwie dysku/woluminu: ' + folder.name + ' — ' + resolvedPath); }
    }

    var folderIndex = -1;
    try { for (var fi = 0; fi < syncFolders.length; fi++) { if (syncFolders[fi] === folder) { folderIndex = fi; break; } } } catch (eFi) {}
    if (!folderPathExists(resolvedPath || folder.path)) {
      if (folderIndex >= 0) { setFolderLinkedState(folderIndex, false, !silent); }
      if (!silent) { logWarn('AutoSync', 'Folder nie istnieje albo został przeniesiony: ' + folder.path); }
      if (done) { done(); }
      return;
    }
    if (folder.linked === false) {
      folder.linked = true;
      folder.missingNotified = false;
      saveSyncFolders();
      renderSyncFolders();
    }
    var colorValue = parseInt(folder.color, 10);
    if (isNaN(colorValue)) { colorValue = -1; }
    var includeSubfolders = folder.subfolders !== false;
    relinkMode = relinkMode === true;
    var legacyForceColorApply = done === true;
    if (legacyForceColorApply) { done = null; }
    var syncPath = resolvedPath || folder.path;
    var forceColorApply = legacyForceColorApply || (arguments.length >= 5 && arguments[4] === true);
    var code = "AEDRNO.syncSystemFolder('" + esc(syncPath) + "','" + esc(folder.name) + "'," + colorValue + "," + (includeSubfolders ? 'true' : 'false') + "," + (relinkMode ? 'true' : 'false') + "," + (forceColorApply ? 'true' : 'false') + ")";
    if (!silent || backgroundLogsEnabled) {
      logDebug('AutoSync', 'Synchronizacja folderu: name=' + folder.name + ', path=' + syncPath + ', subfolders=' + includeSubfolders + ', color=' + colorValue + ', relinkMode=' + relinkMode + ', silent=' + silent);
    }
    if (silent && backgroundLogsEnabled) { logSeparator('AutoSync folder: ' + (folder.name || 'Folder'), 'START', 'background'); }
    evalScriptLogged('AutoSync folder', code, function (res) {
      if (!silent || backgroundLogsEnabled) {
        logInfo('AutoSync', res || 'Brak odpowiedzi z Premiere.');
      }
      if (silent && backgroundLogsEnabled) { logSeparator('AutoSync folder: ' + (folder.name || 'Folder'), 'KONIEC', 'background'); }
      if (done) { done(); }
    }, 'syncSystemFolder', 'autoSyncFolder:' + normalizePath(syncPath).toLowerCase(), { quietDebug: silent && !backgroundLogsEnabled });
  }

  function syncAllFolders(silent, done) {
    if (folderSyncRunning) {
      if (!silent) { logInfo('AutoSync', 'Synchronizacja jest już w toku — pomijam równoległe uruchomienie.'); }
      if (done) { done(); }
      return;
    }
    if (!syncFolders.length) {
      if (!silent) { logInfo('AutoSync', 'Brak folderów do Auto-Sync.'); }
      if (done) { done(); }
      return;
    }

    folderSyncRunning = true;
    var queue = syncFolders.slice ? syncFolders.slice(0) : syncFolders;
    var index = 0;

    function finish() {
      folderSyncRunning = false;
      if (done) { done(); }
    }

    function next() {
      if (index >= queue.length) { finish(); return; }
      var folder = queue[index];
      index += 1;
      try {
        syncOneFolder(folder, silent, false, next);
      } catch (e) {
        logError('AutoSync', errorText(e));
        next();
      }
    }

    next();
  }

  function stopFolderSyncTimer() {
    if (folderSyncTimer) {
      clearInterval(folderSyncTimer);
      folderSyncTimer = null;
    }
  }

  function startFolderSyncTimer() {
    stopFolderSyncTimer();
    if (!folderSyncEnabled) { return; }
    folderSyncTimer = setInterval(function () { syncAllFolders(true); }, FOLDER_SYNC_INTERVAL_MS);
    if (syncFolders.length) { syncAllFolders(true); }
  }

  /* ── Auto-Check ── */
  function startWatch(auto) {
    if (!organizerAutoCheckEnabled) { return; }
    var seconds = ORGANIZER_AUTO_CHECK_INTERVAL_SECONDS;
    if (timer) { clearInterval(timer); }
    saveSettings();
    scan(auto ? true : false);
    timer = setInterval(function () { scan(true); }, seconds * 1000);
    var startBtn = byId('startWatch');
    var stopBtn = byId('stopWatch');
    if (startBtn) { startBtn.disabled = true; }
    if (stopBtn) { stopBtn.disabled = false; }
    logInfo('Organizer', (auto ? 'Autostart: Auto-Check uruchomiony co ' : 'Auto-Check uruchomiony co ') + seconds + ' s.');
  }

  function stopWatch(silent) {
    if (timer) { clearInterval(timer); timer = null; }
    var startBtn = byId('startWatch');
    var stopBtn = byId('stopWatch');
    if (startBtn) { startBtn.disabled = false; }
    if (stopBtn) { stopBtn.disabled = true; }
    if (!silent) { logInfo('Organizer', 'Auto-Check zatrzymany.'); }
  }

  /* ── Autosave ustawień ── */
  function bindSettingAutosave() {
    var ids = ['aeBinName', 'nestBinName', 'keywords', 'nestKeywords',
               'autoStart', 'tcSyncMode', 'tcOffset', 'tcInsertType',
               'splitX', 'splitY', 'splitGapX', 'splitGapY', 'splitMode', 'splitOrderByTracks'];
    for (var i = 0; i < ids.length; i++) {
      var el = byId(ids[i]);
      if (!el) { continue; }
      el.onchange = (function (elRef) {
        return function () {
          saveSettings();
          if (elRef.id === 'splitX' || elRef.id === 'splitY') { updateSplitPreview(); }
        };
      }(el));
      el.onkeyup = function () { saveSettings(); if (this.id === 'splitX' || this.id === 'splitY') { updateSplitPreview(); } };
    }
  }


  /* ── Init ── */
  window.onload = function () {
    cs = new CSInterface();
    startStartupLoadingOverlay();
    var verniProgressMinimize = byId('verniProgressMinimize');
    if (verniProgressMinimize) { verniProgressMinimize.onclick = togglePanelProgressMinimized; }
    initDebugMode();
    initBackgroundLogsToggle();
    installGlobalDropGuard();
    installGlobalSelectOverlay();
    setPanelProgress(18, 'Trwa ładowanie wtyczki');
    loadSettings();
    loadSyncFolders();
    updateSplitPreview();
    renderSyncFolders();
    bindSettingAutosave();
    bindFolderSyncUI();
    bindModuleToggles();
    initTransformTools();
    setPanelProgress(35, 'Trwa ładowanie wtyczki...');
    startProjectTimer(function () {
      setPanelProgress(92, 'Kończenie ładowania...');
      renderSyncFolders();
      startFolderLinkTimer();
      finishStartupLoadingOverlay('Wtyczka gotowa');
    });
    var confirmYes = byId('folderSyncConfirmYes');
    var confirmNo = byId('folderSyncConfirmNo');
    var confirmOverlay = byId('folderSyncConfirmOverlay');
    if (confirmYes) { confirmYes.onclick = confirmFolderRemove; }
    if (confirmNo) { confirmNo.onclick = closeFolderRemoveConfirm; }
    if (confirmOverlay) {
      confirmOverlay.onclick = function (e) {
        if (e && e.target === confirmOverlay) { closeFolderRemoveConfirm(); }
      };
    }
    var missingOk = byId('folderSyncMissingOk');
    var missingOverlay = byId('folderSyncMissingOverlay');
    if (missingOk) { missingOk.onclick = closeFolderMissingModal; }
    if (missingOverlay) {
      missingOverlay.onclick = function (e) {
        if (e && e.target === missingOverlay) { closeFolderMissingModal(); }
      };
    }
    var scanNow = byId('scanNow');
    if (scanNow) { scanNow.onclick = function () { runPanelAction('Skanowanie projektu...', function (done) { scan(false, done); }, 'Organizer / Skanuj teraz', 'manual'); }; }
    var startWatchBtn = byId('startWatch');
    if (startWatchBtn) { startWatchBtn.onclick = function () { setOrganizerAutoCheckEnabled(true, false); }; }
    var stopWatchBtn = byId('stopWatch');
    if (stopWatchBtn) { stopWatchBtn.onclick = function () { setOrganizerAutoCheckEnabled(false, false); }; }
    byId('syncTimecode').onclick = function () { runPanelAction('Synchronizacja po timecode...', function (done) { syncByTimecode(done); }, 'Timecode Sync', 'manual'); };
    byId('applySplitScreen').onclick = function () { runPanelAction('Dzielenie ekranu...', function (done) { applySplitScreen(done); }, 'Split Screen', 'manual'); };
    var unNestBtn = byId('unNestBtn');
    if (unNestBtn) { unNestBtn.onclick = function () { runPanelAction('UN NEST...', function (done) { unNestSelected(done); }, 'UN NEST', 'manual'); }; }
    var unNestUndoBtn = byId('unNestUndoBtn');
    if (unNestUndoBtn) { unNestUndoBtn.onclick = function () { runPanelAction('Cofanie ostatniej operacji...', function (done) { undoLastHistoryAction(done); }, 'Cofanie', 'manual'); }; }
    var mediaOfflineBtn = byId('mediaOfflineBtn');
    if (mediaOfflineBtn) { mediaOfflineBtn.onclick = function () { runPanelAction('Media Offline...', function (done) { relinkOfflineMedia(done); }, 'Media Offline', 'manual'); }; }
    var multiNestBtn = byId('multiNestBtn');
    if (multiNestBtn) { multiNestBtn.onclick = function () { runPanelAction('MULTI-NEST...', function (done) { multiNestSelected(done); }, 'MULTI-NEST', 'manual'); }; }

    if (organizerAutoCheckEnabled) {
      window.setTimeout(function () { startWatch(true); }, 800);
    } else {
      logInfo('Organizer', 'Segregowanie Auto-Check jest wylaczone przelacznikiem.');
    }
  };

}());
