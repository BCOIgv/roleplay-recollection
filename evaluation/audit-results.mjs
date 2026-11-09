import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const conditions = ['A', 'B', 'C', 'C0', 'B+T'];
const sumUsage = calls => calls.every(c => Number.isFinite(c.usage?.total_tokens))
  ? calls.reduce((n, c) => n + c.usage.total_tokens, 0) : null;

// Explicit output whitelist: no prompts, responses, endpoint, credentials or audience map.
export function auditReport(report, sourceSha256) {
  const cases = report.timelines ?? report.scenarios;
  assert.equal(report.mode, 'live');
  assert.ok(Array.isArray(cases) && cases.length > 0 && cases.every(s => s.origin === 'synthetic'),
    'Only synthetic reports may be summarized for publication');
  const calls = report.calls.filter(c => c.status !== 'planned');
  assert.equal(new Set(calls.map(c => c.id)).size, calls.length, 'Duplicate call ID');
  const known = calls.filter(c => Number.isFinite(c.usage?.total_tokens));
  const total = sumUsage(calls);
  if (report.tokens?.total_tokens != null) assert.equal(total, report.tokens.total_tokens);
  const costs = conditions.map(condition => {
    const own = calls.filter(c => c.condition === condition);
    const shared = condition === 'C0' ? calls.filter(c => c.condition === 'C' && c.phase === 'idle') : [];
    return {condition, new_calls: own.length, reply_calls: own.filter(c => c.phase === 'reply').length,
      attributed_idle_calls: own.filter(c => c.phase === 'idle').length + shared.length,
      new_tokens: sumUsage(own), standalone_attributed_tokens: sumUsage([...own, ...shared])};
  });
  const cCost = costs.find(c => c.condition === 'C').standalone_attributed_tokens;
  const btCost = costs.find(c => c.condition === 'B+T').standalone_attributed_tokens;
  const replyCalls = calls.filter(c => c.phase === 'reply');
  const anchored = replyCalls.filter(c => {
    try { return JSON.parse(c.messages[1].content).tentative_thoughts?.some(t => t.anchoredMemoryText); }
    catch { return false; }
  });
  const deepId = 'tl1-mem-deep-osmanthus-tea';
  const deepEpisode = report.results.find(r => r.timeline_id === 'cross-epoch-emotional-bridge' && r.condition === 'C')?.episodes?.[2];
  return {
    run_id: report.run_id, report_sha256: sourceSha256, model: report.model,
    host_version_recorded: report.host_version,
    implementation_hashes_recorded: report.implementation_hashes ?? null,
    cases: cases.map(s => ({id: s.timeline_id ?? s.case_id, input_hash: s.timeline_hash ?? s.scene_hash})),
    expected_condition_runs: cases.length * conditions.length, recorded_condition_runs: report.results.length,
    recorded_calls: calls.length, external_calls_recorded: report.external_model_calls,
    failed_calls: calls.filter(c => c.status === 'failed').length,
    failed_conditions_recorded: report.failed_conditions,
    reply_calls: replyCalls.length, messages_sent_recorded: report.messages_sent,
    total_tokens: total, known_tokens_lower_bound: sumUsage(known), calls_missing_usage: calls.length - known.length,
    declared_max_tokens_values: [...new Set(calls.map(c => c.max_tokens))],
    actual_api_limit_recorded: report.transport?.max_output_tokens ?? null,
    automatic_retries_recorded: report.transport?.automatic_retries ?? null,
    truncated_calls: calls.filter(c => c.finish_reason === 'length').length,
    prompt_features: {reply_calls_with_anchored_memory_text: anchored.length},
    costs, c_over_bt_token_ratio: cCost != null && btCost > 0 ? Number((cCost / btCost).toFixed(4)) : null,
    timeline1_episode3: deepEpisode ? {
      c_stored_thought_for_deep_memory: deepEpisode.thoughts_after_idle.some(t => t.originalId === deepId),
      c_reply_turns: deepEpisode.turns.length,
      c_reply_turns_explicitly_naming_osmanthus_or_oolong: deepEpisode.turns.filter(t => /桂花|乌龙/.test(t.reply?.content ?? '')).length,
      interpretation: 'Keyword count only; neither a quality rating nor a causal attribution.',
    } : null,
  };
}

export function auditDirectory(inputDir) {
  return fs.readdirSync(inputDir).filter(name => /^(timeline-)?live-/.test(name)).sort().flatMap(name => {
    const file = path.join(inputDir, name, 'report.json');
    if (!fs.existsSync(file)) return [];
    const bytes = fs.readFileSync(file);
    return [auditReport(JSON.parse(bytes), sha(bytes))];
  });
}

export function main(args = process.argv.slice(2)) {
  if (args.length !== 4 || args[0] !== '--runs' || args[2] !== '--output') {
    throw new Error('Usage: node evaluation/audit-results.mjs --runs <run-directory> --output <summary.json>');
  }
  const runs = auditDirectory(args[1]);
  const output = {schema_version: 1, study_type: 'synthetic exploratory runs, unblinded, no user delivery', runs};
  fs.mkdirSync(path.dirname(args[3]), {recursive: true});
  fs.writeFileSync(args[3], JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify({reports: runs.length, output: args[3], external_model_calls: 0}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
