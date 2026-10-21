// Minimal expo-sqlite (async API) on top of node:sqlite, for migration tests
const { DatabaseSync } = require('node:sqlite');
const norm = (p) => (p === undefined ? [] : Array.isArray(p) ? p.map(v => v === undefined ? null : v) : p);
const tick = () => new Promise(r => setImmediate(r));
function wrap(raw) {
  const api = {
    async getAllAsync(sql, params) { await tick(); return raw.prepare(sql).all(...[].concat(norm(params))); },
    async getFirstAsync(sql, params) { await tick(); return raw.prepare(sql).get(...[].concat(norm(params))) ?? null; },
    async runAsync(sql, params) { await tick(); const r = raw.prepare(sql).run(...[].concat(norm(params))); return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes }; },
    async execAsync(sql) { await tick(); raw.exec(sql); },
    execSync(sql) { raw.exec(sql); },
    async withTransactionAsync(task) { try { await api.execAsync('BEGIN'); await task(); await api.execAsync('COMMIT'); } catch (e) { await api.execAsync('ROLLBACK'); throw e; } },
    async withExclusiveTransactionAsync(task) { raw.exec('BEGIN EXCLUSIVE'); try { await task(api); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; } },
  };
  return api;
}
exports.openDatabaseSync = () => wrap(new DatabaseSync(process.env.TEST_DB));
