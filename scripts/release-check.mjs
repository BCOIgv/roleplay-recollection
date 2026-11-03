import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const dshPkgPath = path.join(root, 'dsh/package.json');
const dshPkg = fs.existsSync(dshPkgPath) ? JSON.parse(fs.readFileSync(dshPkgPath, 'utf8')) : null;
const required = [
  'README.md', 'README.en.md', 'LICENSE', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md',
  'CODE_OF_CONDUCT.md', 'index.mjs', 'index.d.ts', '.github/workflows/ci.yml',
  'docs/api.md', 'docs/architecture.md', 'docs/solitude.md', 'docs/naming.md',
  'docs/releasing.md', 'docs/verification.md',
  'dsh/package.json', 'dsh/index.js', 'dsh/cordis.patch.yml', 'dsh/README.md',
  'dsh/locale/en.json', 'dsh/locale/zh.json', 'dsh/icon.svg',
];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`missing required file: ${file}`);
}
if (pkg.name !== 'roleplay-recollection') errors.push(`unexpected package name: ${pkg.name}`);
if (pkg.private) errors.push('package.json is still marked private');
if (pkg.license !== 'MIT') errors.push(`unexpected license: ${pkg.license}`);
if (!pkg.repository?.url || pkg.repository.url.includes('OWNER')) {
  errors.push('repository URL still contains OWNER; run: npm run configure -- <github-owner>');
}
if (!pkg.exports?.['.']?.types) errors.push('package.json exports["."].types is missing');
if (!Array.isArray(pkg.files) || !pkg.files.includes('src/') || !pkg.files.includes('index.d.ts')) {
  errors.push('package.json files whitelist is incomplete');
}
if (!pkg.engines?.node) errors.push('package.json engines.node is missing');
if (!fs.readFileSync(path.join(root, 'LICENSE'), 'utf8').startsWith('MIT License')) {
  errors.push('LICENSE is not an MIT license');
}

const policy = fs.readFileSync(path.join(root, 'src/policy.mjs'), 'utf8');
const version = policy.match(/export const VERSION = '([^']+)'/)?.[1];
if (version !== pkg.version) errors.push(`src/policy.mjs VERSION ${version} does not match package.json ${pkg.version}`);

if (dshPkg) {
  if (dshPkg.name !== 'roleplay-recollection-dsh') errors.push(`unexpected DSH package name: ${dshPkg.name}`);
  if (dshPkg.version !== pkg.version) errors.push('DSH package version does not match the core package');
  if (dshPkg.license !== 'MIT') errors.push(`unexpected DSH license: ${dshPkg.license}`);
  if (dshPkg.dsh?.bundle?.patch !== './cordis.patch.yml') errors.push('DSH bundle patch is missing');
  if (dshPkg.dependencies?.['roleplay-recollection'] !== '^' + pkg.version) {
    errors.push('DSH package must depend on the matching roleplay-recollection version');
  }
  if (!dshPkg.repository?.url || dshPkg.repository.url.includes('OWNER')) {
    errors.push('DSH repository URL still contains OWNER; run: npm run configure -- <github-owner>');
  }
}

const skip = new Set(['.git', 'node_modules', 'dist', 'reports', '.verify']);
const textExtensions = new Set(['.md', '.json', '.mjs', '.cjs', '.js', '.ts', '.yml', '.yaml', '.svg', '.txt']);
const patterns = [
  [/\b(?:D:\\|C:\\Users\\|\/Users\/|\/home\/[A-Za-z0-9._-]+\/)/, 'absolute personal path'],
  [/\bsk-[A-Za-z0-9_-]{16,}/, 'possible API key'],
  [/\bghp_[A-Za-z0-9]{20,}/, 'possible GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/, 'possible GitHub token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'possible AWS access key'],
  [/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/, 'private key material'],
  [/\bMosim\b/, 'personal username'],
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (skip.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(file);
      continue;
    }
    if (!textExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    const relative = path.relative(root, file).replaceAll('\\', '/');
    if (relative === 'scripts/release-check.mjs') continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const [pattern, label] of patterns) {
      if (pattern.test(text)) errors.push(`${label}: ${relative}`);
    }
  }
}

walk(root);
if (!errors.length && pkg.repository?.url?.includes('example')) {
  warnings.push('repository URL looks like a placeholder');
}

console.log(JSON.stringify({
  ok: errors.length === 0,
  package: `${pkg.name}@${pkg.version}`,
  errors,
  warnings,
}, null, 2));
if (errors.length) process.exitCode = 1;
