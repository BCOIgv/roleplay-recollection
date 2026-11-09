import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {batchScenarios} from './batch-scenarios.mjs';
import {CONDITIONS, LLM_HOST_VERSION, runModelCondition} from './condition-host.mjs';

const reportDirectory = fileURLToPath(new URL('./reports/', import.meta.url));
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const redact = (value, secret) => secret ? String(value).split(secret).join('[REDACTED]') : String(value);

export function readLiveConfig(env = process.env) {
  const missing = ['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'EVAL_MODEL'].filter(key => !env[key]?.trim());
  if (missing.length) throw new Error('Missing environment variables: ' + missing.join(', '));
  const url = new URL(env.OPENAI_BASE_URL);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('OPENAI_BASE_URL must be an HTTP(S) URL without credentials, query or fragment');
  }
  const base = url.pathname.replace(/\/+$/, '');
  url.pathname = base.endsWith('/chat/completions') ? base : (base || '/v1') + '/chat/completions';
  return {apiKey: env.OPENAI_API_KEY, endpoint: url.toString(), model: env.EVAL_MODEL.trim(), timeoutMs: 90000};
}

export function createOpenAIClient(config, {fetchImpl = globalThis.fetch} = {}) {
  return async ({messages, maxTokens, signal}) => {
    const started = performance.now();
    const timeout = AbortSignal.timeout(config.timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const response = await fetchImpl(config.endpoint, {
        method: 'POST', signal: combined,
        headers: {'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + config.apiKey},
        body: JSON.stringify({model: config.model, messages, max_tokens: maxTokens, stream: false}),
      });
      const body = await response.text();
      if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + body.slice(0, 1200));
      let data;
      try {data = JSON.parse(body);} catch {throw new Error('API response is not valid JSON');}
      const message = data.choices?.[0]?.message;
      const content = typeof message?.content === 'string' ? message.content
        : Array.isArray(message?.content) ? message.content.filter(p => p.type === 'text').map(p => p.text).join('') : null;
      if (typeof content !== 'string' || !content.trim()) throw new Error('API response has no assistant content');
      return {content, elapsed_ms: Math.round(performance.now() - started), usage: data.usage ?? null,
        response_id: data.id ?? null, resolved_model: data.model ?? null,
        finish_reason: data.choices[0].finish_reason ?? null};
    } catch (error) {
      throw new Error(redact(error?.message ?? error, config.apiKey));
    }
  };
}

export function parseDecision(content) {
  const clean = content.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1').trim();
  let value;
  try {value = JSON.parse(clean);} catch {throw new Error('Idle reply is not a JSON decision');}
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Idle reply must be a JSON object');
  return value;
}

function callTotals(calls) {
  const sum = field => calls.every(c => Number.isFinite(c.usage?.[field]))
    ? calls.reduce((n, c) => n + c.usage[field], 0) : null;
  return {calls: calls.length, prompt_tokens: sum('prompt_tokens'), completion_tokens: sum('completion_tokens'),
    total_tokens: sum('total_tokens'), api_elapsed_ms: calls.every(c => Number.isFinite(c.elapsed_ms))
      ? calls.reduce((n, c) => n + c.elapsed_ms, 0) : null};
}

export function summarizeCosts(report) {
  const actual = report.calls.filter(c => c.status !== 'planned');
  return {actual_batch: callTotals(actual), monetary_cost: null,
    accounting: 'Provider-reported usage; no price snapshot. C0 shared idle cost is attributed only, not billed twice.',
    conditions: report.results.map(row => {
      const own = actual.filter(c => row.call_ids.includes(c.id));
      const shared = row.shared_idle_from === 'C'
        ? actual.filter(c => c.case_id === row.case_id && c.condition === 'C' && c.phase === 'idle') : [];
      return {case_id: row.case_id, condition: row.condition, new_actual: callTotals(own),
        idle: callTotals(own.filter(c => c.phase === 'idle')), reply: callTotals(own.filter(c => c.phase === 'reply')),
        shared_idle_attributed: callTotals(shared), standalone_attributed: callTotals([...shared, ...own]),
        condition_wall_ms: row.elapsed_ms};
    })};
}

function previewDecision(condition, step, input) {
  const memory = input.memories[0];
  const anchor = memory.text.slice(0, 40);
  if (condition === 'C' && step === 1) return {action: 'linger', memoryId: memory.ref, anchor,
    thought: 'dry-run 脚本化暂定关联，不是事实或模型输出。'};
  return {action: 'express', memoryId: memory.ref, anchor,
    expression: 'dry-run 脚本化候选，不会发送。',
    ...(['C', 'B+T'].includes(condition) ? {thought: 'dry-run 脚本化暂定关联，不是事实或模型输出。'} : {})};
}

function fenced(value, language = 'json') {
  const body = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const longest = Math.max(2, ...(body.match(/`+/g) ?? []).map(s => s.length));
  const fence = '`'.repeat(longest + 1);
  return fence + language + '\n' + body + '\n' + fence;
}

export function renderReport(report) {
  const lines = ['# LLM offline batch report', '',
    fenced({mode: report.mode, host_version: report.host_version, model: report.model,
      scenarios: report.scenarios.length, conditions: report.results.length,
      external_model_calls: report.external_model_calls, failed_calls: report.failed_calls,
      failed_conditions: report.failed_conditions, tokens: report.tokens, messages_sent: 0}), '',
    report.mode === 'dry-run'
      ? 'Dry-run only. Prompts after the first C step use a scripted preview branch; live continuations depend on the model. No real reply or token usage was measured.'
      : 'Synthetic scenarios only. These are raw model outputs, not naturalness ratings or evidence of user demand.', '',
    '| Scenario | Condition | Idle status | Consumed thoughts | New API calls | Actual tokens | Reply |',
    '| --- | --- | --- | --- | --- | --- | --- |'];
  for (const row of report.results) {
    const reply = row.reply?.content?.replace(/\s+/g, ' ').replaceAll('|', '\\|') ?? (row.error || 'dry-run: no real output');
    const cost = report.costs?.conditions.find(c => c.case_id === row.case_id && c.condition === row.condition);
    lines.push(`| ${row.case_id} | ${row.condition} | ${row.outcome?.status ?? 'failed'} | ${row.consumed_thoughts ?? 0} | ${row.external_model_calls} | ${cost?.new_actual.total_tokens ?? 'unknown'} | ${reply} |`);
  }
  for (const row of report.results) {
    lines.push('', `## ${row.case_id} / ${row.condition}`, '', fenced(row));
    for (const call of report.calls.filter(c => row.call_ids.includes(c.id))) {
      lines.push('', `### ${call.phase} / step ${call.step}`, '', fenced(call));
    }
    if (row.shared_idle_from) {
      lines.push('', 'Paired C0 reuses the following C idle prompts and output; these are not new API calls.');
      for (const call of report.calls.filter(c => c.case_id === row.case_id && c.condition === 'C' && c.phase === 'idle')) lines.push('', fenced(call));
    }
  }
  return lines.join('\n') + '\n';
}

export async function runBatch({mode, env = process.env, fetchImpl = globalThis.fetch,
  outputDir = reportDirectory, scenarios = batchScenarios()} = {}) {
  if (!['dry-run', 'live'].includes(mode)) throw new Error('Choose --dry-run or --live');
  if (!Array.isArray(scenarios) || !scenarios.length) throw new Error('No scenarios');
  if (scenarios.some(s => s.data_origin !== 'synthetic')) throw new Error('This runner accepts synthetic scenarios only');
  const config = mode === 'live' ? readLiveConfig(env) : null;
  const client = config ? createOpenAIClient(config, {fetchImpl}) : null;
  const runId = mode + '-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
  const runDirectory = path.join(outputDir, 'runs', runId);
  fs.mkdirSync(runDirectory, {recursive: true});
  const report = {schema_version: 1, run_id: runId, mode, host_version: LLM_HOST_VERSION,
    model: config?.model ?? env.EVAL_MODEL ?? null, endpoint: config?.endpoint ?? null,
    scenarios: scenarios.map(s => ({case_id: s.case_id, origin: s.data_origin, audience: s.audience,
      mode: s.mode ?? 'companion', scene_hash: hash(s)})), scenario_snapshots: structuredClone(scenarios), calls: [], results: [],
    external_model_calls: 0, failed_calls: 0, failed_conditions: 0, tokens: null, messages_sent: 0};
  const persist = () => {
    report.costs = summarizeCosts(report);
    const json = redact(JSON.stringify(report, null, 2) + '\n', config?.apiKey);
    fs.writeFileSync(path.join(runDirectory, 'report.json'), json);
    fs.writeFileSync(path.join(outputDir, 'latest-report.json'), json);
    fs.writeFileSync(path.join(outputDir, 'latest-report.md'), redact(renderReport(report), config?.apiKey));
  };
  for (const scene of scenarios) {
    let paired = null;
    for (const condition of CONDITIONS) {
      const callIds = [];
      const started = performance.now();
      const invoke = async ({phase, step, messages, request}) => {
        const call = {id: 'call-' + (report.calls.length + 1), case_id: scene.case_id, condition,
          phase, step, model: report.model, max_tokens: request.maxTokens,
          messages: structuredClone(messages), prompt_hash: hash(messages), status: 'planned',
          content: null, usage: null, elapsed_ms: null};
        report.calls.push(call); callIds.push(call.id);
        if (mode === 'dry-run') return phase === 'idle'
          ? {value: previewDecision(condition, step, request.input)}
          : {content: null, elapsed_ms: null, usage: null, dry_run: true};
        report.external_model_calls++;
        const callStart = performance.now();
        try {
          Object.assign(call, await client({messages, maxTokens: request.maxTokens, signal: request.signal}), {status: 'ok'});
          return phase === 'idle' ? {value: parseDecision(call.content)}
            : {content: call.content, elapsed_ms: call.elapsed_ms, usage: call.usage};
        } catch (error) {
          call.status = 'failed'; call.error = redact(error.message, config.apiKey);
          call.elapsed_ms ??= Math.round(performance.now() - callStart);
          report.failed_calls++;
          throw new Error(call.error);
        }
      };
      try {
        const row = await runModelCondition(scene, condition,
          path.join(runDirectory, scene.case_id, condition.replace('+', '-plus-')), {invoke, replay: paired});
        if (condition === 'C') paired = row;
        const conditionCalls = report.calls.filter(c => callIds.includes(c.id));
        const failed = ['failed', 'interrupted'].includes(row.outcome.status) || conditionCalls.some(c => c.status === 'failed');
        if (failed) report.failed_conditions++;
        report.results.push({...row, call_ids: callIds, external_model_calls: mode === 'live' ? conditionCalls.length : 0,
          elapsed_ms: Math.round(performance.now() - started), failed});
      } catch (error) {
        report.failed_conditions++;
        report.results.push({case_id: scene.case_id, condition, call_ids: callIds,
          external_model_calls: mode === 'live' ? callIds.length : 0,
          elapsed_ms: Math.round(performance.now() - started), failed: true,
          error: redact(error.message, config?.apiKey), messages_sent: 0});
      }
      const measured = report.calls.filter(c => c.status !== 'planned');
      if (measured.length && measured.every(c => Number.isFinite(c.usage?.total_tokens))) {
        report.tokens = {total_tokens: measured.reduce((sum, c) => sum + c.usage.total_tokens, 0),
          prompt_tokens: measured.every(c => Number.isFinite(c.usage.prompt_tokens)) ? measured.reduce((s,c) => s+c.usage.prompt_tokens,0) : null,
          completion_tokens: measured.every(c => Number.isFinite(c.usage.completion_tokens)) ? measured.reduce((s,c) => s+c.usage.completion_tokens,0) : null};
      } else report.tokens = null;
      persist();
    }
  }
  return {report, reportFile: path.join(outputDir, 'latest-report.md'), runDirectory};
}

export async function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || !['--dry-run', '--live'].includes(args[0])) throw new Error('Usage: node evaluation/run-batch.mjs --dry-run|--live');
  const {report, reportFile} = await runBatch({mode: args[0].slice(2)});
  console.log(JSON.stringify({mode: report.mode, scenarios: report.scenarios.length,
    conditions: report.results.length, planned_calls: report.calls.length,
    external_model_calls: report.external_model_calls, failed_calls: report.failed_calls,
    failed_conditions: report.failed_conditions, tokens: report.tokens,
    report: path.relative(process.cwd(), reportFile)}));
  if (report.failed_conditions || report.failed_calls) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {console.error(redact(error.message, process.env.OPENAI_API_KEY)); process.exitCode = 1;});
}
