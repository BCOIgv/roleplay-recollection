import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {HOST_VERSION, runScriptedCase} from './condition-host.mjs';

const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== '--cases' || args[2] !== '--output') {
  throw new Error('Usage: node evaluation/offline-conditions.mjs --cases <case-directory> --output <new-private-directory-outside-repository>');
}
const cases = fs.realpathSync(args[1]);
const output = path.resolve(args[3]);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const within = (parent, child) => {const rel = path.relative(parent, child); return rel === '' || !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);};
if (within(root, output) || within(cases, output) || fs.existsSync(output)) throw new Error('Output must be a new private directory outside repository and case inputs');
globalThis.fetch = () => {throw new Error('Network is disabled for the scripted evaluation host');};
fs.mkdirSync(output, {recursive: true});
const files = [];
function walk(dir) {for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
  if (e.isSymbolicLink()) throw new Error('Case symlinks are not accepted');
  const file = path.join(dir, e.name);
  if (e.isDirectory()) walk(file); else if (e.name.endsWith('.json')) files.push(file);
}}
walk(cases);
if (!files.length) throw new Error('No scenario JSON files found');
const results = [];
for (const file of files.sort()) {
  const scene = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = await runScriptedCase(scene, path.join(output, scene.case_id));
  results.push(...rows.map(({artifact, directory, ...row}) => ({...row, directory: path.relative(output, directory)})));
}
const summary = {host_version: HOST_VERSION, real_model_calls: 0, messages_sent: 0,
  cases: files.length, condition_runs: results.length, passed: results.every(r => r.passed),
  naturalness_measured: false, historical_delivery_validated: false, results};
fs.writeFileSync(path.join(output, 'offline-adaptation.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({cases: summary.cases, condition_runs: summary.condition_runs,
  passed: summary.passed, real_model_calls: 0, messages_sent: 0}));
