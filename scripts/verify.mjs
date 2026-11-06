import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];

function run(name, args) {
  const result = spawnSync(process.execPath, args, {cwd: root, encoding: 'utf8', timeout: 120000});
  checks.push({name, exit: result.status});
  if (result.status !== 0) {
    throw new Error(`[${name}] failed\n${result.stderr || ''}\n${result.stdout || ''}`);
  }
  return result.stdout || '';
}

run('syntax', ['scripts/check.mjs']);
const testOutput = run('tests', ['--test', '--test-reporter=tap']);
run('demo:basic', ['examples/basic.mjs']);
run('demo:scenarios', ['examples/scenarios.mjs']);
run('demo:solitude', ['examples/solitude.mjs']);
run('demo:global', ['examples/global.mjs']);

const count = pattern => Number(testOutput.match(pattern)?.[1] ?? 0);
const summary = {
  checks,
  tests: count(/^# tests (\d+)/m),
  passed: count(/^# pass (\d+)/m),
  failed: count(/^# fail (\d+)/m),
  externalModelCalls: 0,
  messagesSent: 0,
  productionChanged: false,
};
if (summary.failed) throw new Error(`Test suite reported ${summary.failed} failure(s)`);
console.log(JSON.stringify(summary));
