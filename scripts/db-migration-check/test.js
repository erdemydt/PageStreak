/* global __dirname */ // Node script (run by run.sh), not app code
// Usage: node test.js <scenario>; each scenario runs in a fresh process (module-level db handle)
const Module = require('module'); const path = require('path'); const fs = require('fs'); const assert = require('assert');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) { if (req === 'expo-sqlite') return path.join(__dirname, 'expo-sqlite-shim.js'); return origResolve.call(this, req, ...rest); };
global.__DEV__ = false; console.log = () => {};
const { DatabaseSync } = require('node:sqlite');
const [, , scenario, phase] = process.argv;
const dbFile = path.join(__dirname, `${scenario}.db`);
process.env.TEST_DB = dbFile;
const raw = () => new DatabaseSync(dbFile);
const cols = (d, t) => d.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
const tables = (d) => d.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
const out = (msg) => process.stdout.write(msg + '\n');

(async () => {
  if (phase === 'setup') {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    if (scenario === 'legacy') {
      const d = raw(); d.exec("CREATE TABLE books (id INTEGER PRIMARY KEY, name TEXT, author TEXT, page INTEGER); INSERT INTO books (name, author, page) VALUES ('Dune','Herbert',412),('Emma','Austen',300);"); d.close();
    }
    if (scenario === 'v3') {
      // Database exactly as the ORIGINAL app (commit 2162355) created it, plus user data
      const orig = require('./orig/db/db.js');
      await orig.initializeDatabase();
      const d = raw();
      d.exec(`INSERT INTO user_preferences (id, username, yearly_book_goal, current_reading_rate_minutes_per_day, initial_reading_rate_minutes_per_day, weekly_reading_rate_increase_minutes, end_reading_rate_goal_minutes_per_day, current_reading_rate_last_updated, created_at)
              VALUES (1, 'Erdem', 24, 26, 20, 2, 40, '2026-10-14T10:00:00.000Z', '2026-09-01 08:00:00');
              INSERT INTO enhanced_books (name, author, page, reading_status, current_page) VALUES ('Dune','Herbert',412,'currently_reading',120);
              INSERT INTO reading_sessions (book_id, minutes_read, pages_read, date) VALUES (1, 30, 20, '2026-10-20'), (1, 25, NULL, '2026-10-21');
              INSERT INTO notification_preferences (id, notifications_enabled, daily_reminder_enabled, daily_reminder_hours_after_last_open) VALUES (1, 1, 1, 8);`);
      const v = d.prepare('SELECT version FROM database_version WHERE id = 1').get();
      out(`  original app created schema, database_version=${v.version}, user_version=${d.prepare('PRAGMA user_version').get().user_version}`);
      d.close();
    }
    return;
  }

  // phase "migrate": run the NEW init (twice, simulating two launches in one process is not
  // possible due to the isInitialized flag, so the second launch is a separate invocation)
  const db = require('./new/db/db.js');
  if (process.argv[4] === 'concurrent') {
    // Boot race: a second init (remount/import) and an app-state transaction
    // (weekly goal growth) start while the migration is running
    const results = await Promise.allSettled([
      db.initializeDatabase(),
      db.initializeDatabase(),
      (async () => { await new Promise(r => setImmediate(r)); return db.runInTransaction(async () => {
        await db.execute("UPDATE user_preferences SET current_reading_rate_minutes_per_day = current_reading_rate_minutes_per_day WHERE id = 1"); }); })(),
    ]);
    for (const r of results) if (r.status === 'rejected') throw r.reason;
  } else {
    await db.initializeDatabase();
  }
  const d = raw();
  const uv = d.prepare('PRAGMA user_version').get().user_version;
  assert.equal(uv, db.LATEST_DB_VERSION, 'user_version');
  for (const t of ['enhanced_books','user_preferences','reading_sessions','weekly_progress','notification_preferences','app_usage_tracking','goal_history'])
    assert(tables(d).includes(t), 'missing table ' + t);
  assert(cols(d, 'notification_preferences').includes('reminder_mode'));
  assert(cols(d, 'reading_sessions').includes('pages_read'));
  const idx = d.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(r => r.name);
  assert(idx.includes('idx_reading_sessions_book_id') && idx.includes('idx_reading_sessions_date'));
  if (scenario === 'legacy') {
    const books = d.prepare('SELECT name, reading_status FROM enhanced_books ORDER BY name').all();
    assert.deepEqual(books.map(b => [b.name, b.reading_status]), [['Dune','read'],['Emma','read']]);
  }
  if (scenario === 'v3') {
    const prefs = d.prepare('SELECT * FROM user_preferences WHERE id = 1').get();
    assert.equal(prefs.username, 'Erdem'); assert.equal(prefs.current_reading_rate_minutes_per_day, 26);
    assert.equal(d.prepare('SELECT COUNT(*) c FROM reading_sessions').get().c, 2);
    assert.equal(d.prepare('SELECT current_page FROM enhanced_books WHERE id=1').get().current_page, 120);
    const np = d.prepare('SELECT * FROM notification_preferences WHERE id = 1').get();
    assert.equal(np.daily_reminder_hours_after_last_open, 8); assert.equal(np.reminder_mode, 'after_close'); assert.equal(np.reminder_time, '20:00');
  }
  out(`  ${scenario}/${phase}: OK (user_version=${uv}, tables=${tables(d).length})`);
  d.close();
})().catch(e => { process.stdout.write(`  ${scenario}/${phase}: FAIL ${e.stack}\n`); process.exit(1); });
