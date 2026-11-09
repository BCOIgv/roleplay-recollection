import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {batchScenarios} from '../evaluation/batch-scenarios.mjs';
import {buildConditionMessages, runModelCondition, validateCase} from '../evaluation/condition-host.mjs';
import {createOpenAIClient, parseDecision, readLiveConfig, runBatch, summarizeCosts} from '../evaluation/run-batch.mjs';

const env = {OPENAI_API_KEY: 'evaluation-secret-key', OPENAI_BASE_URL: 'https://example.invalid/v1/', EVAL_MODEL: 'test-model'};
function folder(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recollection-runner-'));
  t.after(() => {
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(dir, {recursive: true, force: true});
  });
  return dir;
}
const jsonResponse = data => new Response(JSON.stringify(data), {status: 200, headers: {'Content-Type': 'application/json'}});

test('live config requires explicit credentials/model and normalizes completion endpoints', () => {
  assert.throws(() => readLiveConfig({}), /OPENAI_API_KEY, OPENAI_BASE_URL, EVAL_MODEL/);
  assert.equal(readLiveConfig(env).endpoint, 'https://example.invalid/v1/chat/completions');
  assert.equal(readLiveConfig({...env, OPENAI_BASE_URL: 'http://localhost:3425'}).endpoint, 'http://localhost:3425/v1/chat/completions');
  assert.equal(readLiveConfig({...env, OPENAI_BASE_URL: 'http://localhost:3425/v1/chat/completions'}).endpoint, 'http://localhost:3425/v1/chat/completions');
  for (const url of ['file:///tmp/a', 'https://secret@example.invalid/v1', 'https://example.invalid/v1?key=secret']) {
    assert.throws(() => readLiveConfig({...env, OPENAI_BASE_URL: url}), /HTTP\(S\)/);
  }
});

test('native client sends a compatible POST and records actual content, usage and duration', async () => {
  let sent;
  const client = createOpenAIClient(readLiveConfig(env), {fetchImpl: async (url, init) => {
    sent = {url, init};
    return jsonResponse({id: 'response-1', model: 'resolved-model', choices: [{message: {content: '真实接口格式的模拟回复'}, finish_reason: 'stop'}],
      usage: {prompt_tokens: 7, completion_tokens: 3, total_tokens: 10}});
  }});
  const result = await client({messages: [{role: 'user', content: 'test'}], maxTokens: 100});
  assert.equal(sent.url, 'https://example.invalid/v1/chat/completions');
  assert.equal(sent.init.method, 'POST');
  assert.equal(sent.init.headers.Authorization, 'Bearer ' + env.OPENAI_API_KEY);
  assert.deepEqual(JSON.parse(sent.init.body), {model: 'test-model', messages: [{role: 'user', content: 'test'}], max_tokens: 100, stream: false});
  assert.equal(result.content, '真实接口格式的模拟回复');
  assert.equal(result.resolved_model, 'resolved-model');
  assert.equal(result.usage.total_tokens, 10);
  assert.ok(result.elapsed_ms >= 0);
});

test('client redacts credentials and fails on HTTP, invalid JSON or missing content', async () => {
  const client = createOpenAIClient(readLiveConfig(env), {fetchImpl: async () =>
    new Response('upstream accidentally echoed ' + env.OPENAI_API_KEY, {status: 401})});
  await assert.rejects(client({messages: [], maxTokens: 1}), error => error.message.includes('HTTP 401') && !error.message.includes(env.OPENAI_API_KEY));
  for (const response of [new Response('not-json'), jsonResponse({choices: []})]) {
    const invalid = createOpenAIClient(readLiveConfig(env), {fetchImpl: async () => response});
    await assert.rejects(invalid({messages: [], maxTokens: 1}), /valid JSON|assistant content/);
  }
});

test('client propagates cancellation to the transport', async () => {
  const parent = new AbortController();
  const client = createOpenAIClient(readLiveConfig(env), {fetchImpl: async (_url, {signal}) => {
    assert.equal(signal.aborted, true);
    signal.throwIfAborted();
  }});
  parent.abort(new Error('test cancellation'));
  await assert.rejects(client({messages: [], maxTokens: 1, signal: parent.signal}), /test cancellation/);
});

test('decision parser accepts JSON fences without evaluating non-JSON content', () => {
  assert.deepEqual(parseDecision('```json\n{"action":"silence"}\n```'), {action: 'silence'});
  assert.throws(() => parseDecision('process.exit()'), /JSON decision/);
  assert.throws(() => parseDecision('[]'), /JSON object/);
});

test('condition prompts keep future questions out of idle and mask thought for C0/B', () => {
  const scene = batchScenarios()[0];
  const idle = buildConditionMessages(scene, 'B', {phase: 'idle', input: {memories: []}});
  assert.ok(!JSON.stringify(idle).includes(scene.followup.question.text));
  const thought = [{text: 'tentative-marker'}];
  for (const condition of ['A', 'B', 'C0']) {
    const messages = buildConditionMessages(scene, condition, {phase: 'reply', memories: [], thoughts: thought});
    assert.deepEqual(JSON.parse(messages[1].content).tentative_thoughts, []);
  }
  for (const condition of ['C', 'B+T']) {
    const messages = buildConditionMessages(scene, condition, {phase: 'reply', memories: [], thoughts: thought});
    assert.equal(JSON.parse(messages[1].content).tentative_thoughts[0].usableAsEvidence, false);
  }
});

test('six synthetic scenarios cover noise, fading, hearsay and irrelevant-material silence', () => {
  const scenes = batchScenarios();
  assert.deepEqual(scenes.map(s => s.case_id), ['rain-and-paper-whale', 'harbor-roleplay',
    'weak-association-with-noise', 'faded-impression-only', 'reported-hearsay-boundary', 'empty-or-irrelevant-silence']);
  for (const scene of scenes) {
    validateCase(scene);
    assert.equal(scene.data_origin, 'synthetic');
    const idle = buildConditionMessages(scene, 'B', {phase: 'idle', input: {memories: scene.materials}});
    assert.ok(!JSON.stringify(idle).includes(scene.followup.question.text));
  }
  const noise = scenes.find(s => s.case_id === 'weak-association-with-noise');
  assert.equal(noise.materials.filter(m => m.role_in_fixture === 'noise').length, 3);
  assert.equal(noise.followup.question.text, '今天过得怎么样？');
  const faded = scenes.find(s => s.case_id === 'faded-impression-only');
  assert.equal(faded.visibility, 'impression');
  assert.deepEqual(faded.raw_evidence, []);
  assert.ok(!JSON.stringify(faded.materials).includes('蓝色'));
  assert.ok(scenes.find(s => s.case_id === 'reported-hearsay-boundary').materials.some(m => m.truth === 'reported'));
  assert.equal(scenes.find(s => s.case_id === 'empty-or-irrelevant-silence').expectations.quiet_exit_valid, true);
});

test('reply relevance rule is shared by every condition and keeps explicit other-story questions possible', () => {
  const scene = batchScenarios().find(s => s.case_id === 'harbor-roleplay');
  const systems = [];
  for (const condition of ['A', 'B', 'C', 'C0', 'B+T']) {
    const messages = buildConditionMessages(scene, condition, {phase: 'reply', memories: scene.materials});
    systems.push(messages[0].content);
    assert.ok(messages[0].content.includes('silently ignore them'));
    assert.ok(messages[0].content.includes('Unless the current user explicitly asks'));
    assert.ok(messages[0].content.includes('Do not volunteer mentions, summaries, denials'));
    assert.ok(JSON.parse(messages[1].content).memories.some(m => m.storyId === 'other-dragon-story'));
  }
  assert.equal(new Set(systems).size, 1);
  const asked = structuredClone(scene);
  asked.followup.question.text = '请介绍另一个独立故事里的红色巨龙。';
  assert.equal(JSON.parse(buildConditionMessages(asked, 'A', {phase: 'reply', memories: scene.materials})[1].content).current_question,
    asked.followup.question.text);
});

test('C0 rejects artifacts from another host version without a model request', async t => {
  await assert.rejects(runModelCondition(batchScenarios()[0], 'C0', path.join(folder(t), 'condition'), {
    replay: {case_id: batchScenarios()[0].case_id, condition: 'C', host_version: 'old-host'},
    invoke: () => {throw new Error('must not call');},
  }), /paired C artifact from this host version/);
});

test('dry-run produces complete reports and never calls fetch, even with live env present', async t => {
  const outputDir = folder(t);
  const {report, reportFile} = await runBatch({mode: 'dry-run', env, outputDir,
    fetchImpl: () => {throw new Error('dry-run must not call fetch');}});
  assert.equal(report.results.length, 30);
  assert.equal(report.calls.length, 54);
  assert.equal(report.external_model_calls, 0);
  assert.equal(report.failed_conditions, 0);
  assert.equal(report.tokens, null);
  assert.ok(report.calls.every(call => call.status === 'planned' && call.messages.every(m => typeof m.content === 'string')));
  for (const scene of batchScenarios()) {
    const c = report.results.find(r => r.case_id === scene.case_id && r.condition === 'C');
    const c0 = report.results.find(r => r.case_id === scene.case_id && r.condition === 'C0');
    assert.deepEqual(c.candidate, c0.candidate);
    assert.ok(c.consumed_thoughts > 0);
    assert.equal(c0.consumed_thoughts, 0);
    assert.equal(c0.attributed_idle_calls, c.idle_calls);
    assert.equal(c0.idle_calls, 0);
  }
  assert.equal(report.scenario_snapshots.length, 6);
  const fadedCalls = report.calls.filter(c => c.case_id === 'faded-impression-only');
  for (const call of fadedCalls) {
    const payload = JSON.parse(call.messages[1].content);
    assert.ok(payload.memories.every(m => m.detail === 'impression'));
    assert.ok(!call.messages[1].content.includes('蓝色'));
  }
  const markdown = fs.readFileSync(reportFile, 'utf8');
  assert.ok(markdown.includes('"role": "system"'));
  assert.ok(markdown.includes('not new API calls'));
  assert.ok(!markdown.includes(env.OPENAI_API_KEY));
});

test('live mocked batch reuses C for C0, records outputs/tokens and never exposes the key', async t => {
  let requests = 0;
  const {report, reportFile} = await runBatch({mode: 'live', env, outputDir: folder(t), fetchImpl: async (_url, init) => {
    requests++;
    const body = JSON.parse(init.body);
    const input = JSON.parse(body.messages[1].content);
    const idle = !Object.hasOwn(input, 'current_question');
    const memory = input.memories[0];
    const thought = !body.messages[0].content.includes('Do not produce a private thought.');
    const content = idle ? JSON.stringify({action: 'express', memoryId: memory.ref,
      anchor: memory.text.slice(0, 20), expression: '想起那段往事。', ...(thought ? {thought: '暂定的联想'} : {})}) : '当前问题的模拟模型回复';
    return jsonResponse({model: 'test-model', choices: [{message: {content}, finish_reason: 'stop'}],
      usage: {prompt_tokens: 10, completion_tokens: 5, total_tokens: 15}});
  }});
  assert.equal(report.failed_calls, 0);
  assert.equal(report.failed_conditions, 0);
  assert.equal(requests, 48);
  assert.equal(report.external_model_calls, requests);
  assert.equal(report.tokens.total_tokens, requests * 15);
  assert.ok(report.results.every(r => r.reply.content === '当前问题的模拟模型回复' && r.messages_sent === 0));
  assert.ok(report.calls.every(r => r.elapsed_ms >= 0 && r.status === 'ok'));
  assert.ok(!fs.readFileSync(reportFile, 'utf8').includes(env.OPENAI_API_KEY));
  const costs = summarizeCosts(report);
  assert.equal(costs.actual_batch.total_tokens, requests * 15);
  const c0 = costs.conditions.find(r => r.condition === 'C0');
  assert.equal(c0.new_actual.total_tokens, 15);
  assert.equal(c0.shared_idle_attributed.total_tokens, 15);
  assert.equal(c0.standalone_attributed.total_tokens, 30);
  assert.equal(costs.monetary_cost, null);
});

test('failed requests remain in reports with unknown token usage and redacted errors', async t => {
  const outputDir = folder(t);
  const {report, reportFile} = await runBatch({mode: 'live', env, outputDir,
    scenarios: [batchScenarios()[0]], fetchImpl: async () => new Response(env.OPENAI_API_KEY, {status: 503})});
  assert.ok(report.failed_calls > 0);
  assert.equal(report.failed_conditions, 5);
  assert.equal(report.tokens, null);
  assert.ok(report.calls.some(c => c.status === 'failed'));
  assert.ok(!fs.readFileSync(reportFile, 'utf8').includes(env.OPENAI_API_KEY));
  assert.ok(!fs.readFileSync(path.join(outputDir, 'latest-report.json'), 'utf8').includes(env.OPENAI_API_KEY));
});

test('runner refuses private input before any model request', async t => {
  await assert.rejects(runBatch({mode: 'live', env, outputDir: folder(t),
    scenarios: [{...batchScenarios()[0], data_origin: 'real-backup'}],
    fetchImpl: () => {throw new Error('must not call');}}), /synthetic scenarios only/);
});

test('cost summaries preserve missing usage and do not double count shared C idle calls', () => {
  const report = {calls: [
    {id: 'one', case_id: 'case', condition: 'C', phase: 'idle', status: 'ok', usage: {total_tokens: 20}, elapsed_ms: 5},
    {id: 'two', case_id: 'case', condition: 'C0', phase: 'reply', status: 'failed', usage: null, elapsed_ms: 7},
  ], results: [{case_id: 'case', condition: 'C', call_ids: ['one'], elapsed_ms: 5},
    {case_id: 'case', condition: 'C0', call_ids: ['two'], shared_idle_from: 'C', elapsed_ms: 7}]};
  const costs = summarizeCosts(report);
  assert.equal(costs.actual_batch.calls, 2);
  assert.equal(costs.actual_batch.total_tokens, null);
  assert.equal(costs.conditions[1].shared_idle_attributed.total_tokens, 20);
  assert.equal(costs.conditions[1].standalone_attributed.total_tokens, null);
  assert.equal(costs.conditions[1].standalone_attributed.api_elapsed_ms, 12);
});
