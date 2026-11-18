/**
 * Cozy Shelf <-> Google Sheet sync (version 2: master workbook).
 *
 * PERSONAL data (two-way, as before): tabs "Journal", "Own books", "Settings".
 * MASTER catalogue (the Sheet is the source of truth; the app only reads it): tabs "Books", "Trigger Warnings",
 *   "Sources", "Research Status". The app never writes to these four tabs.
 *
 * Paste this whole file into Extensions > Apps Script, KEEP YOUR OWN TOKEN LINE (see below), save,
 * then Deploy > Manage deployments > pencil > New version > Deploy (the web address stays the same).
 */
const TOKEN = 'CHANGE-THIS-TO-A-LONG-RANDOM-PHRASE';

const SHEETS = {
  'Journal': ['id', 'book_id', 'title', 'authors', 'status', 'started', 'finished', 'rating', 'favorite', 'tags', 'review', 'notes', 'updated_at', 'deleted'],
  'Own books': ['id', 'title', 'authors', 'pages', 'genres', 'moods', 'created_at', 'deleted'],
  'Settings': ['key', 'value', 'updated_at']
};
const TO_CAMEL = { book_id: 'bookId', updated_at: 'updatedAt', created_at: 'createdAt' };
const camel_ = h => TO_CAMEL[h] || h;

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    const cols = SHEETS[name];
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@'); // plain text, so dates stay exactly as typed
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function readAll_(name) {
  const sh = getSheet_(name), cols = SHEETS[name], tz = Session.getScriptTimeZone();
  const values = sh.getDataRange().getValues(), out = [];
  for (let r = 1; r < values.length; r++) {
    const o = { row: r + 1 };
    cols.forEach((c, i) => {
      let v = values[r][i];
      if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      o[camel_(c)] = v;
    });
    out.push(o);
  }
  return out;
}

// Rows typed by hand have no id yet: give them one (the app then matches the title/author to a book).
function assignIds_() {
  const sh = getSheet_('Journal'), values = sh.getDataRange().getValues(), now = new Date().toISOString();
  for (let r = 1; r < values.length; r++) {
    if (!values[r][0] && String(values[r][2]).trim()) {
      sh.getRange(r + 1, 1).setValue('ses_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12));
      if (!values[r][12]) sh.getRange(r + 1, 13).setValue(now);
    }
  }
}

function pull_() {
  assignIds_();
  const settingsRow = readAll_('Settings').filter(r => r.key === 'settings')[0];
  return {
    ok: true,
    sessions: readAll_('Journal').filter(r => r.id),
    books: readAll_('Own books').filter(r => r.id),
    settings: settingsRow ? { value: String(settingsRow.value), updatedAt: String(settingsRow.updatedAt) } : null
  };
}

function upsert_(name, items) {
  if (!items || !items.length) return 0;
  const sh = getSheet_(name), cols = SHEETS[name], data = sh.getDataRange().getValues();
  const idx = {};
  for (let r = 1; r < data.length; r++) if (data[r][0] !== '') idx[String(data[r][0])] = r + 1;
  const append = []; let n = 0;
  items.forEach(it => {
    const row = idx[it.id];
    if (it.deleteOnly) { // mark as deleted instead of removing the row
      if (row) {
        sh.getRange(row, cols.indexOf('deleted') + 1).setValue('yes');
        if (cols.indexOf('updated_at') >= 0) sh.getRange(row, cols.indexOf('updated_at') + 1).setValue(it.updatedAt || new Date().toISOString());
        n++;
      }
      return;
    }
    const vals = cols.map(c => { const v = it[camel_(c)]; return v === undefined || v === null ? '' : v; });
    if (row) { sh.getRange(row, 1, 1, cols.length).setValues([vals]); n++; } else { append.push(vals); n++; }
  });
  if (append.length) sh.getRange(sh.getLastRow() + 1, 1, append.length, cols.length).setValues(append);
  return n;
}

function writeSetting_(s) {
  const sh = getSheet_('Settings'), data = sh.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (data[r][0] === 'settings') { sh.getRange(r + 1, 1, 1, 3).setValues([['settings', s.value, s.updatedAt]]); return; }
  }
  sh.getRange(sh.getLastRow() + 1, 1, 1, 3).setValues([['settings', s.value, s.updatedAt]]);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const req = JSON.parse(e.postData.contents);
    if (req.token !== TOKEN) return json_({ ok: false, error: 'Wrong token' });
    if (req.action === 'pull') return json_(pull_());
    if (req.action === 'catalog') return json_(catalog_(req));
    if (req.action === 'push') {
      const s = upsert_('Journal', req.sessions), b = upsert_('Own books', req.books);
      if (req.settings) writeSetting_(req.settings);
      return json_({ ok: true, sessions: s, books: b });
    }
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

// ---------- master catalogue (read-only) ----------
const CATALOG_TABS = ['Books', 'Trigger Warnings', 'Sources', 'Research Status'];

function readTable_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) return null;
  const values = sh.getDataRange().getValues();
  if (!values.length) return { headers: [], rows: [] };
  const tz = Session.getScriptTimeZone();
  const headers = values[0].map(h => String(h).trim());
  const keep = []; headers.forEach((h, i) => { if (h) keep.push(i); });
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const row = keep.map(i => { let v = values[r][i]; if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd'); return v; });
    if (row.some(v => v !== '' && v !== null)) rows.push(row);
  }
  return { headers: keep.map(i => headers[i]), rows: rows };
}

// Sends the four master tabs. If the app already has this exact version (same hash), it only gets "unchanged".
function catalog_(req) {
  const tables = {};
  CATALOG_TABS.forEach(n => { const t = readTable_(n); if (t) tables[n] = t; });
  const json = JSON.stringify(tables);
  const hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, json));
  if (req.hash && req.hash === hash) return { ok: true, unchanged: true, hash: hash };
  return { ok: true, hash: hash, tables: tables };
}

function doGet() { return json_({ ok: true, hint: 'Cozy Shelf sync is running. Use the app to sync.' }); }

// When you edit a Journal row by hand, stamp it so the app knows it changed.
function onEdit(e) {
  try {
    const sh = e.range.getSheet();
    if (sh.getName() !== 'Journal') return;
    const c1 = e.range.getColumn(), c2 = e.range.getLastColumn();
    if (c1 >= 13 && c2 <= 13) return; // you edited updated_at itself
    const r1 = Math.max(2, e.range.getRow()), r2 = e.range.getLastRow();
    if (r2 < r1) return;
    const now = new Date().toISOString(), vals = [];
    for (let r = r1; r <= r2; r++) vals.push([now]);
    sh.getRange(r1, 13, r2 - r1 + 1, 1).setValues(vals);
  } catch (_) {}
}

// ---------- helpers for editing the master tabs by hand ----------
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('Cozy Shelf')
      .addItem('Check master data', 'checkMaster')
      .addItem('Add dropdown lists', 'addDropdowns')
      .addToUi();
  } catch (_) {}
}

function listValues_(field) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Lists');
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1).filter(r => String(r[0]).trim() === field).map(r => String(r[1]).trim()).filter(String);
}

// Writes a "Checks" tab listing anything in the master tabs the app would skip or find odd.
function checkMaster() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), out = [['Tab', 'Row', 'Problem']];
  const T = {}; CATALOG_TABS.forEach(n => { T[n] = readTable_(n); });
  const idx = (t, name) => t ? t.headers.indexOf(name) : -1;
  const add = (tab, row, msg) => out.push([tab, row, msg]);
  if (!T['Books']) add('Books', '', 'The Books tab is missing');
  const ids = {}, books = T['Books'];
  if (books) {
    const ci = idx(books, 'Book ID'), svi = idx(books, 'Sexual violence status');
    books.rows.forEach((r, i) => { const id = String(r[ci]).trim(); if (!id) add('Books', i + 2, 'No Book ID'); else if (ids[id]) add('Books', i + 2, 'Duplicate Book ID ' + id); else ids[id] = String(r[svi] || ''); });
  }
  const cats = ['Sexual violence', 'Abuse', 'Violence or gore', 'Kidnapping', 'Stalking', 'Suicide or self-harm', 'Mental health', 'Eating disorders', 'Addiction', 'Death or grief', 'Illness', 'Pregnancy loss', 'Animal cruelty or death', 'Discrimination', 'War', 'Infidelity', 'Other'];
  const okInt = listValues_('Intensity').map(x => x.toLowerCase()), okDep = listValues_('Depiction').map(x => x.toLowerCase()), okSub = listValues_('Abuse subtype').map(x => x.toLowerCase());
  const tw = T['Trigger Warnings'], seen = {}, svRows = {}, trig = {};
  if (tw) {
    const b = idx(tw, 'Book ID'), c = idx(tw, 'Category'), t = idx(tw, 'Trigger / warning'), it = idx(tw, 'Intensity'), d = idx(tw, 'Depiction (on-page / off-page)'), sb = idx(tw, 'Abuse subtype');
    tw.rows.forEach((r, i) => {
      const row = i + 2, bid = String(r[b]).trim(), cat = String(r[c]).trim(), name = String(r[t]).trim();
      if (!bid || !name) { add('Trigger Warnings', row, 'Missing Book ID or trigger'); return; }
      if (books && !(bid in ids)) add('Trigger Warnings', row, 'Book ID ' + bid + ' is not in Books (this trigger is skipped)');
      if (cats.indexOf(cat) < 0) add('Trigger Warnings', row, 'Unknown category "' + cat + '" (shown under Other)');
      const key = bid + '|' + cat + '|' + name.toLowerCase();
      if (seen[key]) add('Trigger Warnings', row, 'Duplicate of row ' + seen[key] + ' (merged into one pill)'); else seen[key] = row;
      trig[key] = true;
      const iv = String(r[it] || '').trim().toLowerCase(); if (iv && okInt.length && okInt.indexOf(iv) < 0) add('Trigger Warnings', row, 'Intensity "' + r[it] + '" is not in the Lists tab');
      const dv = String(r[d] || '').trim().toLowerCase(); if (dv && okDep.length && okDep.indexOf(dv) < 0) add('Trigger Warnings', row, 'Depiction "' + r[d] + '" is not in the Lists tab');
      const sv = String(r[sb] || '').trim().toLowerCase(); if (sv && okSub.length && okSub.indexOf(sv) < 0) add('Trigger Warnings', row, 'Abuse subtype "' + r[sb] + '" is not in the Lists tab');
      if (sv && cat !== 'Abuse') add('Trigger Warnings', row, 'Abuse subtype is set on a non-Abuse row');
      if (cat === 'Sexual violence') svRows[bid] = true;
    });
  }
  Object.keys(ids).forEach(id => {
    const yes = ids[id].toLowerCase().indexOf('yes') === 0;
    if (yes && !svRows[id]) add('Books', '', id + ': status says Yes but there is no Sexual violence trigger row (the app adds one)');
    if (!yes && svRows[id]) add('Books', '', id + ': has a Sexual violence trigger row but the status is not Yes (the trigger is still shown)');
  });
  const so = T['Sources'];
  if (so) {
    const b = idx(so, 'Book ID'), c = idx(so, 'Category'), t = idx(so, 'Trigger / warning');
    so.rows.forEach((r, i) => { const key = String(r[b]).trim() + '|' + String(r[c]).trim() + '|' + String(r[t]).trim().toLowerCase(); if (!trig[key]) add('Sources', i + 2, 'No matching Trigger Warnings row (ignored)'); });
  }
  if (out.length === 1) out.push(['', '', 'No problems found']);
  let sh = ss.getSheetByName('Checks'); if (sh) sh.clear(); else sh = ss.insertSheet('Checks');
  sh.getRange(1, 1, out.length, 3).setValues(out); sh.getRange(1, 1, 1, 3).setFontWeight('bold'); sh.setColumnWidth(3, 600);
  try { SpreadsheetApp.getUi().alert('Checked. ' + (out.length - 1) + ' note(s) are listed on the Checks tab.'); } catch (_) {}
}

// Adds dropdowns (from the Lists tab) to the master tabs. Existing values that are not in the list are kept, with a warning.
function addDropdowns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const plan = [
    ['Trigger Warnings', 'Intensity', 'Intensity'], ['Trigger Warnings', 'Depiction (on-page / off-page)', 'Depiction'], ['Trigger Warnings', 'Abuse subtype', 'Abuse subtype'],
    ['Trigger Warnings', 'Sexual violence status', 'Sexual violence status'], ['Books', 'Sexual violence status', 'Sexual violence status'], ['Books', 'Sexual violence intensity', 'Intensity'],
    ['Research Status', 'Sexual violence status', 'Sexual violence status']
  ];
  plan.forEach(p => {
    const sh = ss.getSheetByName(p[0]); if (!sh) return;
    const vals = listValues_(p[2]); if (!vals.length) return;
    const col = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim()).indexOf(p[1]) + 1; if (!col) return;
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(vals, true).setAllowInvalid(true).build();
    sh.getRange(2, col, Math.max(1, sh.getMaxRows() - 1), 1).setDataValidation(rule);
  });
  try { SpreadsheetApp.getUi().alert('Dropdown lists added.'); } catch (_) {}
}
