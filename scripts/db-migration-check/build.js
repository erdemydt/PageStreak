// Transpiles the current db/db.tsx and the ORIGINAL app's db/db.tsx (commit
// 2162355) into <outdir> so test.js can run both against real SQLite files.
// Usage: node build.js <repoRoot> <outdir>
const fs = require('fs');
const { execSync } = require('child_process');
const [, , root, out] = process.argv;
const ts = require(root + '/node_modules/typescript');
const tx = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
for (const dir of ['new/db', 'new/utils', 'orig/db']) fs.mkdirSync(`${out}/${dir}`, { recursive: true });
fs.writeFileSync(`${out}/new/db/db.js`, tx(fs.readFileSync(`${root}/db/db.tsx`, 'utf8')));
fs.writeFileSync(`${out}/new/utils/logger.js`, 'exports.log=()=>{};exports.warn=()=>{};');
const original = execSync('git show 2162355:db/db.tsx', { cwd: root, encoding: 'utf8' });
fs.writeFileSync(`${out}/orig/db/db.js`, tx(original));
