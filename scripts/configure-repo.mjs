import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const owner = process.argv[2];
if (!owner || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner)) {
  console.error('Usage: npm run configure -- <github-owner>');
  process.exit(1);
}

const skip = new Set(['.git', 'node_modules', 'dist', 'reports', '.verify']);
const skipFiles = new Set(['scripts/configure-repo.mjs', 'scripts/release-check.mjs']);
const extensions = new Set(['.md', '.json', '.yml', '.yaml', '.mjs']);
const changed = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (skip.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(file);
      continue;
    }
    if (!extensions.has(path.extname(entry.name).toLowerCase())) continue;
    const relative = path.relative(root, file).replaceAll('\\', '/');
    if (skipFiles.has(relative)) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes('OWNER')) continue;
    fs.writeFileSync(file, text.replaceAll('OWNER', owner));
    changed.push(relative);
  }
}

walk(root);
if (!changed.length) {
  console.log('No OWNER placeholders found. Nothing changed.');
} else {
  console.log(JSON.stringify({owner, changed}, null, 2));
}
