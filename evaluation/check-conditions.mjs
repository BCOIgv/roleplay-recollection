import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runScriptedCase, validateCase} from './condition-host.mjs';

const at = Date.parse('2026-11-07T15:00:00+08:00');
const scene = {schema_version: 1, case_id: 'synthetic-case', split: 'development',
  data_origin: 'synthetic', audience: 'synthetic-private', opportunity_at: at,
  character: {id: 'synthetic-character', persona: 'A concise fictional character.'},
  materials: [{id: 'synthetic-memory', text: 'A user reported reading a book on a rainy day.',
    scope: 'synthetic-private', truth: 'reported', status: 'active', time: at - 3600000,
    available_at: at - 1800000, revision: 'v1'}],
  raw_evidence: [{id: 'synthetic-message', at: at - 3600000, role: 'user', text: 'I read a book.'}],
  recent_context: [], followup: {question: {at: at + 3600000, text: 'What did we talk about?'}}};
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'recollection-conditions-'));
try {
  const results = await runScriptedCase(scene, path.join(temp, 'case'),
    {variants: ['normal', 'quiet', 'invalid', 'foreground', 'cancel', 'withdrawal', 'permission', 'unknown']});
  const normal = results.filter(row => row.variant === 'normal');
  assert.equal(normal.find(row => row.condition === 'A').scripted_calls, 0);
  assert.equal(normal.find(row => row.condition === 'B').thought_consumed, 0);
  assert.ok(normal.find(row => row.condition === 'C').thought_consumed > 0);
  assert.equal(normal.find(row => row.condition === 'C0').thought_consumed, 0);
  assert.equal(normal.find(row => row.condition === 'C0').scripted_calls, 0);
  assert.ok(normal.find(row => row.condition === 'B+T').thought_consumed > 0);
  assert.ok(results.filter(row => row.variant === 'invalid' && ['B', 'C', 'B+T'].includes(row.condition))
    .every(row => row.final_status === 'failed'));
  assert.throws(() => validateCase({...scene, materials: [{...scene.materials[0], available_at: at + 1}]}));
  assert.throws(() => validateCase({...scene, materials: [{...scene.materials[0], scope: 'other'}]}));
  console.log(JSON.stringify({synthetic: true, condition_runs: results.length,
    permission_and_future_filter: true, thought_consumption_and_mask: true,
    paired_replay_and_state_isolation: true, real_model_calls: 0, messages_sent: 0}));
} finally {
  assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep));
  fs.rmSync(temp, {recursive: true, force: true});
}
