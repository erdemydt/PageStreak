/* global __dirname */ // Node script (run by run.sh), not app code
// Usage: node test.js <scenario> [backupA] [backupB]. Each scenario runs in a fresh
// process on a fresh database (the app's db handle is module-level).
const Module = require('module'); const path = require('path'); const fs = require('fs'); const assert = require('assert');
const STUBS = {
  'expo-sqlite': path.join(__dirname, 'expo-sqlite-shim.js'),
  'expo-file-system/legacy': path.join(__dirname, 'stubs/expo-file-system.js'),
  'expo-sharing': path.join(__dirname, 'stubs/expo-sharing.js'),
  'expo-document-picker': path.join(__dirname, 'stubs/expo-document-picker.js'),
  'expo-application': path.join(__dirname, 'stubs/expo-application.js'),
  'react-native': path.join(__dirname, 'stubs/react-native.js'),
};
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) { return STUBS[req] ?? origResolve.call(this, req, ...rest); };
global.__DEV__ = false; console.log = () => {}; console.warn = () => {}; console.error = () => {};
const { DatabaseSync } = require('node:sqlite');

const [, , scenario, fileA, fileB] = process.argv;
const dbFile = path.join(__dirname, `${scenario}.db`);
if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
process.env.TEST_DB = dbFile;
process.env.BACKUP_OUT_DIR = __dirname;
const raw = () => new DatabaseSync(dbFile);
const one = (sql) => { const d = raw(); const r = d.prepare(sql).get(); d.close(); return r; };
const count = (table) => one(`SELECT COUNT(*) AS c FROM ${table}`).c;
const out = (msg) => process.stdout.write(msg + '\n');
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const fixture = (name, data) => { const f = path.join(__dirname, name); fs.writeFileSync(f, typeof data === 'string' ? data : JSON.stringify(data)); return f; };

/** A device that has been used: profile, goal history, reminder settings, one book with sessions */
function seedLocalUser() {
  const d = raw();
  d.exec(`INSERT INTO user_preferences (id, username, yearly_book_goal, current_reading_rate_minutes_per_day, initial_reading_rate_minutes_per_day, weekly_reading_rate_increase_minutes, end_reading_rate_goal_minutes_per_day, current_reading_rate_last_updated)
            VALUES (1, 'Local', 12, 25, 25, 0, 25, '2026-10-01T10:00:00.000Z');
          INSERT INTO goal_history (effective_date, minutes) VALUES ('2026-10-01', 25);
          INSERT OR REPLACE INTO notification_preferences (id, notifications_enabled, daily_reminder_enabled, daily_reminder_hours_after_last_open, reminder_mode, reminder_time)
            VALUES (1, 1, 1, 3, 'daily_time', '07:30');
          INSERT INTO enhanced_books (name, author, page, reading_status, current_page) VALUES ('Local Book', 'Someone', 200, 'currently_reading', 0);
          INSERT INTO reading_sessions (book_id, minutes_read, pages_read, date, created_at) VALUES (1, 30, 10, '2026-10-20', '2026-10-20T10:00:00.000Z');`);
  d.close();
}
const localSettingsKept = () => {
  const p = one('SELECT * FROM user_preferences WHERE id = 1');
  assert.equal(p.username, 'Local', 'merge kept the local name');
  assert.equal(p.current_reading_rate_minutes_per_day, 25, 'merge kept the local goal');
  assert.deepEqual(one("SELECT GROUP_CONCAT(effective_date || ':' || minutes) AS g FROM goal_history").g, '2026-10-01:25', 'merge kept goal history');
  const n = one('SELECT * FROM notification_preferences WHERE id = 1');
  assert.equal(n.reminder_mode, 'daily_time', 'merge kept reminder settings'); assert.equal(n.reminder_time, '07:30');
};

(async () => {
  const db = require('./db/db.js');
  const backup = require('./services/dataBackupService.js');
  await db.initializeDatabase();
  const restore = async (file, mode) => {
    const r = await backup.importDataFromBackup(file, mode);
    assert(r.success, `import failed: ${r.error}`);
    return r.imported;
  };

  if (scenario === 'onboarding-old') {
    // An old, partial backup (no profile) onto a fresh install, as onboarding does
    assert.equal(await backup.hasLocalData(), false);
    const a = json(fileA);
    const got = await restore(fileA, 'replace');
    assert.deepEqual(got, { books: a.tables.enhanced_books.length, sessions: a.tables.reading_sessions.length });
    assert.equal(count('enhanced_books'), a.tables.enhanced_books.length);
    assert.equal(count('reading_sessions'), a.tables.reading_sessions.length);
    assert.equal(count('user_preferences'), 0, 'no profile in this backup');
  }

  if (scenario === 'onboarding-full') {
    const b = json(fileB);
    await restore(fileB, 'replace');
    assert.equal(count('enhanced_books'), b.tables.enhanced_books.length);
    assert.equal(count('reading_sessions'), b.tables.reading_sessions.length);
    assert.equal(one('SELECT username FROM user_preferences WHERE id = 1').username, b.tables.user_preferences[0].username);
    assert(count('goal_history') > 0, 'goal history rebuilt for a backup that predates it');
    assert.equal(count('weekly_progress'), b.tables.weekly_progress.length);
    assert.equal(count('app_usage_tracking'), b.tables.app_usage_tracking.length);
    const n = one('SELECT * FROM notification_preferences WHERE id = 1');
    assert.equal(n.reminder_mode, 'after_close', 'old backups default the reminder mode');
    // Book ids and session links survive a replace
    const orphans = one('SELECT COUNT(*) AS c FROM reading_sessions WHERE book_id NOT IN (SELECT id FROM enhanced_books)').c;
    assert.equal(orphans, 0);
  }

  if (scenario === 'merge') {
    // Both backups merged onto a used device: books and sessions added, settings untouched, idempotent
    seedLocalUser();
    assert.equal(await backup.hasLocalData(), true);
    const b = json(fileB);
    const first = await restore(fileB, 'merge');
    assert.equal(first.books, b.tables.enhanced_books.length);
    assert.equal(first.sessions, b.tables.reading_sessions.length);
    localSettingsKept();
    const again = await restore(fileB, 'merge');
    assert.deepEqual(again, { books: 0, sessions: 0 }, 'merging the same backup twice adds nothing');
    const a = json(fileA);
    const fromA = await restore(fileA, 'merge');
    // A's books are matched by Open Library key or title+author, so overlap isn't re-added
    assert(fromA.books <= a.tables.enhanced_books.length);
    assert.equal(count('enhanced_books'), 1 + b.tables.enhanced_books.length + fromA.books);
    localSettingsKept();
    assert.equal(one("SELECT COUNT(*) AS c FROM reading_sessions WHERE book_id = 1").c, 1, 'local sessions kept');
    const orphans = one('SELECT COUNT(*) AS c FROM reading_sessions WHERE book_id NOT IN (SELECT id FROM enhanced_books)').c;
    assert.equal(orphans, 0, 'every merged session points at a book');
    // current_page re-derived from merged sessions, capped at the page count
    const over = one('SELECT COUNT(*) AS c FROM enhanced_books WHERE current_page > page AND page > 0').c;
    assert.equal(over, 0);
  }

  if (scenario === 'merge-no-profile') {
    // A device with books but no profile (e.g. an earlier partial restore in onboarding) takes the backup's settings
    const d = raw(); d.exec("INSERT INTO enhanced_books (name, author, page, reading_status) VALUES ('Local Book','Someone',200,'want_to_read')"); d.close();
    const b = json(fileB);
    await restore(fileB, 'merge');
    assert.equal(one('SELECT username FROM user_preferences WHERE id = 1').username, b.tables.user_preferences[0].username);
    assert(count('goal_history') > 0);
  }

  if (scenario === 'replace') {
    seedLocalUser();
    const b = json(fileB);
    await restore(fileB, 'replace');
    assert.equal(count('enhanced_books'), b.tables.enhanced_books.length, 'local book replaced');
    assert.equal(one("SELECT COUNT(*) AS c FROM enhanced_books WHERE name = 'Local Book'").c, 0);
    assert.equal(one('SELECT username FROM user_preferences WHERE id = 1').username, b.tables.user_preferences[0].username);
    assert.notEqual(one("SELECT GROUP_CONCAT(effective_date) AS g FROM goal_history").g, '2026-10-01', 'goal history replaced');
  }

  if (scenario === 'roundtrip') {
    // Export everything from a restored device, restore that file elsewhere: identical rows
    await restore(fileB, 'replace');
    const before = {};
    for (const t of ['enhanced_books', 'reading_sessions', 'user_preferences', 'goal_history', 'notification_preferences']) {
      const d = raw(); before[t] = d.prepare(`SELECT * FROM ${t} ORDER BY 1`).all(); d.close();
    }
    const result = await backup.exportAndSaveBackup();
    assert(result.success, result.error);
    const exported = require('./stubs/expo-file-system.js').lastWritten;
    const data = json(exported);
    for (const t of ['enhanced_books', 'reading_sessions', 'user_preferences', 'goal_history', 'weekly_progress', 'notification_preferences', 'app_usage_tracking']) {
      assert(Array.isArray(data.tables[t]), `export always includes ${t}`);
    }
    const d = raw();
    for (const t of Object.keys(before)) d.exec(`DELETE FROM ${t}`);
    d.close();
    await restore(exported, 'replace');
    for (const t of Object.keys(before)) {
      const d2 = raw(); assert.deepEqual(d2.prepare(`SELECT * FROM ${t} ORDER BY 1`).all(), before[t], `${t} round-trips`); d2.close();
    }
  }

  if (scenario === 'invalid') {
    const problem = async (file) => (await backup.previewBackup(file)).problem;
    assert.equal(await problem(fixture('not-json.json', 'hello')), 'notBackup');
    assert.equal(await problem(fixture('other-app.json', { app: 'other', schemaVersion: 1, createdAt: 'x', tables: {} })), 'notBackup');
    assert.equal(await problem(fixture('newer.json', { app: 'pagestreak', schemaVersion: 99, createdAt: 'x', tables: {} })), 'newerVersion');
    assert.equal(await problem(fixture('damaged.json', { app: 'pagestreak', schemaVersion: 1, createdAt: 'x', tables: { enhanced_books: [{ id: 1, page: 10 }] } })), 'damaged');
    const ok = await backup.previewBackup(fileB);
    assert.equal(ok.preview.books, json(fileB).tables.enhanced_books.length);
    assert.equal(ok.preview.hasProfile, true);
    assert.equal((await backup.previewBackup(fileA)).preview.hasProfile, false);
  }

  if (scenario === 'atomic') {
    // A failure halfway through a replace leaves the device exactly as it was
    seedLocalUser();
    const b = json(fileB);
    b.tables.enhanced_books.push({ ...b.tables.enhanced_books[0] }); // duplicate primary key
    const r = await backup.importDataFromBackup(fixture('dup.json', b), 'replace');
    assert.equal(r.success, false, 'import must fail');
    assert.equal(count('enhanced_books'), 1); assert.equal(count('reading_sessions'), 1);
    localSettingsKept();
  }

  out(`  ${scenario}: OK`);
})().catch(e => { process.stdout.write(`  ${scenario}: FAIL ${e.stack}\n`); process.exit(1); });
