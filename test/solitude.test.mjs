import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {CompanionMemory} from '../index.mjs';
import {wanderMemories} from '../src/memory.mjs';

const HOUR = 3600000, START = Date.parse('2026-11-03T15:00:00+08:00');
function fixture(t, {config = {}, handler, disk = false, initialAge = 0} = {}) {
  let now = START, calls = 0;
  const inputs = [], instances = [];
  const dir = disk ? fs.mkdtempSync(path.join(os.tmpdir(), 'roleplay-solitude-test-')) : undefined;
  const cfg = {characterId: 'whale', scopeId: 'owner', mode: 'companion',
    solitudeIntervalHours: [72, 72], growthThreshold: [12, 12], growthDelayHours: [2, 2],
    ...(dir ? {stateDir: dir} : {}), ...config};
  const deps = {now: () => now, random: () => 0, wander: async request => {
    calls++; inputs.push(structuredClone(request.input));
    return handler ? handler(request, calls) : {value: {action: 'leave'}};
  }};
  let core = new CompanionMemory(cfg, deps); instances.push(core);
  const add = id => core.capture({id, truth: 'observed', occurredAt: now - initialAge,
    gist: id + ' is a remembered small moment.', importance: 0.5, emotionalWeight: 0.2,
    tags: [id.includes('rain') ? 'rain' : 'other'],
    evidence: [{id: 'source-' + id, kind: 'shared_event', text: 'Original detail for ' + id}]}, {mode: 'companion'});
  add('rain-umbrella'); add('rain-window'); add('paper-whale');
  t.after(async () => {
    for (const instance of instances) await instance.close();
    if (dir) {
      assert.equal(path.dirname(dir), fs.realpathSync(os.tmpdir()));
      assert.ok(path.basename(dir).startsWith('roleplay-solitude-test-'));
      fs.rmSync(dir, {recursive: true, force: true});
    }
  });
  const context = () => ({mode: 'companion', lastInteractionAt: now - HOUR, allowExpression: true});
  return {get core() {return core;}, cfg, deps, inputs, add, context,
    due() {now = core.status().solitude.nextAt;}, advance(hours) {now += hours * HOUR;},
    get now() {return now;}, get calls() {return calls;},
    reopen() {core = new CompanionMemory(cfg, deps); instances.push(core); return core;}};
}
const share = (req, index = 0) => ({value: {action: 'leave', memoryId: req.input.memories[index].id,
  anchor: req.input.memories[index].gist, shareText: 'An old small moment came to mind.'}});

test('random opportunity persists across polling and restart', async t => {
  const f = fixture(t, {disk: true});
  const at = f.core.status().solitude.nextAt;
  assert.equal(at, START + 72 * HOUR);
  assert.equal((await f.core.solitude(f.context())).reason, 'not_due');
  await f.core.close(); f.reopen();
  assert.equal(f.core.status().solitude.nextAt, at);
  assert.equal(f.calls, 0);
});

test('new unique episodes accelerate one opportunity, without counting duplicated evidence', async t => {
  const f = fixture(t, {config: {growthThreshold: [4, 4]}});
  const original = f.core.store.read().solitude.plan.id;
  f.add('new-note');
  await f.core.solitude(f.context());
  const plan = f.core.store.read().solitude.plan;
  assert.equal(plan.id, original); assert.equal(plan.reason, 'growth');
  assert.equal(plan.dueAt, START + 50 * HOUR);
  f.add('another-note'); await f.core.solitude(f.context());
  assert.equal(f.core.status().solitude.nextAt, plan.dueAt);
  assert.equal(f.calls, 0);
  f.due(); await f.core.solitude(f.context());
  assert.notEqual(f.core.store.read().solitude.plan.id, original);
  assert.equal(f.core.store.read().solitude.plan.reason, 'time');
});

test('batch import creates one growth opportunity and never queues catch-up rounds', async t => {
  const f = fixture(t, {config: {growthThreshold: [4, 4]}});
  for (let i = 0; i < 20; i++) f.add('import-' + i);
  await f.core.solitude(f.context()); f.due();
  assert.equal((await f.core.solitude(f.context())).status, 'solitude_ended');
  assert.equal((await f.core.solitude(f.context())).reason, 'not_due');
  assert.equal(f.core.status().solitude.history.length, 1);
});

test('due time alone cannot start while replying, working, recently active or lacking activity evidence', async t => {
  const f = fixture(t); f.due();
  assert.equal((await f.core.solitude({mode: 'task'})).reason, 'task_mode');
  assert.equal((await f.core.solitude({...f.context(), hasPendingWork: true})).reason, 'conversation_has_priority');
  assert.equal((await f.core.solitude({...f.context(), userAwaitingReply: true})).reason, 'conversation_has_priority');
  assert.equal((await f.core.solitude({...f.context(), lastInteractionAt: f.now})).reason, 'waiting_for_quiet');
  assert.equal((await f.core.solitude({mode: 'companion'})).reason, 'waiting_for_quiet');
  assert.equal(f.calls, 0);
});

test('expired opportunities are skipped once, without replaying missed solitude', async t => {
  const f = fixture(t); f.due(); f.advance(30);
  assert.equal((await f.core.solitude(f.context())).reason, 'opportunity_expired');
  assert.equal((await f.core.solitude(f.context())).reason, 'not_due');
  assert.equal(f.calls, 0);
});

test('the first memory is sampled rather than always selecting highest importance', t => {
  const f = fixture(t), s = f.core.store.read();
  s.episodes[0].importance = 0.4; s.episodes[2].importance = 1;
  const first = wanderMemories(s.episodes, f.core.config, f.now, () => 0)[0];
  const other = wanderMemories(s.episodes, f.core.config, f.now, () => 0.999)[0];
  assert.equal(first.id, 'rain-umbrella'); assert.equal(other.id, 'paper-whale');
});

test('an unrelated user question is never placed into solitude input; leaving writes nothing', async t => {
  const f = fixture(t); f.due();
  const result = await f.core.solitude({...f.context(), cue: 'MUST_SOLVE_THIS_COMPILER_TASK'});
  assert.equal(result.reason, 'left_quietly'); assert.equal(result.intentId, null);
  assert.equal(f.core.status().privateThoughts, 0);
  assert.ok(!JSON.stringify(f.inputs).includes('MUST_SOLVE'));
  assert.ok(!Object.hasOwn(f.inputs[0], 'mayExpress'));
  assert.equal(f.calls, 1);
});

test('following a memory can lead to another one; no conclusion request is added', async t => {
  const f = fixture(t, {config: {memoriesPerStep: 1}, handler: (req, count) => count === 1
    ? {value: {action: 'follow', memoryId: req.input.memories[0].id, anchor: req.input.memories[0].gist}}
    : {value: {action: 'leave'}}});
  f.due(); const result = await f.core.solitude(f.context());
  assert.equal(result.reason, 'left_quietly'); assert.equal(f.calls, 2);
  assert.notEqual(f.inputs[0].memories[0].id, f.inputs[1].memories[0].id);
  assert.equal(f.core.status().privateThoughts, 0);
});

test('lingering strengthens the selected memory at most once in a solitude session', async t => {
  const f = fixture(t, {handler: req => ({value: {action: 'linger', memoryId: req.input.memories[0].id,
    anchor: req.input.memories[0].gist, thought: 'A private, tentative association.'}})});
  f.due(); const result = await f.core.solitude(f.context());
  assert.equal(result.reason, 'step_limit'); assert.equal(f.calls, 2);
  assert.equal(f.core.store.read().episodes.find(e => e.id === result.visited[0]).recallCount, 1);
  assert.equal(result.intentId, null);
});

test('faded memories keep their hidden original detail out of wandering input', async t => {
  const f = fixture(t, {initialAge: 30 * 24 * HOUR}); f.due();
  await f.core.solitude(f.context());
  assert.equal(f.inputs[0].memories[0].detail, 'impression');
  assert.ok(!JSON.stringify(f.inputs).includes('Original detail'));
});

test('daily calls are shared with cue reflections and can shorten solitude to one step', async t => {
  const f = fixture(t, {config: {dailyModelCalls: 1}, handler: () => ({value: {action: 'switch'}})});
  f.due(); const result = await f.core.solitude(f.context());
  assert.equal(result.reason, 'model_budget'); assert.equal(result.modelCalls, 1);
  assert.equal(f.core.status().modelCallsToday, 1);
});

test('a later task signal interrupts a running solitude and discards late contact intent', async t => {
  let began, finish;
  const started = new Promise(r => {began = r;});
  const f = fixture(t, {handler: req => {began(); return new Promise(r => {finish = () => r(share(req));});}});
  f.due(); const running = f.core.solitude(f.context()); await started;
  assert.equal((await f.core.solitude({mode: 'task'})).reason, 'task_mode');
  const result = await running; finish(); await Promise.resolve();
  assert.equal(result.reason, 'interrupted'); assert.equal(result.intentId, null);
  assert.equal(f.core.status().solitude.active, false);
  assert.equal(f.core.status().modelCallsToday, 1);
});

test('model failures end the session and do not immediately retry', async t => {
  const f = fixture(t, {handler: () => {throw new Error('provider error');}}); f.due();
  assert.equal((await f.core.solitude(f.context())).reason, 'thinking_failed');
  assert.equal((await f.core.solitude(f.context())).reason, 'not_due');
  assert.equal(f.calls, 1);
});

test('a sharing wish appears only after solitude ends and does not consume contact quota', async t => {
  const f = fixture(t, {handler: req => {
    assert.equal(f.core.status().solitude.active, true);
    assert.equal(f.core.status().solitude.pending.length, 0);
    return share(req);
  }});
  f.due(); const result = await f.core.solitude({...f.context(), allowExpression: false});
  assert.equal(result.reason, 'wants_contact'); assert.ok(result.intentId);
  assert.equal(f.core.status().solitude.active, false);
  assert.equal(f.core.status().solitude.lastContactAt, null);
  assert.equal(f.core.takeExpression(result.intentId, {...f.context(), userAwaitingReply: true}), null);
  const taken = f.core.takeExpression(result.intentId, f.context());
  assert.equal(taken.sent, false); assert.equal(taken.status, 'taken');
  assert.equal(f.core.status().solitude.lastContactAt, null);
  assert.throws(() => f.core.settleExpression(result.intentId, {outcome: 'sent'}), /receipt/);
  f.core.settleExpression(result.intentId, {outcome: 'sent', receipt: 'real-transport-receipt'});
  assert.equal(f.core.status().solitude.lastContactAt, f.now);
});

test('unanswered contact cooldown can wait without spending another model call', async t => {
  const f = fixture(t, {config: {solitudeIntervalHours: [48, 48]}, handler: (req, count) => share(req, count === 1 ? 0 : 1)});
  f.due(); const first = await f.core.solitude(f.context());
  f.core.takeExpression(first.intentId, f.context());
  f.core.settleExpression(first.intentId, {outcome: 'sent', receipt: 'first-receipt'});
  const sentAt = f.now;
  f.due(); const second = await f.core.solitude(f.context());
  assert.equal(f.core.takeExpression(second.intentId, f.context()), null);
  assert.equal(f.calls, 2);
  assert.ok(f.core.takeExpression(second.intentId, {...f.context(), lastUserReplyAt: sentAt + 60000}));
});

test('pending intent can expire quietly or be used once inside a normal reply', async t => {
  const f = fixture(t, {handler: req => share(req)}); f.due();
  const first = await f.core.solitude(f.context()); f.advance(25);
  assert.equal(f.core.takeExpression(first.intentId, f.context()), null);
  assert.equal(f.core.status().solitude.lastContactAt, null);
  f.due(); const second = await f.core.solitude(f.context());
  const candidate = f.core.takeExpression(second.intentId, {...f.context(), userAwaitingReply: true,
    delivery: 'reply', replyToMessageId: 'current-owner-message'});
  assert.ok(candidate);
  f.core.settleExpression(second.intentId, {outcome: 'used_in_reply', receipt: 'normal-reply-receipt'});
  assert.equal(f.core.takeExpression(second.intentId, f.context()), null);
});

test('uncertain delivery is not replayed and can be reconciled explicitly', async t => {
  const f = fixture(t, {handler: req => share(req)}); f.due(); const result = await f.core.solitude(f.context());
  f.core.takeExpression(result.intentId, f.context());
  f.core.settleExpression(result.intentId, {outcome: 'unknown'});
  assert.equal(f.core.takeExpression(result.intentId, f.context()), null);
  assert.equal(f.core.status().solitude.lastContactAt, null);
  f.core.settleExpression(result.intentId, {outcome: 'not_sent'});
  assert.equal(f.core.status().solitude.lastContactAt, null);
});

test('source withdrawal invalidates a pending contact and prevents memory growth from thoughts', async t => {
  const f = fixture(t, {handler: req => share(req)}); f.due(); const result = await f.core.solitude(f.context());
  const record = f.core.store.read().expressions.find(p => p.id === result.intentId);
  f.core.forget(record.memoryId);
  assert.equal(f.core.takeExpression(result.intentId, f.context()), null);
  assert.equal(f.core.status().solitude.reason, 'time');
});

test('restart turns an abandoned solitude into an ended session instead of replaying it', async t => {
  const f = fixture(t, {disk: true});
  f.core.store.transaction(s => {s.inflight = {id: 'abandoned', opportunityId: s.solitude.plan.id,
    kind: 'solitude', epoch: s.epoch, pid: process.pid, started: f.now - HOUR};});
  const previous = f.core.status().solitude.nextAt;
  f.advance(1); await f.core.close(); f.reopen();
  assert.equal(f.core.status().solitude.active, false);
  assert.ok(f.core.status().solitude.nextAt > previous);
  assert.equal((await f.core.solitude(f.context())).reason, 'not_due');
});
