import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CompanionMemory, GlobalRecollection, DEFAULTS} from '../index.mjs';

// Scripted control-flow probes only. No provider client or message sender is used.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marker = 'synthetic-private-thought-marker';
const start = Date.parse('2026-11-07T15:00:00+08:00');
const cases = [
  {id: 'quiet-exit', action: 'leave', calls: 1},
  {id: 'default-ceilings', action: 'follow', calls: 2},
  {id: 'shared-budget', action: 'follow', maxWanderSteps: 3, calls: 2},
  {id: 'cue-spends-budget', action: 'follow', maxWanderSteps: 3, priorCue: true, calls: 1},
  {id: 'thought-storage-without-replay', action: 'follow', thought: true, calls: 2},
  {id: 'foreground-priority', action: 'follow', busy: true, calls: 0},
  {id: 'abort-late-share', action: 'leave', abort: true, share: true, calls: 1},
  {id: 'deadline-after-hook', action: 'leave', deadline: true, share: true, calls: 1},
  {id: 'share-ends-session', action: 'leave', share: true, calls: 1},
  {id: 'share-with-expression-disabled', action: 'leave', share: true, allowExpression: false, calls: 1},
  {id: 'linger-until-ceiling', action: 'linger', maxWanderSteps: 3, dailyModelCalls: 3, calls: 3},
];

async function probe(mode, spec) {
  let now = start;
  let cueCalls = 0;
  const calls = [];
  const aborter = new AbortController();
  const access = Object.freeze({id: 'synthetic-owner'});
  const rawItems = Array.from({length: 8}, (_, i) => ({
    id: `synthetic-${i}`, gist: `共同经历 ${i}：一起听雨和阅读`,
  }));
  const globalItems = rawItems.map(item => ({
    ref: item.id, revision: 'synthetic-v1', text: item.gist,
    detail: 'specific', truth: 'observed', sourceId: 'synthetic',
  }));
  const library = {
    async query({context}) {
      assert.equal(context, access);
      return {items: structuredClone(globalItems), nextCursor: null,
        sourceResults: [{sourceId: 'synthetic', status: 'ok'}]};
    },
  };
  const overrides = Object.fromEntries(['maxWanderSteps', 'dailyModelCalls']
    .filter(key => spec[key] !== undefined).map(key => [key, spec[key]]));
  const config = {
    characterId: 'synthetic-character', scopeId: 'synthetic-scope', mode: 'companion',
    ...overrides,
  };
  const hooks = {
    now: () => now, random: () => 0,
    reflect: () => {cueCalls++; return {value: {action: 'silence'}};},
    wander: request => {
      const memory = request.input.memories[0];
      const id = memory.id ?? memory.ref;
      const anchor = memory.gist ?? memory.text;
      calls.push({
        actionRequested: spec.action,
        visibleIds: request.input.memories.map(m => m.id ?? m.ref),
        previousThoughtPresent: JSON.stringify(request.input).includes(marker),
      });
      if (spec.abort) aborter.abort(new Error('Synthetic foreground event'));
      if (spec.deadline) now += DEFAULTS.solitudeMinutes * 60000 + 1;
      return {value: {
        action: spec.action,
        ...(spec.action !== 'leave' || spec.share || spec.thought ? {memoryId: id, anchor} : {}),
        ...(spec.thought && calls.length === 1 ? {thought: marker} : {}),
        ...(spec.share ? {shareText: '又想起那次一起听雨。'} : {}),
      }};
    },
  };
  const runtime = mode === 'local' ? new CompanionMemory(config, hooks)
    : new GlobalRecollection(config, {...hooks, library, contextKey: a => a === access ? 'synthetic-owner:private' : null});
  const options = {access, signal: aborter.signal};
  try {
    if (mode === 'local') for (const item of rawItems) runtime.capture({
      ...item, occurredAt: now - 3600000, truth: 'observed', importance: 0.7,
      tags: ['共同经历', '雨天'],
      evidence: [{id: item.id, kind: 'shared_event', text: item.gist}],
    }, {mode: 'companion'});
    now = mode === 'local' ? runtime.status().solitude.nextAt : runtime.status().nextAt;
    if (spec.priorCue) {
      const cue = await runtime.recollect({mode: 'companion', trigger: 'cue',
        cue: '共同经历', opportunityId: 'synthetic-cue'}, options);
      assert.equal(cue.modelCalls, 1);
    }
    const outcome = await runtime.solitude({mode: 'companion',
      lastInteractionAt: now - 3600000, busy: spec.busy === true,
      allowExpression: spec.allowExpression !== false}, options);
    const thoughts = await runtime.privateThoughts({mode: 'companion', trigger: 'idle'}, {access});
    assert.equal(calls.length, spec.calls);
    assert.equal(outcome.modelCalls, spec.calls);
    assert.equal(cueCalls, spec.priorCue ? 1 : 0);
    if (spec.abort) {
      if (mode === 'local') assert.equal(outcome.reason, 'interrupted');
      else assert.equal(outcome.status, 'interrupted');
      assert.ok(!outcome.intentId);
    } else if (spec.deadline) {
      if (mode === 'local') assert.equal(outcome.reason, 'interrupted_or_deadline');
      else assert.equal(outcome.reason, 'stale_source');
      assert.ok(!outcome.intentId);
    } else if (spec.share) {
      const expectedCandidate = mode === 'local' || spec.allowExpression !== false;
      assert.equal(Boolean(outcome.intentId), expectedCandidate);
      assert.equal(outcome.sent, false);
    } else assert.ok(!outcome.intentId);
    if (spec.thought) {
      assert.ok(thoughts.some(t => t.text === marker));
      assert.ok(calls.slice(1).every(c => !c.previousThoughtPresent));
    }
    if (spec.action === 'linger') assert.ok(calls.every(c => c.visibleIds[0] === calls[0].visibleIds[0]));
    if (mode === 'local') {
      if (spec.id === 'quiet-exit') assert.equal(outcome.reason, 'left_quietly');
      if (spec.id === 'default-ceilings') assert.equal(outcome.reason, 'step_limit');
      if (['shared-budget', 'cue-spends-budget'].includes(spec.id)) assert.equal(outcome.reason, 'model_budget');
    }
    return {id: spec.id, mode, passed: true, fixtureOverrides: overrides,
      priorCueCalls: cueCalls, scriptedWanderCalls: calls.length,
      status: outcome.status, publicFinishReason: outcome.reason ?? null,
      hasExpressionCandidate: Boolean(outcome.intentId), savedThoughts: thoughts.length,
      allowExpression: spec.allowExpression !== false, calls};
  } finally {await runtime.close();}
}

const results = [];
for (const mode of ['local', 'global']) for (const spec of cases) results.push(await probe(mode, spec));
const policy = fs.readFileSync(path.join(root, 'src/policy.mjs'));
const report = {
  synthetic: true, purpose: 'control-flow observations, not product-effect evidence',
  node: process.version, platform: process.platform,
  policySha256: crypto.createHash('sha256').update(policy).digest('hex'),
  runtimeDefaults: Object.fromEntries(['maxWanderSteps', 'dailyModelCalls', 'memoriesPerStep',
    'solitudeMinutes', 'modelTimeoutMs', 'maxOutputTokens'].map(key => [key, DEFAULTS[key]])),
  sourceMode: 'local episodes; global in-memory synthetic library',
  runtimeDefaultsChanged: false, externalModelCalls: 0, messagesSent: 0,
  globalFinishReasonLimit: 'null means the public result lacks a detailed cause; it does not mean voluntary exit',
  cases: results,
};
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output')) throw new Error('Usage: node evaluation/offline-boundaries.mjs [--output path]');
if (args.length) {
  const file = path.resolve(args[1]);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({synthetic: true, casesPassed: results.length,
    externalModelCalls: 0, messagesSent: 0, output: path.relative(root, file)}));
} else console.log(JSON.stringify(report, null, 2));
