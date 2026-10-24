/**
 * Cozy Shelf <-> Google Sheet sync.
 * Paste this whole file into Extensions > Apps Script, change TOKEN below, then deploy as a Web app.
 * The Sheet tabs "Journal", "Own books" and "Settings" are created automatically on first sync.
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
