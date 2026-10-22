// Transpiles the backup service and what it imports into <outdir>, with stubs for
// the native modules, so test.js can run real imports/exports on SQLite files.
// Usage: node build.js <repoRoot> <outdir>
const fs = require('fs');
const path = require('path');
const [, , root, out] = process.argv;
const ts = require(root + '/node_modules/typescript');
const tx = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText;
const write = (rel, text) => { fs.mkdirSync(path.dirname(`${out}/${rel}`), { recursive: true }); fs.writeFileSync(`${out}/${rel}`, text); };

for (const file of ['db/db.tsx', 'services/dataBackupService.ts', 'utils/goalHistory.ts', 'utils/readingProgress.ts', 'utils/dataEvents.ts', 'utils/dateUtils.ts']) {
  write(file.replace(/\.tsx?$/, '.js'), tx(fs.readFileSync(`${root}/${file}`, 'utf8')));
}
write('utils/logger.js', 'exports.log=()=>{};exports.warn=()=>{};');
write('utils/readingTimer.js', 'exports.clearReadingTimer=async()=>{};');
write('i18n/index.js', 'exports.default={t:(k)=>k};');

// Native modules, resolved by test.js
write('stubs/expo-file-system.js', `
const fs = require('fs');
exports.documentDirectory = process.env.BACKUP_OUT_DIR + '/';
exports.cacheDirectory = process.env.BACKUP_OUT_DIR + '/';
exports.readAsStringAsync = async (uri) => fs.readFileSync(uri.replace(/^file:\\/\\//, ''), 'utf8');
exports.writeAsStringAsync = async (uri, text) => { fs.writeFileSync(uri, text); exports.lastWritten = uri; };`);
write('stubs/expo-sharing.js', 'exports.isAvailableAsync=async()=>true;exports.shareAsync=async()=>{};');
write('stubs/expo-document-picker.js', 'exports.getDocumentAsync=async()=>({canceled:true});');
write('stubs/expo-application.js', 'exports.nativeApplicationVersion="test";');
write('stubs/react-native.js', 'exports.Platform={OS:"ios"};');
