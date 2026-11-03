import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MAX_STATE_BYTES = 3 * 1024 * 1024;
const MAX_WRITE_BYTES = 2.5 * 1024 * 1024;

export function initialState(identity) {
  return {
    version: 2,
    identity,
    paused: false,
    epoch: 0,
    episodes: [],
    thoughts: [],
    expressions: [],
    runs: [],
    days: {},
    lastAttemptAt: null,
    lastExpressionAt: null,
    inflight: null,
  };
}

export function validateState(value, identity) {
  if (!value || value.version !== 2 || JSON.stringify(value.identity) !== JSON.stringify(identity)) {
    throw new Error('Memory store belongs to another character, scope or story');
  }
  const counter = candidate => Number.isSafeInteger(candidate) && candidate >= 0;
  const time = candidate => candidate === null || counter(candidate);
  if (typeof value.paused !== 'boolean' || !counter(value.epoch) || !time(value.lastAttemptAt)
      || !time(value.lastExpressionAt) || !value.days || Array.isArray(value.days)) {
    throw new Error('Invalid memory state');
  }
  for (const name of ['episodes', 'thoughts', 'expressions', 'runs']) {
    if (!Array.isArray(value[name])) throw new Error('Invalid memory collection');
  }
  for (const day of Object.values(value.days)) {
    if (!counter(day.calls)) throw new Error('Invalid persisted call budget');
  }
  for (const record of value.episodes) {
    if (!record || typeof record.id !== 'string'
        || !/^[a-f0-9]{64}$/.test(record.revision)
        || !/^[a-f0-9]{64}$/.test(record.sourceKey)
        || !['active', 'unavailable', 'withdrawn'].includes(record.status)) {
      throw new Error('Invalid saved episode identity');
    }
    if (record.status === 'withdrawn') continue;
    if (!['observed', 'reported', 'fictional'].includes(record.truth) || !counter(record.occurredAt)
        || !time(record.lastRecalledAt) || !time(record.lastExpressionAt) || !counter(record.recallCount)
        || !Number.isFinite(record.rehearsalBoost) || record.rehearsalBoost < 0 || record.rehearsalBoost > 0.1
        || typeof record.detailFaded !== 'boolean' || !Array.isArray(record.tags) || !Array.isArray(record.evidence)) {
      throw new Error('Invalid saved episode');
    }
    if (record.lastWanderSeenAt !== undefined && !time(record.lastWanderSeenAt)) {
      throw new Error('Invalid saved episode timestamp');
    }
    if (record.lastContactAt !== undefined && !time(record.lastContactAt)) {
      throw new Error('Invalid saved episode timestamp');
    }
    if (typeof record.gist !== 'string' || !Number.isFinite(record.importance)
        || !Number.isFinite(record.emotionalWeight)) {
      throw new Error('Invalid episode content');
    }
  }
  if (value.inflight && (!counter(value.inflight.pid) || typeof value.inflight.id !== 'string'
      || !counter(value.inflight.started))) {
    throw new Error('Invalid in-progress recollection');
  }
  if (value.solitude) {
    const solitude = value.solitude;
    const plan = solitude.plan;
    if (!counter(solitude.lastEndedAt) || !time(solitude.lastContactAt) || !Array.isArray(solitude.history) || !plan
        || typeof plan.id !== 'string' || !counter(plan.timeAt) || !counter(plan.dueAt) || !counter(plan.expiresAt)
        || !counter(plan.threshold) || plan.threshold === 0 || !time(plan.growthAt)
        || !Array.isArray(plan.baseline) || !plan.baseline.every(key => /^[a-f0-9]{64}$/.test(key))
        || !['time', 'growth'].includes(plan.reason)) {
      throw new Error('Invalid solitude plan');
    }
  }
  return value;
}

export class MemoryStore {
  constructor({directory, identity}) {
    this.identity = identity;
    this.state = initialState(identity);
    this.directory = directory ? path.resolve(directory) : null;
    if (this.directory) {
      fs.mkdirSync(this.directory, {recursive: true, mode: 0o700});
      if (fs.lstatSync(this.directory).isSymbolicLink()) throw new Error('Linked memory directory rejected');
      this.file = path.join(this.directory, 'memory-state.json');
      this.lock = path.join(this.directory, 'memory-writer.lock');
    }
    this.read();
  }

  read() {
    if (!this.file) return validateState(structuredClone(this.state), this.identity);
    try {
      const stat = fs.lstatSync(this.file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > MAX_STATE_BYTES) {
        throw new Error('Invalid memory file');
      }
      return validateState(JSON.parse(fs.readFileSync(this.file, 'utf8')), this.identity);
    } catch (error) {
      if (error.code === 'ENOENT') return initialState(this.identity);
      throw error;
    }
  }

  acquireLock() {
    if (!this.lock) return undefined;
    try {
      return fs.openSync(this.lock, 'wx', 0o600);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      this.reclaimStaleLock();
      return fs.openSync(this.lock, 'wx', 0o600);
    }
  }

  reclaimStaleLock() {
    let pid = NaN;
    try {
      pid = Number(fs.readFileSync(this.lock, 'utf8').trim());
    } catch {
      // An empty or unreadable lock file cannot belong to a live writer.
    }
    let alive = false;
    if (Number.isSafeInteger(pid) && pid > 0) {
      try {
        process.kill(pid, 0);
        alive = true;
      } catch (error) {
        alive = error.code !== 'ESRCH';
      }
    }
    if (alive) throw new Error('Memory store is locked by another writer');
    fs.unlinkSync(this.lock);
  }

  transaction(fn) {
    let lock;
    try {
      lock = this.acquireLock();
      if (lock !== undefined) fs.writeFileSync(lock, String(process.pid));
      const state = this.read();
      const result = fn(state);
      validateState(state, this.identity);
      const raw = JSON.stringify(state, null, 2) + '\n';
      if (Buffer.byteLength(raw) > MAX_WRITE_BYTES) throw new Error('Memory capacity reached');
      if (this.file) {
        const temp = this.file + '.' + crypto.randomUUID();
        try {
          fs.writeFileSync(temp, raw, {flag: 'wx', mode: 0o600});
          fs.renameSync(temp, this.file);
        } finally {
          if (fs.existsSync(temp)) fs.unlinkSync(temp);
        }
      } else {
        this.state = state;
      }
      return result;
    } finally {
      if (lock !== undefined) {
        fs.closeSync(lock);
        fs.unlinkSync(this.lock);
      }
    }
  }
}
