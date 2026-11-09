import assert from 'node:assert/strict';
import test from 'node:test';
import {auditReport} from '../evaluation/audit-results.mjs';

test('public audit rejects private inputs and publishes only aggregate fields', () => {
  const report = {mode: 'live', run_id: 'fixture', model: 'mock', host_version: 'fixture',
    scenarios: [{case_id: 'fixture', origin: 'synthetic', scene_hash: 'fixture'}],
    calls: [{id: '1', condition: 'C', phase: 'idle', status: 'ok', content: 'PRIVATE-CONTENT',
      messages: [], usage: {total_tokens: 7}},
      {id: '2', condition: 'C0', phase: 'reply', status: 'failed', usage: null, messages: []}],
    results: [], failed_conditions: 1, external_model_calls: 2, messages_sent: 0,
    endpoint: 'PRIVATE-ENDPOINT', tokens: null};
  const summary = auditReport(report, 'fixture-sha');
  assert.equal(summary.total_tokens, null);
  assert.equal(summary.known_tokens_lower_bound, 7);
  assert.equal(summary.calls_missing_usage, 1);
  assert.equal(summary.costs.find(c => c.condition === 'C0').standalone_attributed_tokens, null);
  assert.ok(!JSON.stringify(summary).includes('PRIVATE-'));
  report.scenarios[0].origin = 'private-backup';
  assert.throws(() => auditReport(report, 'fixture-sha'), /Only synthetic/);
});
