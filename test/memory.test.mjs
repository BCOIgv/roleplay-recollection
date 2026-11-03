import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {CompanionMemory} from '../index.mjs';
import {DAY} from '../src/policy.mjs';

const START = Date.parse('2026-11-02T15:00:00+08:00');
function setup(t, {config = {}, reflect, random = () => 0, disk = false} = {}) {
  let now = START, calls = 0, action = 'express';
  const snapshots = [];
  let base;
  if (disk) {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'roleplay-recollection-test-'));
    t.after(() => {
      assert.equal(path.dirname(base), fs.realpathSync(os.tmpdir()));
      assert.ok(path.basename(base).startsWith('roleplay-recollection-test-'));
      fs.rmSync(base, {recursive: true, force: true});
    });
  }
  const cfg = {characterId: 'little-whale', scopeId: 'private:owner', mode: 'companion',
    recallIntervalHours: 1, expressionIntervalHours: 1,
    ...(base ? {stateDir: base} : {}), ...config};
  const reflector = reflect === null ? null : async req => {
    calls++; snapshots.push(structuredClone(req.input));
    if (reflect) return reflect(req);
    const m = req.input.memories[0];
    return {value: {action, memoryId: m.id, anchor: m.gist,
      thought: 'That small moment still has a warm place in this character story.',
      expression: 'The old paper whale came to mind.'}};
  };
  const dependencies = {reflect: reflector, now: () => now, random};
  const core = new CompanionMemory(cfg, dependencies);
  t.after(() => core.close());
  const event = (overrides = {}) => ({id: 'paper-whale', truth: 'observed', occurredAt: now,
    gist: 'We folded a paper whale together.', tags: ['whale', 'paper', 'quiet'],
    importance: 0.7, emotionalWeight: 0.3,
    evidence: [{id: 'chat-17', kind: 'shared_event', text: 'We made a blue paper whale on the desk.'}], ...overrides});
  const context = (overrides = {}) => ({mode: cfg.mode, ...(cfg.storyId ? {storyId: cfg.storyId} : {}),
    trigger: 'cue', cue: 'paper whale', opportunityId: 'turn-1', allowExpression: true, ...overrides});
  return {core, event, context, cfg, dependencies, snapshots,
    capture: overrides => core.capture(event(overrides), {mode: cfg.mode, ...(cfg.storyId ? {storyId: cfg.storyId} : {})}),
    advance: days => { now += days * DAY; }, action: next => { action = next; },
    calls: () => calls, now: () => now, base};
}

test('task mode never captures, recalls, injects thoughts or invokes the model', async t => {
  const f = setup(t); f.capture();
  assert.deepEqual(f.core.capture(null, {mode: 'task'}), {stored: false, reason: 'task_mode'});
  assert.equal((await f.core.recollect({mode: 'task'})).reason, 'task_mode');
  assert.deepEqual(f.core.visible({mode: 'task'}), []);
  assert.deepEqual(f.core.privateThoughts({mode: 'task'}), []);
  assert.equal(f.calls(), 0);
  assert.equal(f.core.status().episodes, 1);
  assert.equal(f.core.status().lastRecallOpportunityAt, null);
});

test('trivial events are left out and duplicated experiences are not strengthened', t => {
  const f = setup(t);
  assert.equal(f.capture({importance: 0.01, emotionalWeight: 0.01}).reason, 'low_salience');
  const first = f.capture();
  const before = f.core.visible(f.context())[0].activation;
  assert.equal(f.capture().duplicate, true);
  assert.equal(f.core.visible(f.context())[0].activation, before);
  assert.equal(first.stored, true);
});

test('no association and active conversation cost no extra model calls', async t => {
  const f = setup(t); f.capture();
  assert.equal((await f.core.recollect(f.context({cue: 'compiler regression'}))).reason, 'no_association');
  assert.equal((await f.core.recollect(f.context({userAwaitingReply: true}))).reason, 'conversation_has_priority');
  assert.equal((await f.core.recollect(f.context({busy: true}))).reason, 'conversation_has_priority');
  assert.equal(f.calls(), 0);
});

test('ordinary companion replies can look up a memory without starting a background reflection', async t => {
  const f = setup(t); f.capture();
  const context = f.context({userAwaitingReply: true});
  assert.equal(f.core.visible(context)[0].id, 'paper-whale');
  assert.equal(f.calls(), 0);
  assert.equal(f.core.status().lastRecallOpportunityAt, null);
  assert.equal((await f.core.recollect(context)).reason, 'conversation_has_priority');
});

test('the same original evidence cannot become several episodes or undo a withdrawal under another ID', t => {
  const f = setup(t); f.capture();
  assert.equal(f.capture({id: 'same-whale-again'}).reason, 'same_source');
  assert.equal(f.core.status().episodes, 1);
  f.core.forget('paper-whale');
  assert.equal(f.capture({id: 'same-whale-third-time'}).reason, 'withdrawn_source');
  assert.equal(f.core.status().episodes, 0);
});

test('legacy idle entry delegates to a persisted solitude opportunity without immediate model work', async t => {
  const f = setup(t, {random: () => 0.9}); f.capture();
  assert.equal((await f.core.recollect(f.context({trigger: 'idle', cue: ''}))).reason, 'not_due');
  assert.equal((await f.core.recollect(f.context({trigger: 'idle', cue: ''}))).reason, 'not_due');
  assert.equal(f.calls(), 0);
  assert.equal(f.core.status().privateThoughts, 0);
});

test('cue recalls a recorded moment and expression is only a candidate', async t => {
  const f = setup(t); f.capture();
  const result = await f.core.recollect(f.context());
  assert.equal(result.status, 'expression_proposed');
  assert.equal(result.expression.truth, 'observed');
  assert.equal(result.sent, false);
  assert.equal(f.calls(), 1);
  assert.equal(f.core.status().episodes, 1);
  assert.equal(f.core.status().privateThoughts, 1);
  const consumed = f.core.takeExpression(result.expression.id, f.context());
  assert.equal(consumed.status, 'consumed'); assert.equal(consumed.sent, false);
  assert.equal(f.core.takeExpression(result.expression.id, f.context()), null);
});

test('the same cue selects different experiences from unrelated ordinary memories', t => {
  const f = setup(t); f.capture();
  f.capture({id: 'late-train', gist: 'We talked about waiting for a train.', tags: ['train', 'station'],
    evidence: [{id: 'chat-23', kind: 'shared_event', text: 'The timetable was confusing.'}]});
  assert.equal(f.core.visible(f.context({cue: 'train'}))[0].id, 'late-train');
  assert.equal(f.core.visible(f.context())[0].id, 'paper-whale');
});

test('Chinese topic cues associate with a matching episode', t => {
  const f = setup(t);
  f.capture({gist: '一起聊过雨天撑伞的小事', tags: ['雨天', '雨伞'],
    evidence: [{id: 'chat-9', kind: 'shared_event', text: '雨天那把伞总往旁边歪。'}]});
  assert.equal(f.core.visible(f.context({cue: '今天又是雨天'})).length, 1);
  assert.equal(f.core.visible(f.context({cue: '编译器升级'})).length, 0);
});

test('reported memories remain statements by the user rather than verified events', async t => {
  const f = setup(t);
  f.capture({truth: 'reported', gist: 'The user said they liked paper whales.',
    evidence: [{id: 'user-3', kind: 'user_message', text: 'I like paper whales.'}]});
  await f.core.recollect(f.context());
  assert.equal(f.snapshots[0].memories[0].truth, 'reported');
  assert.equal(f.core.status().episodes, 1);
});

test('story events stay in the exact roleplay story, including result consumption', async t => {
  const f = setup(t, {config: {mode: 'roleplay', storyId: 'sea-kingdom'}});
  f.capture({truth: 'fictional', storyId: 'sea-kingdom',
    evidence: [{id: 'scene-17', kind: 'story_event', text: 'We made a blue paper whale in the sea kingdom.'}]});
  assert.equal((await f.core.recollect(f.context({mode: 'companion', storyId: null}))).reason, 'different_context');
  assert.equal((await f.core.recollect(f.context({storyId: 'another-kingdom'}))).reason, 'different_context');
  const result = await f.core.recollect(f.context());
  assert.equal(result.expression.truth, 'fictional');
  assert.equal(f.core.takeExpression(result.expression.id, {mode: 'companion', allowExpression: true}), null);
  assert.ok(f.core.takeExpression(result.expression.id, f.context()));
  assert.equal(f.calls(), 1);
});

test('fictional experiences cannot be captured in a real companion context', t => {
  const f = setup(t);
  assert.throws(() => f.capture({truth: 'fictional'}), /contexts/);
  assert.throws(() => f.capture({occurredAt: f.now() + 10000}), /future/);
});

test('ordinary details fade to a gist and eventually leave day-to-day recall', t => {
  const f = setup(t); f.capture();
  assert.equal(f.core.visible(f.context())[0].detail, 'specific');
  f.advance(35);
  const impression = f.core.visible(f.context())[0];
  assert.equal(impression.detail, 'impression');
  assert.deepEqual(impression.evidence, []);
  assert.ok(!Object.hasOwn(impression, 'occurredAt'));
  f.advance(365);
  assert.deepEqual(f.core.visible(f.context()), []);
  assert.equal(f.core.status().dormant, 1);
});

test('reflection receives no hidden quote after details have faded', async t => {
  const f = setup(t); f.capture(); f.advance(35);
  await f.core.recollect(f.context());
  assert.equal(f.snapshots[0].memories[0].detail, 'impression');
  assert.ok(!JSON.stringify(f.snapshots[0]).includes('blue paper whale on the desk'));
  assert.deepEqual(f.snapshots[0].memories[0].evidence, []);
});

test('old private thoughts cannot bypass fading and reconstruct hidden details', async t => {
  const f = setup(t); f.capture(); f.action('keep');
  await f.core.recollect(f.context());
  assert.equal(f.core.privateThoughts(f.context()).length, 1);
  assert.equal(f.core.privateThoughts(f.context())[0].usableAsEvidence, false);
  f.advance(35);
  assert.equal(f.core.privateThoughts(f.context()).length, 0);
});

test('only explicit retention keeps an important event detailed for long periods', t => {
  const f = setup(t);
  assert.throws(() => f.capture({retention: 'explicitly_retained'}), /retention reason/);
  f.capture({retention: 'explicitly_retained', retentionReason: 'The owner explicitly asked to keep this shared milestone.'});
  f.advance(365);
  assert.equal(f.core.visible(f.context())[0].detail, 'specific');
});

test('recollection alone produces no fact, source episode, trait or private thought', async t => {
  const f = setup(t, {reflect: null}); f.capture();
  const result = await f.core.recollect(f.context());
  assert.equal(result.status, 'recalled'); assert.equal(result.modelCalls, 0);
  assert.equal(f.core.status().episodes, 1); assert.equal(f.core.status().privateThoughts, 0);
  assert.equal(f.core.status().pendingExpressions, 0);
});

test('private reflection cannot be reingested as an original experience', t => {
  const f = setup(t);
  assert.throws(() => f.capture({evidence: [{id: 'thought-1', kind: 'private_thought', text: 'An inference.'}]}), /not source experiences/);
  assert.throws(() => f.capture({evidence: [{id: 'reply-1', kind: 'model_output', text: 'A generated recollection.'}]}), /not source experiences/);
});

test('silence is a complete outcome with no private note or expression', async t => {
  const f = setup(t); f.capture(); f.action('silence');
  const result = await f.core.recollect(f.context());
  assert.equal(result.status, 'silence'); assert.equal(result.expression, null);
  assert.equal(f.core.status().privateThoughts, 0); assert.equal(f.core.status().episodes, 1);
});

test('private moments allow tentative thoughts without proposing messages', async t => {
  const f = setup(t); f.capture();
  const result = await f.core.recollect(f.context({allowExpression: false}));
  assert.equal(result.status, 'kept'); assert.equal(result.expressionSuppressed, 'private_moment');
  assert.equal(result.expression, null); assert.equal(f.core.status().pendingExpressions, 0);
  assert.equal(f.core.status().privateThoughts, 1);
});

test('repeated memories cannot create a new opener on every opportunity', async t => {
  const f = setup(t); f.capture();
  assert.equal((await f.core.recollect(f.context())).status, 'expression_proposed');
  f.advance(2);
  const repeated = await f.core.recollect(f.context({opportunityId: 'later-cue'}));
  assert.equal(repeated.expressionSuppressed, 'already_brought_up');
  assert.equal(repeated.expression, null);
});

test('same opportunity and cooldown suppress extra model work', async t => {
  const f = setup(t); f.capture(); await f.core.recollect(f.context());
  assert.equal((await f.core.recollect(f.context())).reason, 'duplicate_opportunity');
  assert.equal((await f.core.recollect(f.context({opportunityId: 'turn-2'}))).reason, 'recall_cooldown');
  assert.equal(f.calls(), 1);
});

test('daily attempt budget includes provider failures and manual repeated opportunities', async t => {
  const f = setup(t, {config: {dailyModelCalls: 1}, reflect: async () => { throw new Error('Provider unavailable'); }});
  f.capture(); assert.equal((await f.core.recollect(f.context())).status, 'failed');
  f.advance(0.1);
  assert.equal((await f.core.recollect(f.context({opportunityId: 'retry'}))).reason, 'model_budget');
  assert.equal(f.calls(), 1);
  f.advance(1);
  assert.equal((await f.core.recollect(f.context({opportunityId: 'next-day'}))).status, 'failed');
  assert.equal(f.calls(), 2);
});

test('invented memory references and invisible anchors cannot produce thoughts', async t => {
  for (const errorType of ['id', 'anchor']) {
    const f = setup(t, {reflect: async req => ({value: {action: 'keep',
      memoryId: errorType === 'id' ? 'invented' : req.input.memories[0].id,
      anchor: errorType === 'anchor' ? 'A secret not provided' : req.input.memories[0].gist, thought: 'A thought'}})});
    f.capture(); assert.equal((await f.core.recollect(f.context())).status, 'failed');
    assert.equal(f.core.status().privateThoughts, 0);
  }
});

test('a reflector cannot modify its input to manufacture its own evidence anchor', async t => {
  const f = setup(t, {reflect: async req => {
    req.input.memories[0].gist = 'Manufactured memory';
    return {value: {action: 'keep', memoryId: req.input.memories[0].id,
      anchor: 'Manufactured memory', thought: 'A thought without a real source'}};
  }});
  f.capture();
  assert.equal((await f.core.recollect(f.context())).status, 'failed');
  assert.equal(f.core.status().privateThoughts, 0);
  assert.equal(f.core.visible(f.context())[0].gist, 'We folded a paper whale together.');
});

test('pause rejects late model results and counts the attempted request', async t => {
  let start, end;
  const began = new Promise(resolve => { start = resolve; });
  const f = setup(t, {reflect: async req => {
    start(); return new Promise(resolve => { end = () => resolve({value: {action: 'express',
      memoryId: req.input.memories[0].id, anchor: req.input.memories[0].gist, thought: 'Late', expression: 'Late'}}); });
  }});
  f.capture(); const running = f.core.recollect(f.context()); await began;
  f.core.pause(); assert.equal((await running).status, 'interrupted'); end(); await Promise.resolve();
  assert.equal(f.core.status().privateThoughts, 0); assert.equal(f.core.status().modelCallsToday, 1);
  assert.deepEqual(f.core.visible(f.context()), []);
});

test('forgetting during reflection removes all derived content and blocks late output', async t => {
  let start;
  const began = new Promise(resolve => { start = resolve; });
  const f = setup(t, {reflect: async () => { start(); return new Promise(() => {}); }});
  f.capture(); const running = f.core.recollect(f.context()); await began;
  assert.equal(f.core.forget('paper-whale').forgotten, true);
  assert.equal((await running).status, 'interrupted');
  assert.deepEqual(f.core.visible(f.context()), []);
  assert.equal(f.capture().reason, 'withdrawn_id');
  assert.ok(!JSON.stringify(f.core.store.read()).includes('blue paper whale on the desk'));
});

test('source correction invalidates pending expressions and old thoughts', async t => {
  const f = setup(t); const saved = f.capture();
  const proposal = await f.core.recollect(f.context());
  f.core.revise('paper-whale', saved.revision, f.event({gist: 'We talked about folding a whale, but did not make it.', truth: 'reported',
    evidence: [{id: 'correction', kind: 'user_message', text: 'We only talked about folding it.'}]}));
  assert.equal(f.core.takeExpression(proposal.expression.id, f.context()), null);
  assert.equal(f.core.privateThoughts(f.context()).length, 0);
  assert.equal(f.core.visible(f.context())[0].truth, 'reported');
});

test('unavailable original sources stop recall, even if the episode is retained', async t => {
  const f = setup(t); f.capture({retention: 'explicitly_retained', retentionReason: 'Keep it'});
  await f.core.recollect(f.context());
  f.core.setSourceAvailable('paper-whale', false);
  assert.deepEqual(f.core.visible(f.context()), []);
  assert.deepEqual(f.core.privateThoughts(f.context()), []);
  assert.equal(f.core.status().pendingExpressions, 0);
});

test('expressions are inaccessible in task mode and expire without being sent', async t => {
  const f = setup(t); f.capture(); const result = await f.core.recollect(f.context());
  assert.equal(f.core.takeExpression(result.expression.id, {mode: 'task'}), null);
  f.advance(2);
  assert.equal(f.core.takeExpression(result.expression.id, f.context()), null);
});

test('noncooperative reflection times out without blocking the core', async t => {
  const f = setup(t, {config: {modelTimeoutMs: 50}, reflect: async () => new Promise(() => {})});
  f.capture(); const result = await f.core.recollect(f.context());
  assert.equal(result.status, 'failed'); assert.equal(result.reason, 'Reflection timeout');
  assert.equal(f.core.status().modelCallsToday, 1); assert.equal(f.core.store.read().inflight, null);
});

test('closing cancels a pending reflection and does not start background timers', async t => {
  let start; const began = new Promise(resolve => { start = resolve; });
  const f = setup(t, {reflect: async () => { start(); return new Promise(() => {}); }});
  f.capture(); const pending = f.core.recollect(f.context()); await began;
  await f.core.close(); assert.equal((await pending).status, 'interrupted');
  assert.equal(f.core.status().privateThoughts, 0); assert.equal(f.core.status().closed, true);
});

test('normal restart preserves experiences, proposal cooldown and attempted-call budget', async t => {
  const f = setup(t, {disk: true}); f.capture(); await f.core.recollect(f.context()); await f.core.close();
  const again = new CompanionMemory(f.cfg, f.dependencies); t.after(() => again.close());
  assert.equal(again.status().modelCallsToday, 1); assert.equal(again.status().episodes, 1);
  assert.equal(again.status().privateThoughts, 1);
  assert.equal((await again.recollect(f.context({opportunityId: 'restarted'}))).reason, 'recall_cooldown');
});

test('persistent memory cannot be opened as another character, scope or story', t => {
  const f = setup(t, {disk: true}); f.capture();
  assert.throws(() => new CompanionMemory({...f.cfg, characterId: 'another-character'}, f.dependencies), /another character/);
  assert.throws(() => new CompanionMemory({...f.cfg, scopeId: 'group:other'}, f.dependencies), /another character/);
  assert.throws(() => new CompanionMemory({...f.cfg, mode: 'roleplay', storyId: 'elsewhere'}, f.dependencies), /another character/);
});

test('no source directories, DSH tools, downloader, scheduler or transport are needed', async t => {
  const f = setup(t, {reflect: null}); f.capture();
  const result = await f.core.recollect(f.context());
  assert.equal(result.status, 'recalled');
  for (const removed of ['start', 'catalog', 'readFile', 'offerShare', 'send', 'installTools']) assert.equal(f.core[removed], undefined);
});
