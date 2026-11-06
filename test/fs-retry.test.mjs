import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {retryWindowsFileOperation} from '../src/fs-retry.mjs';
import {MemoryStore} from '../src/store.mjs';

test('Windows transient errors retry the file operation and preserve its result', () => {
  for (const code of ['EPERM', 'EACCES', 'EBUSY']) {
    let attempts = 0;
    const result = retryWindowsFileOperation(() => {
      if (++attempts === 1) throw Object.assign(new Error('delete pending'), {code});
      return 'created';
    }, 100, 'win32');
    assert.equal(attempts, 2);
    assert.equal(result, 'created');
  }
});

test('permanent permission errors remain errors after a bounded Windows retry', () => {
  const denied = Object.assign(new Error('denied'), {code: 'EPERM'});
  const started = Date.now();
  assert.throws(() => retryWindowsFileOperation(() => { throw denied; }, 10, 'win32'), e => e === denied);
  assert.ok(Date.now() - started < 1000);
});

test('existing guards, unrelated errors and non-Windows permission failures are not retried', () => {
  for (const [code, platform] of [['EEXIST', 'win32'], ['ENOENT', 'win32'], ['EPERM', 'linux']]) {
    let attempts = 0;
    assert.throws(() => retryWindowsFileOperation(() => {
      attempts++;
      throw Object.assign(new Error(code), {code});
    }, 100, platform), {code});
    assert.equal(attempts, 1);
  }
});

test('transient guard creation and removal do not replay the transaction', {skip: process.platform !== 'win32'}, t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-retry-test-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  const store = new MemoryStore({directory, identity: {characterId: 'a', scopeId: 'b', mode: 'companion', storyId: null}});
  const mkdir = fs.mkdirSync, rmdir = fs.rmdirSync;
  let creations = 0, removals = 0, transactions = 0;
  fs.mkdirSync = function (target, ...args) {
    if (String(target).endsWith('.guard') && ++creations === 1) throw Object.assign(new Error('pending delete'), {code: 'EPERM'});
    return mkdir.call(this, target, ...args);
  };
  fs.rmdirSync = function (target, ...args) {
    if (String(target).endsWith('.guard') && ++removals === 1) throw Object.assign(new Error('busy handle'), {code: 'EBUSY'});
    return rmdir.call(this, target, ...args);
  };
  try {
    assert.equal(store.transaction(s => { transactions++; return ++s.epoch; }), 1);
  } finally { fs.mkdirSync = mkdir; fs.rmdirSync = rmdir; }
  assert.equal(transactions, 1);
  assert.equal(store.read().epoch, 1);
  assert.ok(creations >= 3);
  assert.ok(removals >= 3);
  assert.equal(fs.existsSync(store.lock + '.guard'), false);
});
