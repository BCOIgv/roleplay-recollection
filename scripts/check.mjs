import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let files = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.mjs') || file.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', file], {encoding: 'utf8'});
      if (result.status) throw new Error(result.stderr);
      files++;
    }
  }
}

walk(root);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.name || !pkg.version) throw new Error('package.json is missing name or version');
if (!fs.existsSync(path.join(root, 'index.d.ts'))) throw new Error('index.d.ts is missing');
console.log(JSON.stringify({syntaxFiles: files, package: pkg.name + '@' + pkg.version, passed: true}));
