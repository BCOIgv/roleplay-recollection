import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {MemoryStore} from '../src/store.mjs';

const identity = Object.freeze({
  characterId: 'whale',
  scopeId: 'owner',
  mode: 'companion',
  storyId: null,
});

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'roleplay-store-test-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  return {
    directory,
    store: new MemoryStore({directory, identity}),
    lock: path.join(directory, 'memory-writer.lock'),
  };
}

test('a stale writer lock is reclaimed after its process disappears', t => {
  const {store, lock} = fixture(t);
  fs.writeFileSync(lock, '999999');
  const result = store.transaction(state => {
    state.epoch++;
    return state.epoch;
  });
  assert.equal(result, 1);
  assert.equal(fs.existsSync(lock), false);
});

test('a live writer lock is not stolen', t => {
  const {store, lock} = fixture(t);
  fs.writeFileSync(lock, String(process.pid));
  assert.throws(
    () => store.transaction(state => { state.epoch++; }),
    /locked by another writer/,
  );
  fs.unlinkSync(lock);
});
