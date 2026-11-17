(function () {
  'use strict';
  var billId = new URLSearchParams(location.search).get('billId') || '';
  try { if (!billId) billId = localStorage.getItem('lk_billing_active_bill_id') || ''; } catch (e) {}
  if (!billId) billId = 'latest';
  var LS_KEY = 'billing_mobile_state_' + billId;
  function apiUrl() { return '/api/billing?dataId=' + encodeURIComponent(billId); }
  function request(url, init) {
    return fetch(url, Object.assign({ credentials: 'same-origin', cache: 'no-store' }, typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? { signal: AbortSignal.timeout(20000) } : {}, init || {}));
  }
  var syncPromise = null, sessionLocked = false, sessionDeadline = 0, touchPending = false, lastTouch = 0;
  var API_LS = 'billing_api_key';
  var SAVE_KEYS = ['isFinalized', 'projectMeta', 'selectedCompanyId', 'contractorsList',
    'selectedContractorId', 'pctStage1', 'pctStage2', 'pctStage3',
    'locations', 'activityLocations', 'activities', 'masterAbstractList', 'activityQuantities',
    'invoiceData', 'mappingLocks', 'sapMaterialsMaster'];

  var S = null, actKey = '', searchQ = '', locFilter = 'ALL';
  var syncTimer = null, lastHash = '', dirty = false, pollTimer = null, updatedAt = '', retryTimer = null, syncRetryCount = 0;
  var cloudRev = 0, conflict = false;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmt(n) {
    if (n === undefined || n === null || isNaN(n)) return '0.00';
    return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.style.display = 'block';
    clearTimeout(t._h); t._h = setTimeout(function () { t.style.display = 'none'; }, 2600);
  }
  function setSync(st, txt) {
    if ($('conflictNotice')) $('conflictNotice').hidden = !conflict;
    var d = $('syncDot');
    if (d) d.className = 'dot' + (st ? ' ' + st : '');
    var stxt = $('syncTxt');
    var labels = { synced: 'Saved online', syncing: 'Saving…', error: 'Needs attention', local: 'On this phone' };
    if (stxt) stxt.textContent = labels[st] || txt || 'Connecting…';
    if ($('syncPill')) $('syncPill').title = txt || labels[st] || '';
    if ($('btnSave')) $('btnSave').textContent = st === 'syncing' ? 'Saving online…' : st === 'synced' ? 'Saved online ✓' : 'Save online';
  }
  function apiHeaders(json) {
    var h = {};
    if (json) h['Content-Type'] = 'application/json';
    try { var k = localStorage.getItem(API_LS); if (k) h['x-api-key'] = k; } catch (e) {}
    return h;
  }

  function num(v) { var n = parseFloat(v); return Number.isFinite(n) ? n : 0; }

  // Theme support: sync with billing_theme
  function applyTheme(theme) {
    var html = document.documentElement;
    var isDark = theme === 'dark';
    html.setAttribute('data-theme', theme);
    html.classList.toggle('dark', isDark);
    html.classList.toggle('dark-mode', isDark);
    var icon = $('themeIcon');
    if (icon) icon.textContent = isDark ? '☀️' : '🌙';
    var meta = $('metaThemeColor');
    if (meta) meta.setAttribute('content', isDark ? '#070a12' : '#f4f7fb');
  }

  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    var next = cur === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('billing_theme', next); } catch (e) {}
    applyTheme(next);
  }

  var initialTheme = 'dark';
  try { initialTheme = localStorage.getItem('billing_theme') || 'light'; } catch (e) {}
  applyTheme(initialTheme);
  var btnTheme = $('themeToggle');
  if (btnTheme) btnTheme.addEventListener('click', toggleTheme);

  function stage1Pct() {
    var p = S ? Number(S.pctStage1) : 85;
    return (isNaN(p) || p <= 0) ? 85 : p;
  }

  // Desktop jaisa location scope: loc.acts khali/gayab = sab activity me; warna sirf listed me
  function isLocVisible(aKey, locIdx) {
    var loc = S.locations[locIdx];
    if (!loc || !aKey) return true;
    if (!loc.acts || !loc.acts.length) return true;
    return loc.acts.indexOf(aKey) > -1;
  }
  function visibleLocIdx(aKey) {
    var out = [];
    for (var i = 0; i < S.locations.length; i++) {
      if (isLocVisible(aKey, i)) out.push(i);
    }
    if (locFilter !== 'ALL') {
      var lf = parseInt(locFilter, 10);
      out = out.filter(function (i) { return i === lf; });
    }
    return out;
  }

  // Desktop jaisa matrix ensure: [locIdx][matIdx], '' = khali
  function ensureMatrix(key) {
    var mats = (S.activities[key] && S.activities[key].materials) || [];
    var nLoc = S.locations.length, nMat = mats.length;
    if (!S.activityQuantities[key] || !Array.isArray(S.activityQuantities[key])) {
      S.activityQuantities[key] = [];
    }
    var m = S.activityQuantities[key];
    while (m.length < nLoc) m.push(new Array(nMat).fill(''));
    for (var i = 0; i < m.length; i++) {
      if (!Array.isArray(m[i])) m[i] = new Array(nMat).fill('');
      while (m[i].length < nMat) m[i].push('');
    }
  }

  function itemQty(key, matIdx) {
    var m = S.activityQuantities[key];
    if (!m) return 0;
    var t = 0;
    for (var l = 0; l < S.locations.length; l++) {
      if (m[l] && m[l][matIdx] !== undefined && m[l][matIdx] !== '') t += num(m[l][matIdx]);
    }
    return t;
  }

  function buildPayload() {
    var o = {};
    for (var i = 0; i < SAVE_KEYS.length; i++) {
      var k = SAVE_KEYS[i];
      if (S[k] !== undefined) o[k] = S[k];
    }
    o.savedAt = Date.now();
    o.dataId = billId;
    o.baseRev = cloudRev;
    return o;
  }

  function contentHash(data) {
    var content = {};
    SAVE_KEYS.forEach(function (key) { if (data[key] !== undefined) content[key] = data[key]; });
    function ordered(value) {
      if (Array.isArray(value)) return value.map(ordered);
      if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(function (k) { return [k, ordered(value[k])]; }));
      return value;
    }
    var json = JSON.stringify(ordered(content)), hash = 2166136261;
    for (var i = 0; i < json.length; i++) hash = Math.imul(hash ^ json.charCodeAt(i), 16777619);
    return json.length + ':' + (hash >>> 0).toString(36);
  }
  function saveLocal() {
    if (!S) return true;
    try { var payload = buildPayload(); payload.mobilePending = dirty; localStorage.setItem(LS_KEY, JSON.stringify(payload)); return true; }
    catch (e) { setSync('error', 'Phone storage full'); toast('Phone par save nahi hua. Page band na karein; online save retry karein.'); return false; }
  }
  function syncedKey() { return 'mobile_billing_synced_' + billId; }

  function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncRetryCount = 0;
    syncTimer = setTimeout(syncNow, 2000);
  }

  function scheduleSyncRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    syncRetryCount = syncRetryCount + 1;
    if (syncRetryCount > 6) { syncRetryCount = 0; return; }
    var d = Math.min(5000 * syncRetryCount, 60000);
    retryTimer = setTimeout(function () { retryTimer = null; syncNow(false); }, d);
  }

  function syncNow(manual) {
    if (syncPromise) return syncPromise.then(function () { return syncNow(manual); });
    if (!S || S.isFinalized || sessionLocked || billId === 'latest') return Promise.resolve(false);
    if (conflict) { setSync('error', 'Cloud and phone copies differ'); if (manual) toast('Phone entries safe hain. Cloud conflict desktop par resolve karein.'); return Promise.resolve(false); }
    syncTimer = null;
    var payload = buildPayload(), hash = contentHash(payload), json = JSON.stringify(payload);
    if (hash === lastHash) { dirty = false; saveLocal(); setSync('synced'); return Promise.resolve(true); }
    if (json.length > 4 * 1024 * 1024) { setSync('error', 'Bill too large'); return Promise.resolve(false); }
    setSync('syncing');
    syncPromise = (async function () {
      try {
        var res = await request('/api/billing', { method: 'POST', headers: apiHeaders(true), body: json });
        var result = await res.json();
        if (res.status === 401) { lockSession(); return false; }
        if (res.status === 423) { S.isFinalized = true; render(); setSync('error', 'Bill locked'); toast('Bill locked hai. Desktop par unlock karein.'); return false; }
        if (res.status === 409) {
          if (!(result.conflict && result.data && contentHash(result.data) === hash)) {
            conflict = true; setSync('error', 'Cloud conflict — phone entries retained');
            toast('Cloud copy badli hai. Phone entries retained hain; desktop par compare karein.'); return false;
          }
        } else if (!res.ok || !result.success) throw new Error(result.error || 'Cloud save failed');
        if (typeof result.rev !== 'number') throw new Error('Save confirmation missing');
        cloudRev = result.rev; lastHash = hash;
        try { localStorage.setItem(syncedKey(), hash); } catch (e) {}
        dirty = contentHash(buildPayload()) !== hash;
        saveLocal(); conflict = false; syncRetryCount = 0;
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        setSync(dirty ? 'local' : 'synced', dirty ? 'New entries pending' : 'Saved online');
        if (manual && dirty) toast('Saved. Latest changes pending hain.');
        return true;
      } catch (e) { setSync('error', 'Online save not confirmed — phone copy retained'); if (manual) toast('Online save confirm nahi hua. Phone copy retained hai.'); scheduleSyncRetry(); return false; }
    })();
    var pending = syncPromise;
    return pending.finally(function () { if (syncPromise === pending) syncPromise = null; });
  }
  async function loadState() {
    if (syncPromise) await syncPromise;
    if (dirty) {
      await syncNow(false);
      if (dirty) { toast('Pending phone entries retained hain. Refresh ne unhe replace nahi kiya.'); return; }
    }
    setSync('', 'Connecting…');
    try {
      var response = await request(apiUrl(), { headers: apiHeaders(false) });
      if (response.status === 401) { lockSession(); return; }
      if (!response.ok) throw new Error('Connection failed');
      var j = await response.json();
      if (!j.success || !j.data) { fromLocal(); return; }
      if (j.dataId) {
        billId = j.dataId; LS_KEY = 'billing_mobile_state_' + billId;
        try { localStorage.setItem('lk_billing_active_bill_id', billId); } catch (e) {}
      }
      var local = null;
      try { local = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) {}
      cloudRev = typeof j.rev === 'number' ? j.rev : 0;
      var serverHash = contentHash(j.data);
      if (local && local.mobilePending && contentHash(local) !== serverHash) {
        var baseline = ''; try { baseline = localStorage.getItem(syncedKey()) || ''; } catch (e) {}
        var sameBase = Number(local.baseRev) === cloudRev || baseline === serverHash;
        local.isFinalized = !!j.data.isFinalized;
        applyState(local, false); dirty = true; conflict = !sameBase;
        setSync(conflict ? 'error' : 'local', conflict ? 'Cloud conflict — phone copy retained' : 'Pending phone entries restored');
        if (!conflict) scheduleSync();
        return;
      }
      conflict = false; applyState(j.data, true); lastHash = serverHash;
      try { localStorage.setItem(syncedKey(), serverHash); } catch (e) {}
      saveLocal();
    } catch (e) { fromLocal(); }
  }
  function fromLocal() {
    var local = null;
    try { local = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) {}
    if (local) {
      applyState(local, false); dirty = !!local.mobilePending;
      if (typeof local.baseRev === 'number') cloudRev = local.baseRev;
      setSync('local', 'Offline phone copy');
      renderKeyStatus('Phone par saved copy dikh rahi hai. Internet milne par online sync retry hoga.');
      return;
    }
    $('contractorName').textContent = 'No saved bill available';
    $('projName').textContent = 'Full portal mein bill select aur save karein';
    $('statusBadge').textContent = 'NOT CONNECTED';
    $('cards').innerHTML = '<div class="empty">Saved bill load nahi hua.<br>Internet check karke neeche Refresh dabayein. Pehle full portal mein bill select aur save karna zaroori hai.</div>';
    setSync('error', 'Bill unavailable');
  }

  function applyState(data, fromMongo) {
    S = {
      isFinalized: !!data.isFinalized,
      projectMeta: data.projectMeta || {},
      selectedCompanyId: data.selectedCompanyId || '',
      contractorsList: Array.isArray(data.contractorsList) ? data.contractorsList : [],
      selectedContractorId: data.selectedContractorId || '',
      pctStage1: data.pctStage1, pctStage2: data.pctStage2, pctStage3: data.pctStage3,
      locations: Array.isArray(data.locations) ? data.locations : [],
      activities: (data.activities && typeof data.activities === 'object') ? data.activities : {},
      masterAbstractList: Array.isArray(data.masterAbstractList) ? data.masterAbstractList : [],
      activityQuantities: (data.activityQuantities && typeof data.activityQuantities === 'object') ? data.activityQuantities : {},
      invoiceData: data.invoiceData || { items: [] },
      mappingLocks: data.mappingLocks || {}
    };
    // In dono ko tabhi rakho jab aaya ho — mobile inhe khali karke cloud/desktop copy mita na de
    if (data.activityLocations && typeof data.activityLocations === 'object') S.activityLocations = data.activityLocations;
    if (Array.isArray(data.sapMaterialsMaster) && data.sapMaterialsMaster.length) S.sapMaterialsMaster = data.sapMaterialsMaster;
    var keys = Object.keys(S.activities).sort(function (a, b) { return parseInt(a) - parseInt(b); });
    actKey = keys.length ? keys[0] : '';
    if (fromMongo) lastHash = contentHash(data);
    setSync(fromMongo ? 'synced' : '', fromMongo ? 'synced' : 'local');
    if (fromMongo) {
      try {
        var t2 = new Date();
        updatedAt = ('0' + t2.getHours()).slice(-2) + ':' + ('0' + t2.getMinutes()).slice(-2);
      } catch (e2) { updatedAt = ''; }
    }
    dirty = false;
    render();
    renderKeyStatus('');
  }

  function renderLock(force) {
    var locked = sessionLocked || force || (S && S.isFinalized);
    $('lockBar').hidden = !locked;
    $('btnSave').disabled = !!locked;
    return locked;
  }

  function render() {
    if (!S) return;
    var locked = renderLock(false);
    var pName = (S.projectMeta && S.projectMeta.projectName) || 'RDSS T-10 GADCHIROLI';
    $('projName').textContent = pName;
    ['actSel', 'locSel', 'search'].forEach(function (id) { $(id).disabled = false; });
    var contractor = S.contractorsList.find(function (c) { return c.id === S.selectedContractorId; });
    var inv = S.invoiceData || {}, pm = S.projectMeta || {};
    $('contractorName').textContent = (contractor && contractor.name) || inv.contractorName || pm.contractorName || 'Contractor not selected';
    $('billNumber').textContent = [pm.raNo || inv.raNo, pm.billNo || inv.invoiceNo].filter(Boolean).join(' · ') || 'Not set';
    $('workOrder').textContent = inv.workOrderNo || pm.workOrderNo || (contractor && contractor.workOrderNo) || 'Not set';
    $('statusBadge').textContent = locked ? 'LOCKED' : 'ENTRY OPEN';

    var sel = $('actSel');
    var keys = Object.keys(S.activities).sort(function (a, b) { return parseInt(a) - parseInt(b); });
    sel.innerHTML = '';
    keys.forEach(function (k) {
      var o = document.createElement('option');
      o.value = k;
      var t = (S.activities[k] && S.activities[k].title) || k;
      var n = (S.activities[k] && S.activities[k].materials) ? S.activities[k].materials.length : 0;
      o.textContent = k + ' — ' + String(t) + ' (' + n + ')';
      sel.appendChild(o);
    });
    if (keys.indexOf(actKey) === -1) actKey = keys.length ? keys[0] : '';
    sel.value = actKey;

    var ls = $('locSel');
    if (ls) {
      ls.innerHTML = '';
      var all = document.createElement('option');
      all.value = 'ALL';
      all.textContent = 'All Locations (' + S.locations.length + ')';
      ls.appendChild(all);
      S.locations.forEach(function (loc, i) {
        var o = document.createElement('option');
        o.value = String(i);
        o.textContent = (loc && loc.name) || ('Loc ' + (i + 1));
        ls.appendChild(o);
      });
      if (locFilter !== 'ALL' && !S.locations[parseInt(locFilter, 10)]) locFilter = 'ALL';
      ls.value = locFilter;
    }

    var p1 = stage1Pct();
    $('invLbl').textContent = 'STAGE · ' + p1 + '%';
    var upd = updatedAt ? ' • ⏱ ' + updatedAt : '';
    $('metaLine').textContent = 'Location-wise quantity entry · Rates read-only' + upd;
    renderCards(locked);
  }

  function matchQ(m) {
    if (!searchQ) return true;
    var q = searchQ.toLowerCase();
    return (m.desc && String(m.desc).toLowerCase().indexOf(q) > -1) ||
      String(m.no).toLowerCase().indexOf(q) > -1 ||
      (m.itemCode && String(m.itemCode).toLowerCase().indexOf(q) > -1);
  }

  function renderCards(locked) {
    var box = $('cards');
    var act = S.activities[actKey];
    $('activityHeading').textContent = act ? ('Activity ' + actKey) : 'Material quantities';
    $('summaryActivity').textContent = act ? actKey + ' · ' + (act.title || '') : 'No activity selected';
    if (!act || !act.materials || !act.materials.length) {
      box.innerHTML = '<div class="empty">Is activity me koi item nahi hai.</div>';
      $('itemCount').textContent = '0 items'; showTotals(0, 0, 0, {});
      return;
    }
    ensureMatrix(actKey);
    var locs = visibleLocIdx(actKey);
    var mats = act.materials.map(function (m, idx) {
      var c = {}; for (var k in m) c[k] = m[k];
      c.origIndex = idx; return c;
    }).filter(function (m) { return !m.isSection && matchQ(m); });

    $('itemCount').textContent = mats.length + ' items shown';
    if (!locs.length) { box.innerHTML = '<div class="empty">Is activity ke liye selected location available nahi hai. Doosra location chunein.</div>'; refreshTotals(); return; }
    var html = '', extraOpen = false;
    mats.forEach(function (m) {
      var q = itemQty(actKey, m.origIndex);
      var amt = q * num(m.rate);
      if (m.isExtra && !extraOpen) { html += '<div class="sec-head">✏️ Extra Items</div>'; extraOpen = true; }
      
      var itemNoPill = '<span class="item-no-pill">Item ' + esc(m.no) + '</span>';
      var sapPill = m.itemCode ? '<span class="sap-pill">SAP: ' + esc(m.itemCode) + '</span>' : '';
      var extraBadge = m.isExtra ? '<span class="extra-badge">✏️ Extra</span>' : '';
      
      html += '<div class="card' + (m.isExtra ? ' extra' : '') + '">' +
        '<div class="card-top-pills">' + itemNoPill + sapPill + extraBadge + '</div>' +
        '<div class="item-desc">' + esc(m.desc) + '</div>' +
        '<div class="item-meta-bar">' +
          '<span class="meta-tag">Unit: <b>' + esc(m.unit || 'No') + '</b></span>' +
          '<span class="meta-tag">Rate: <b>₹' + fmt(m.rate) + '</b></span>' +
        '</div>';

      for (var li = 0; li < locs.length; li++) {
        var l = locs[li];
        var locName = (S.locations[l] && S.locations[l].name) || ('Loc ' + (l + 1));
        var v = (S.activityQuantities[actKey][l] && S.activityQuantities[actKey][l][m.origIndex] !== undefined)
          ? S.activityQuantities[actKey][l][m.origIndex] : '';
        html += '<div class="loc-row">' +
          '<div class="loc-info">' +
            '<span class="loc-pin">📍</span>' +
            '<span class="loc-name">' + esc(locName) + '</span>' +
          '</div>' +
          '<div class="stepper">' +
            '<button class="step-btn" data-a="dec" data-loc="' + l + '" data-mat="' + m.origIndex + '"' + (locked ? ' disabled' : '') + ' aria-label="Decrease">−</button>' +
            '<input class="qty-box" type="number" inputmode="decimal" step="any" min="0" value="' + esc(v) + '"' +
            ' aria-label="Quantity in ' + esc(m.unit || 'Nos') + ' at ' + esc(locName) + '" data-loc="' + l + '" data-mat="' + m.origIndex + '"' + (locked ? ' disabled' : '') + ' placeholder="0">' +
            '<button class="step-btn" data-a="inc" data-loc="' + l + '" data-mat="' + m.origIndex + '"' + (locked ? ' disabled' : '') + ' aria-label="Increase">+</button>' +
          '</div>' +
        '</div>';
      }
      var unitText = esc(m.unit || 'Nos');
      html += '<div class="card-footer">' +
        '<span>Total qty · all locations<br><b>' + (Math.round(q * 100) / 100) + ' ' + unitText + '</b></span>' +
        '<span class="card-amount"><small>Basic amount</small><b class="c-amt">₹' + fmt(amt) + '</b></span>' +
      '</div></div>';
    });
    if (!mats.length) html = '<div class="empty">🔍 Kuch nahi mila — kuch aur likh kar dekho.</div>';
    box.innerHTML = html;
    refreshTotals();
  }

  function showTotals(grand, entered, total, units) {
    $('totAmt').textContent = fmt(grand);
    $('totInv').textContent = fmt(grand * stage1Pct() / 100);
    $('totQty').textContent = entered + ' / ' + total + ' items entered · All activity locations';
    $('enteredCount').textContent = entered; $('allItemCount').textContent = total;
    $('summaryBasic').textContent = '₹' + fmt(grand);
    $('summaryStage').textContent = '₹' + fmt(grand * stage1Pct() / 100);
    $('summaryStageLabel').textContent = 'Stage amount (' + stage1Pct() + '%)';
    var rows = Object.keys(units).sort().map(function (unit) { return '<div class="unit-total"><span>' + esc(unit) + '</span><strong>' + esc(Math.round(units[unit] * 1000) / 1000) + '</strong></div>'; });
    $('unitTotals').innerHTML = rows.join('') || '<p class="help-copy">Abhi quantity enter nahi hui hai.</p>';
  }
  function refreshTotals() {
    var act = S.activities[actKey];
    if (!act || !act.materials) { showTotals(0, 0, 0, {}); return; }
    var grand = 0, entered = 0, total = 0, units = {};
    act.materials.forEach(function (m, i) {
      if (m.isSection) return;
      var q = itemQty(actKey, i); total++;
      if (q > 0) entered++;
      grand += q * num(m.rate);
      var unit = String(m.unit || 'Nos').trim();
      if (/^(no|nos|no\.|nos\.)$/i.test(unit)) unit = 'Nos';
      if (q) units[unit] = (units[unit] || 0) + q;
    });
    showTotals(grand, entered, total, units);
  }

  function refreshCardTotal(input) {
    var card = input.closest('.card');
    if (!card) return;
    var mat = parseInt(input.getAttribute('data-mat'), 10);
    var q = itemQty(actKey, mat);
    var act = S.activities[actKey];
    var m = act && act.materials[mat];
    var rate = m ? num(m.rate) : 0;
    var unit = (m && m.unit) || 'Nos';
    var lt = card.querySelector('.card-footer');
    if (lt) {
      lt.innerHTML = '<span>Total qty · all locations<br><b>' + (Math.round(q * 100) / 100) + ' ' + esc(unit) + '</b></span><span class="card-amount"><small>Basic amount</small><b class="c-amt">₹' + fmt(q * rate) + '</b></span>';
    }
  }

  function setQty(loc, mat, val, input) {
    if (sessionLocked || !S || S.isFinalized) return;
    ensureMatrix(actKey);
    if (val === '' || val === null || val === undefined) {
      S.activityQuantities[actKey][loc][mat] = '';
    } else {
      var n = parseFloat(val);
      if (!Number.isFinite(n) || n < 0) return;
      S.activityQuantities[actKey][loc][mat] = n;
    }
    dirty = true;
    var stored = saveLocal(); setSync(stored ? 'local' : 'error', stored ? 'Changes saved on phone, online pending' : 'Phone storage failed — online save pending'); scheduleSync();
    refreshTotals();
    if (input) refreshCardTotal(input);
  }

  // ---- Settings / key / polling ----
  function savedKey() {
    try { return localStorage.getItem(API_LS) || ''; } catch (e) { return ''; }
  }
  function renderKeyStatus(extra) {
    var el = $('keyStatus');
    if (!el) return;
    if (extra) { el.innerHTML = extra; return; }
    var k = savedKey();
    var masked = k ? 'Legacy API key saved. Login session bhi required hai.' : 'Secure login session connected. API key ki normally zaroorat nahi hai.';
    var upd = updatedAt ? ('<br><b>Last server data:</b> ' + esc(updatedAt)) : '';
    el.innerHTML = masked + upd;
    var ss = $('setSumState');
    if (ss) ss.textContent = k ? '• key saved' : '';
  }

  // Chup-chaap naya data lao — sirf tab jab user kuch likh nahi raha (dirty/pending sync nahi)
  function pullQuiet() {
    if (!S || dirty || syncTimer || syncPromise || sessionLocked) return;
    request(apiUrl(), { headers: apiHeaders(false) }).then(function (res) {
      if (res.status === 401) { lockSession(); return null; }
      return res.ok ? res.json() : null;
    }).then(function (j) {
      if (!j || !j.success || !j.data || dirty || syncTimer || syncPromise) return;
      if (typeof j.rev === 'number') cloudRev = j.rev;
      if (contentHash(j.data) === lastHash) return;
      var keepAct = actKey, keepQ = searchQ, keepLoc = locFilter;
      applyState(j.data, true);
      actKey = S.activities[keepAct] ? keepAct : actKey; searchQ = keepQ; locFilter = keepLoc; render(); saveLocal();
    }).catch(function () {});
  }
  function startPoll() {
    if (pollTimer) return;
    pollTimer = setInterval(pullQuiet, 20000);
  }

  // Events (delegation — fast + reliable)
  $('cards').addEventListener('click', function (e) {
    var b = e.target.closest('.step-btn');
    if (!b || b.disabled) return;
    var loc = parseInt(b.getAttribute('data-loc'), 10);
    var mat = parseInt(b.getAttribute('data-mat'), 10);
    var card = b.closest('.card');
    var input = card ? card.querySelector('input[data-loc="' + loc + '"][data-mat="' + mat + '"]') : null;
    var cur = num(input ? input.value : 0);
    var nv = b.getAttribute('data-a') === 'inc' ? cur + 1 : cur - 1;
    if (nv < 0) nv = 0;
    nv = Math.round(nv * 100) / 100;
    if (input) input.value = nv;
    setQty(loc, mat, nv, input);
  });

  $('cards').addEventListener('input', function (e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('qty-box') || t.disabled) return;
    var loc = parseInt(t.getAttribute('data-loc'), 10);
    var mat = parseInt(t.getAttribute('data-mat'), 10);
    setQty(loc, mat, t.value, t);
  });

  $('actSel').addEventListener('change', function (e) {
    actKey = e.target.value;
    render();
  });

  $('locSel').addEventListener('change', function (e) {
    locFilter = e.target.value;
    renderCards(renderLock(false));
  });

  var searchH = null;
  $('search').addEventListener('input', function (e) {
    clearTimeout(searchH);
    searchH = setTimeout(function () {
      searchQ = e.target.value.trim();
      renderCards(renderLock(false));
    }, 250);
  });

  $('btnSave').addEventListener('click', function () {
    saveLocal();
    syncNow(true);
  });
  $('btnRefresh').addEventListener('click', function () { loadState(); });
  $('btnKeySave').addEventListener('click', function () {
    var v = ($('apiKey').value || '').trim();
    try {
      if (v) localStorage.setItem(API_LS, v);
      else localStorage.removeItem(API_LS);
    } catch (e) {}
    renderKeyStatus('');
    loadState();
  });
  $('btnKeyTest').addEventListener('click', function () {
    var v = ($('apiKey').value || '').trim();
    if (v) { try { localStorage.setItem(API_LS, v); } catch (e) {} }
    renderKeyStatus('⏳ Test kar rahe hain...');
    request('/api/billing', { headers: apiHeaders(false) })
      .then(function (res) {
        if (res.status === 401) { lockSession(); return; }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (j) {
        if (!j) return;
        renderKeyStatus('✅ <b>Server mil gaya!</b> Data load ho raha hai...');
        loadState();
      })
      .catch(function () { renderKeyStatus('❌ Server nahi mila — net check karo ya desktop par server/Vercel dekho.'); });
  });
  window.addEventListener('online', function () { if (dirty) syncNow(); else loadState(); });
  $('deskLink').addEventListener('click', function (e) {
    e.preventDefault();
    try { localStorage.setItem('billing_pref_desktop', '1'); } catch (x) {}
    location.href = '/index.html?view=desktop';
  });


  try {
    var _k = savedKey();
    if (_k && $('apiKey')) $('apiKey').value = _k;
  } catch (e) {}
  function switchTab(name) {
    document.body.dataset.mobileTab = name;
    ['Entry', 'Summary', 'Settings'].forEach(function (key) { $('tab' + key).setAttribute('aria-selected', String(key.toLowerCase() === name)); });
  }
  $('tabEntry').addEventListener('click', function () { switchTab('entry'); });
  $('tabSummary').addEventListener('click', function () { switchTab('summary'); });
  $('tabSettings').addEventListener('click', function () { switchTab('settings'); });
  $('downloadCopy').addEventListener('click', function () {
    if (!S) return;
    var copy = buildPayload(); copy.mobilePending = dirty;
    var url = URL.createObjectURL(new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json' }));
    var link = document.createElement('a'); link.href = url; link.download = 'mobile-bill-copy-' + String(billId).replace(/[^a-z0-9_-]/gi, '_') + '.json'; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });
  $('dailyLink').addEventListener('click', function (event) {
    if (dirty && !saveLocal()) { event.preventDefault(); return; }
    $('dailyLink').href = '/index.html?tab=dailyProgress';
  });
  function lockSession() {
    if (dirty) saveLocal();
    sessionLocked = true; $('sessionNotice').hidden = false; $('btnSave').disabled = true;
    $('statusBadge').textContent = 'LOGIN REQUIRED';
    if (!S) $('contractorName').textContent = 'Login to open your saved bill';
    setSync('error', 'Login required'); if (S) renderLock(true);
    $('cards').querySelectorAll('input,button').forEach(function (el) { el.disabled = true; });
  }
  window.addEventListener('billing-session-expired', lockSession);
  async function activity() {
    if (sessionLocked || touchPending || Date.now() - lastTouch < 20000) return;
    touchPending = true; lastTouch = Date.now();
    try {
      var response = await request('/api/auth/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (response.status === 401) { lockSession(); return; }
      if (response.ok) { var result = await response.json(); sessionDeadline = result.expiresAt - (result.serverTime ? result.serverTime - Date.now() : 0); }
    } catch (e) {} finally { touchPending = false; }
  }
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (name) { window.addEventListener(name, activity, { passive: true }); });
  window.addEventListener('beforeunload', function (event) { if (dirty) { saveLocal(); event.preventDefault(); event.returnValue = ''; } });
  async function boot() {
    try {
      var response = await request('/api/auth/session', { cache: 'no-store' });
      if (response.status === 401) { lockSession(); return; }
      if (!response.ok) throw new Error('Connection failed');
      var session = await response.json(); sessionDeadline = session.expiresAt - (session.serverTime ? session.serverTime - Date.now() : 0);
      await loadState(); startPoll();
      setInterval(function () { if (sessionDeadline && Date.now() >= sessionDeadline) lockSession(); }, 1000);
    } catch (e) { fromLocal(); }
  }
  boot();
})();
