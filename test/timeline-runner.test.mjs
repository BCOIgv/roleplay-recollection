import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {timelineScenarios} from '../evaluation/timeline-scenarios.mjs';
import {
  CONDITIONS,
  validateTimeline,
  selectPassiveTopK,
  runScriptedTimeline,
  runModelTimelineCondition,
} from '../evaluation/timeline-host.mjs';
import {runTimelineBatch} from '../evaluation/run-timeline.mjs';

const makeTemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rp-timeline-eval-'));

test('timelineScenarios validate cleanly and enforce passive Top-K crowding in Timeline 1 Episode 3', () => {
  const timelines = timelineScenarios();
  assert.equal(timelines.length, 3);
  for (const tl of timelines) {
    validateTimeline(tl);
    assert.ok(tl.materials.length >= 26);
    assert.equal(tl.episodes.length, 3);
    for (const ep of tl.episodes) {
      assert.equal(ep.dialogue_turns.length, 3);
    }
  }
  const tl1 = timelines[0];
  for (const ep of tl1.episodes) {
    for (const turn of ep.dialogue_turns) {
      const visibleAtTurn = tl1.materials
        .filter(m => m.available_at <= turn.user_message.at)
        .map(m => ({...m, ref: m.id, originalId: m.id, eventAt: m.time}));
      const top5 = selectPassiveTopK(visibleAtTurn, turn.user_message.text, {
        topK: 5,
        now: turn.user_message.at,
      });
      assert.equal(top5.length, 5);
      assert.ok(
        !top5.some(m => m.originalId === 'tl1-mem-deep-osmanthus-tea'),
        `Expected tl1-mem-deep-osmanthus-tea to be crowded out of Passive Top-5 in ${ep.episode_id} turn ${turn.turn_index}`,
      );
    }
  }
});

test('runScriptedTimeline isolates condition states, bridges Step 2 in C, and masks thoughts in C0', async () => {
  const root = makeTemp();
  try {
    const [tl1, tl2] = timelineScenarios();
    const res1 = await runScriptedTimeline(tl1, path.join(root, 'tl1'), {topK: 5});
    assert.equal(res1.length, CONDITIONS.length);
    const byCond1 = Object.fromEntries(res1.map(r => [r.condition, r]));

    // The fixture supplies two surface memories to B/B+T; C can reach the prescribed bridge.
    assert.equal(byCond1.A.idle_calls, 0);
    assert.equal(byCond1.B.episodes[2].idle_calls, 1);
    assert.equal(byCond1['B+T'].episodes[2].idle_calls, 1);
    assert.equal(byCond1.C.episodes[2].idle_calls, 2);
    assert.equal(byCond1.C0.idle_calls, 0);
    assert.equal(byCond1.C0.attributed_idle_calls, byCond1.C.idle_calls);

    // Verify C reached the bridge memory 'tl1-mem-deep-osmanthus-tea' in Episode 3 Step 2
    const cEp3Thoughts = byCond1.C.episodes[2].thoughts_after_idle;
    assert.ok(cEp3Thoughts.some(t => t.originalId === 'tl1-mem-deep-osmanthus-tea'));
    // Verify B+T could only form a thought on a surface memory, not the bridge memory
    const btEp3Thoughts = byCond1['B+T'].episodes[2].thoughts_after_idle;
    assert.ok(!btEp3Thoughts.some(t => t.originalId === 'tl1-mem-deep-osmanthus-tea'));
    // Verify C0 masks all thoughts during reply turns
    for (const ep of byCond1.C0.episodes) {
      for (const turn of ep.turns) {
        assert.equal(turn.consumed_thoughts_count, 0);
      }
    }

    // In Timeline 2 Episode 2 (only 2h after Episode 1), C skips via not_due (0 calls), while B and B+T fire again
    const res2 = await runScriptedTimeline(tl2, path.join(root, 'tl2'), {topK: 5});
    const byCond2 = Object.fromEntries(res2.map(r => [r.condition, r]));
    assert.equal(byCond2.C.episodes[1].idle_outcome.status, 'skipped');
    assert.equal(byCond2.C.episodes[1].idle_outcome.reason, 'not_due');
    assert.equal(byCond2.C.episodes[1].idle_calls, 0);
    assert.equal(byCond2.B.episodes[1].idle_calls, 1);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('live transport logs its actual output limit, input snapshot, hashes and exact request count', async () => {
  const root = makeTemp();
  const bodies = [];
  try {
    const {report} = await runTimelineBatch({mode: 'live', outputDir: root,
      timelines: [timelineScenarios()[0]],
      env: {OPENAI_API_KEY: 'test-secret', OPENAI_BASE_URL: 'https://invalid.example/v1', EVAL_MODEL: 'mock'},
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body);
        bodies.push(body);
        const input = JSON.parse(body.messages[1].content);
        return new Response(JSON.stringify({model: 'mock', choices: [{finish_reason: 'stop', message: {
          content: input.current_user_message ? '脚本回复。' : '{"action":"silence"}',
        }}], usage: {prompt_tokens: 10, completion_tokens: 2, total_tokens: 12}}));
      }});
    assert.equal(report.failed_conditions, 0);
    assert.equal(report.external_model_calls, bodies.length);
    assert.equal(report.calls.length, bodies.length);
    assert.ok(bodies.every(b => b.max_tokens === 2000));
    assert.ok(report.calls.every(c => c.max_tokens === 2000 && c.requested_max_tokens === 500));
    assert.equal(report.tokens.total_tokens, bodies.length * 12);
    assert.equal(report.transport.automatic_retries, 0);
    assert.equal(report.timeline_snapshots.length, 1);
    assert.match(report.implementation_hashes['./timeline-host.mjs'], /^[a-f0-9]{64}$/);
    assert.ok(!fs.readFileSync(path.join(root, 'latest-timeline-report.json'), 'utf8').includes('test-secret'));
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

test('transient provider errors stay recorded with unknown usage and are not silently retried', async () => {
  const root = makeTemp();
  let requests = 0;
  try {
    const {report} = await runTimelineBatch({mode: 'live', outputDir: root,
      timelines: [timelineScenarios()[0]],
      env: {OPENAI_API_KEY: 'test-secret', OPENAI_BASE_URL: 'https://invalid.example/v1', EVAL_MODEL: 'mock'},
      fetchImpl: async () => {requests++; return new Response('unavailable', {status: 503});}});
    assert.equal(requests, report.calls.length);
    assert.equal(requests, report.external_model_calls);
    assert.equal(requests, report.failed_calls);
    assert.equal(report.tokens, null);
    assert.ok(report.calls.every(c => c.status === 'failed' && c.usage === null));
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

test('a thought rejected by the runtime cannot enter the timeline reply ledger', async () => {
  const root = makeTemp();
  try {
    const row = await runModelTimelineCondition(timelineScenarios()[0], 'C', path.join(root, 'C'), {
      invoke: async ({phase, request, messages}) => {
        if (phase === 'idle') return {value: {action: 'keep', memoryId: request.input.memories[0].ref,
          anchor: 'THIS ANCHOR DOES NOT EXIST', thought: 'Rejected thought'}};
        assert.equal(JSON.parse(messages[1].content).tentative_thoughts.length, 0);
        return {content: '脚本回复。'};
      },
    });
    assert.ok(row.episodes.every(e => e.idle_outcome.status === 'failed'));
    assert.ok(row.episodes.every(e => e.thoughts_after_idle.length === 0));
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

test('runTimelineBatch --dry-run generates reports with zero external network calls and rejects non-synthetic data', async () => {
  const root = makeTemp();
  try {
    let fetchCalled = false;
    const {report, reportFile} = await runTimelineBatch({
      mode: 'dry-run',
      outputDir: root,
      fetchImpl: async () => {
        fetchCalled = true;
        throw new Error('fetch should not be called in dry-run');
      },
    });
    assert.equal(fetchCalled, false);
    assert.equal(report.external_model_calls, 0);
    assert.equal(report.failed_calls, 0);
    assert.equal(report.failed_conditions, 0);
    assert.equal(report.results.length, 15);
    assert.ok(fs.existsSync(reportFile));
    assert.ok(fs.existsSync(path.join(root, 'latest-timeline-report.json')));

    const realClone = structuredClone(timelineScenarios()[0]);
    realClone.data_origin = 'real-backup';
    await assert.rejects(
      () => runTimelineBatch({mode: 'dry-run', outputDir: root, timelines: [realClone]}),
      /synthetic timelines only/,
    );
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});
