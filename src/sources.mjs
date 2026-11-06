import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {memoryView} from './memory.mjs';
import {DEFAULTS} from './policy.mjs';
import {sqliteRows} from './source-sqlite.mjs';
import {assertSeparateDirectory} from './source-paths.mjs';

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const name = value => typeof value === 'string' && value.trim().length > 0;
const fields = new Set(['id', 'text', 'scope', 'time', 'truth', 'status', 'storyId']);

function keys(value, allowed) {
  if (!object(value)) fail('Expected configuration object');
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail('Unknown setting: ' + key);
}

export function validateSourceConfig(input) {
  keys(input, ['id', 'file', 'format', 'collection', 'fields', 'timeUnit', 'maxBytes', 'nativePolicy', 'rp', 'statusMap', 'truthMap', 'schemaFingerprint', 'maxRecords']);
  if (!name(input.id) || !name(input.file)) fail('Source id and file are required');
  if (!['native-v2', 'json', 'jsonl', 'sqlite'].includes(input.format)) fail('Unsupported source format');
  const cfg = structuredClone(input);
  cfg.file = path.resolve(cfg.file);
  cfg.maxBytes ??= 8 * 1024 * 1024;
  if (!Number.isSafeInteger(cfg.maxBytes) || cfg.maxBytes < 1 || cfg.maxBytes > 64 * 1024 * 1024) fail('Invalid maxBytes');
  if (cfg.collection !== undefined && !name(cfg.collection)) fail('Invalid collection');
  if (cfg.collection !== undefined && !['json','sqlite'].includes(cfg.format)) fail('collection is only supported for JSON/SQLite');
  if (cfg.format === 'sqlite' && !name(cfg.collection)) fail('SQLite table is required');
  cfg.maxRecords ??= 100000;
  if (!Number.isInteger(cfg.maxRecords) || cfg.maxRecords < 1 || cfg.maxRecords > 100000) fail('Invalid maxRecords');
  if (cfg.schemaFingerprint !== undefined && !/^[a-f0-9]{64}$/.test(cfg.schemaFingerprint)) fail('Invalid schema fingerprint');
  for (const [key, values] of [['statusMap',['active','archived','withdrawn','unavailable','unknown']], ['truthMap',['observed','reported','fictional','unknown']]]) {
    if (cfg[key] !== undefined && (!object(cfg[key]) || Object.values(cfg[key]).some(x=>!values.includes(x)))) fail('Invalid enum mapping');
  }
  if (cfg.rp !== undefined) {
    keys(cfg.rp,['enabled','textField','detail']);
    if (typeof cfg.rp.enabled !== 'boolean' || (cfg.rp.textField !== undefined && !name(cfg.rp.textField)) || (cfg.rp.detail !== undefined && !['specific','impression'].includes(cfg.rp.detail))) fail('Invalid RP policy');
  }
  if (cfg.format !== 'native-v2') {
    keys(cfg.fields, [...fields]);
    if (!name(cfg.fields.id) || !name(cfg.fields.text)) fail('id and text mappings are required');
    for (const value of Object.values(cfg.fields)) if (!name(value)) fail('Invalid field mapping');
    if (cfg.fields.time && !['seconds', 'milliseconds', 'iso'].includes(cfg.timeUnit)) fail('Time unit is required');
    if (cfg.nativePolicy !== undefined) fail('nativePolicy requires native-v2');
  } else {
    if (cfg.fields !== undefined || cfg.timeUnit !== undefined) fail('Native source has a fixed schema');
    if (cfg.nativePolicy !== undefined) {
      keys(cfg.nativePolicy, ['detailThreshold', 'dormantThreshold']);
      const policy = {...DEFAULTS, ...cfg.nativePolicy};
      if (!(policy.dormantThreshold > 0 && policy.detailThreshold < 1 && policy.detailThreshold > policy.dormantThreshold)) fail('Invalid native visibility policy');
    }
  }
  return cfg;
}

// A fixed field name, never a JavaScript expression or executable JSONPath.
function field(row, key) {
  return key !== undefined && Object.hasOwn(row, key) ? row[key] : undefined;
}

function timestamp(value, unit) {
  if (value === undefined || value === null) return null;
  const result = unit === 'iso'
    ? typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? Date.parse(value) : NaN
    : typeof value === 'number' ? value * (unit === 'seconds' ? 1000 : 1) : NaN;
  if (!Number.isSafeInteger(result) || result < 0) fail('Invalid event time');
  return result;
}

export function readSourceBytes(cfg) {
  // Reject aliases at registration/use time; no mkdir, locks, migration or repairs.
  const real = fs.realpathSync(cfg.file);
  if (path.relative(real, cfg.file) !== '') fail('Source aliases are not supported');
  const before = fs.lstatSync(cfg.file, {bigint: true});
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n) fail('Source must be a regular unlinked file');
  if (before.size > BigInt(cfg.maxBytes)) fail('Source exceeds maxBytes');
  const fd = fs.openSync(cfg.file, 'r');
  try {
    const opened = fs.fstatSync(fd, {bigint: true});
    if (opened.dev !== before.dev || opened.ino !== before.ino) fail('Source changed while opening');
    if (!opened.isFile() || opened.nlink !== 1n || opened.size > BigInt(cfg.maxBytes)) fail('Source changed or exceeds maxBytes');
    const buffer = Buffer.alloc(Number(opened.size) + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const count = fs.readSync(fd, buffer, offset, buffer.length - offset, null);
      if (!count) break;
      offset += count;
    }
    const after = fs.fstatSync(fd, {bigint: true});
    if (offset !== Number(opened.size) || after.size !== opened.size || after.mtimeNs !== opened.mtimeNs || after.ctimeNs !== opened.ctimeNs) fail('Source changed during read');
    return buffer.subarray(0, offset);
  } finally { fs.closeSync(fd); }
}

export class ReadOnlyMemorySource {
  #config;
  constructor(config) { this.#config = validateSourceConfig(config); }
  get id() { return this.#config.id; }
  get config() { return structuredClone(this.#config); }

  snapshot({now = Date.now()} = {}) {
    if (!Number.isSafeInteger(now) || now < 0) fail('Invalid snapshot time');
    const cfg = this.#config;
    const bytes = readSourceBytes(cfg);
    let snapshotId = hash(bytes);
    const raw = cfg.format === 'sqlite' ? null : new TextDecoder('utf-8', {fatal: true}).decode(bytes);
    let rows, identity, paused = false;
    let schema;
    if (cfg.format === 'sqlite') {
      const data=sqliteRows(cfg);
      rows=data.rows; schema=data.schema;
      snapshotId=hash(JSON.stringify(rows.map(r=>JSON.stringify(r)).sort()));
    } else if (cfg.format === 'jsonl') {
      rows = raw.split(/\r?\n/).filter(line => line.trim()).map((line, index) => {
        try { return JSON.parse(line); } catch { fail('Invalid JSONL record ' + (index + 1)); }
      });
    } else {
      const parsed = JSON.parse(raw);
      if (cfg.format === 'native-v2') {
        if (parsed?.version !== 2 || !object(parsed.identity) || !Array.isArray(parsed.episodes)) fail('Unsupported native state');
        identity = parsed.identity;
        if (typeof parsed.paused !== 'boolean') fail('Invalid native pause state');
        paused = parsed.paused;
        if (!name(identity.characterId) || !name(identity.scopeId) || !['companion', 'roleplay'].includes(identity.mode)) fail('Invalid native identity');
        rows = parsed.episodes;
      } else rows = cfg.collection ? field(parsed, cfg.collection) : parsed;
    }
    if (!Array.isArray(rows)) fail('Mapped collection must be an array');
    if (rows.length > cfg.maxRecords) fail('Source record limit exceeded');
    schema ??= [...new Set(rows.flatMap(r=>object(r)?Object.keys(r):[]))].sort();
    const schemaFingerprint=hash(JSON.stringify(schema));
    if (cfg.schemaFingerprint && cfg.schemaFingerprint !== schemaFingerprint) fail('Source schema changed; reconfigure source');
    const seen = new Set();
    const materials = rows.map((row, index) => {
      if (!object(row)) fail('Invalid record at ' + index);
      const native = cfg.format === 'native-v2';
      const get = key => field(row, native ? ({text: 'gist', time: 'occurredAt'}[key] ?? key) : cfg.fields[key]);
      const id = get('id');
      if (!(name(id) || Number.isSafeInteger(id))) fail('Record needs a stable id at ' + index);
      const sourceScope = native ? identity.scopeId : get('scope') ?? null;
      if (sourceScope !== null && !name(sourceScope)) fail('Invalid source scope');
      const ref = hash(JSON.stringify([cfg.id, cfg.collection ?? '', sourceScope, String(id)]));
      if (seen.has(ref)) fail('Duplicate record identity');
      seen.add(ref);
      const rawStatus = get('status');
      const status = cfg.statusMap && Object.hasOwn(cfg.statusMap,String(rawStatus)) ? cfg.statusMap[String(rawStatus)] : rawStatus ?? 'unknown';
      if (!['active', 'archived', 'withdrawn', 'unavailable', 'unknown'].includes(status)) fail('Unmapped source status');
      const rawTruth = get('truth');
      const truth = cfg.truthMap && Object.hasOwn(cfg.truthMap,String(rawTruth)) ? cfg.truthMap[String(rawTruth)] : rawTruth ?? 'unknown';
      if (!['observed', 'reported', 'fictional', 'unknown'].includes(truth)) fail('Unmapped truth');
      let text = get('text');
      if (status === 'withdrawn') text = null;
      else if (!name(text)) fail('Record has no text at ' + index);
      const storyId = get('storyId') ?? null;
      if (storyId !== null && !name(storyId)) fail('Invalid story id');
      let rp = null;
      if (native && status === 'active') {
        if (!Array.isArray(row.evidence) || !row.evidence.every(e => object(e) && name(e.text)) || !Array.isArray(row.tags) || !row.tags.every(t => typeof t === 'string') || !Number.isFinite(row.importance) || !Number.isFinite(row.emotionalWeight) || !Number.isFinite(row.rehearsalBoost) || typeof row.detailFaded !== 'boolean') fail('Invalid native visibility fields');
        timestamp(row.occurredAt, 'milliseconds');
        timestamp(row.lastRecalledAt, 'milliseconds');
        const view = memoryView(row, {...DEFAULTS, ...cfg.nativePolicy}, now);
        if (view && !paused && cfg.rp?.enabled !== false) rp = {text: view.gist, detail: view.detail, evidence: view.evidence};
      }
      if (!native && cfg.rp?.enabled && status === 'active') {
        const projected=cfg.rp.textField ? field(row,cfg.rp.textField) : text;
        if (!name(projected)) fail('Missing RP text');
        rp={text:projected,detail:cfg.rp.detail ?? 'impression',evidence:[]};
      }
      return {ref, sourceId: cfg.id, originalId: String(id), sourceScope, storyId,
        characterId: identity?.characterId ?? null, truth, status, text,
        eventAt: status === 'withdrawn' ? null : timestamp(get('time'), native ? 'milliseconds' : cfg.timeUnit),
        revision: hash(JSON.stringify([row,cfg.rp,cfg.nativePolicy])),
        snapshotId, rp};
    });
    return {sourceId: cfg.id, snapshotId, schemaFingerprint, asOf: now, consistency: cfg.format === 'sqlite' ? 'transaction' : 'file-version',
      scanned: rows.length, materials};
  }
}

// The callback belongs to trusted host code. Chat/model input is never authority.
export class GlobalMemoryLibrary {
  #sources;
  #authorize;
  #unavailable;
  #runtimeDirectories = new Set();
  #cursorKey = crypto.randomBytes(32);
  constructor({sources, authorize, unavailableSources = []}) {
    if (!Array.isArray(sources) || typeof authorize !== 'function') fail('Sources and host authorization are required');
    this.#sources = sources.map(cfg => new ReadOnlyMemorySource(cfg));
    if (new Set(this.#sources.map(s => s.id)).size !== sources.length) fail('Duplicate source id');
    this.#authorize = authorize;
    this.#unavailable = unavailableSources.map(s=>({sourceId:s.id,status:'failed',reason:s.reason??'setup_incomplete'}));
  }
  assertRuntimeDirectory(directory) { const resolved=assertSeparateDirectory(directory,this.#sources.map(s=>s.config.file));this.#runtimeDirectories.add(resolved);return resolved; }
  replaceSource(config) {
    const reader=new ReadOnlyMemorySource(config);
    for(const directory of this.#runtimeDirectories)assertSeparateDirectory(directory,[reader.config.file]);
    const i=this.#sources.findIndex(s=>s.id===reader.id);
    if(i<0) fail('Unknown registered source');
    this.#sources[i]=reader;
  }

  async query({query = '', limit = 20, purpose = 'admin', context, now = Date.now(), cursor = null} = {}) {
    if (typeof query !== 'string' || query.length > 1000 || !Number.isInteger(limit) || limit < 1 || limit > 500 || !['admin', 'rp'].includes(purpose)) fail('Invalid global query');
    const sourceResults = [...this.#unavailable], hits = [];
    for (const source of this.#sources) {
      if (await this.#authorize({context, purpose, sourceId: source.id}) !== true) {
        sourceResults.push({sourceId: source.id, status: 'denied'});
        continue;
      }
      try {
        const snapshot = source.snapshot({now});
        const sourceHits = [];
        for (const item of snapshot.materials) {
          if (await this.#authorize({context, purpose, sourceId: source.id, material: structuredClone(item)}) !== true) continue;
          // Generic imports require a future explicit visibility policy before RP use.
          const text = purpose === 'rp' ? item.rp?.text : item.text;
          if (text == null || !text.toLowerCase().includes(query.toLowerCase())) continue;
          sourceHits.push(purpose === 'rp'
            ? {...item, text, detail: item.rp.detail, eventAt: item.rp.detail === 'specific' ? item.eventAt : null, rp: undefined}
            : item);
        }
        hits.push(...sourceHits);
        sourceResults.push({sourceId: source.id, status: 'ok', snapshotId: snapshot.snapshotId, scanned: snapshot.scanned});
      } catch (error) { sourceResults.push({sourceId: source.id, status: 'failed', reason: error.code || 'source_read_or_policy_failed'}); }
    }
    hits.sort((a,b) => a.ref.localeCompare(b.ref));
    const fingerprint=hash(JSON.stringify([query,purpose,sourceResults,hits]));
    const sign=body=>crypto.createHmac('sha256',this.#cursorKey).update(body).digest('hex');
    let offset=0;
    if(cursor) {
      if(typeof cursor!=='string' || cursor.length>1000) fail('Invalid cursor');
      const [body,mac]=cursor.split('.');
      if(sign(body)!==mac) fail('Invalid cursor');
      const previous=JSON.parse(Buffer.from(body,'base64url'));
      if(previous.fingerprint!==fingerprint) fail('Stale cursor: source or permissions changed');
      offset=previous.offset;
    }
    const more=hits.length>offset+limit;
    const body=Buffer.from(JSON.stringify({fingerprint,offset:offset+limit})).toString('base64url');
    return {scope: 'admin-global', items: hits.slice(offset, offset+limit), matched: hits.length,
      nextCursor:more?body+'.'+sign(body):null, truncated: more, sourceResults,
      sourceCoverage: sourceResults.every(s => s.status === 'ok') ? 'complete' : 'partial'};
  }
  async resolve(references, {context, now=Date.now()}={}) {
    const result=await this.query({purpose:'rp',context,now,limit:500});
    let items=[...result.items], cursor=result.nextCursor;
    while(cursor) { const page=await this.query({purpose:'rp',context,now,limit:500,cursor});items.push(...page.items);cursor=page.nextCursor; }
    return references.every(ref=>items.some(m=>m.ref===ref.ref && m.revision===ref.revision && m.detail===ref.detail && m.text===ref.text));
  }
}
