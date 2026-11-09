import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readLiveConfig, createOpenAIClient, parseDecision} from './run-batch.mjs';
import {timelineScenarios} from './timeline-scenarios.mjs';
import {CONDITIONS, TIMELINE_HOST_VERSION, runModelTimelineCondition} from './timeline-host.mjs';

const reportDirectory = fileURLToPath(new URL('./reports/', import.meta.url));
export const TIMELINE_RUNNER_VERSION = 'timeline-runner-v2';
// Experimental transport allowance, not a change to the runtime's DEFAULTS.
export const TIMELINE_API_MAX_TOKENS = 2000;
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const redact = (value, secret) => (secret ? String(value).split(secret).join('[REDACTED]') : String(value));

function callTotals(calls) {
  const sum = field =>
    calls.every(c => Number.isFinite(c.usage?.[field]))
      ? calls.reduce((n, c) => n + c.usage[field], 0)
      : null;
  return {
    calls: calls.length,
    prompt_tokens: sum('prompt_tokens'),
    completion_tokens: sum('completion_tokens'),
    total_tokens: sum('total_tokens'),
    api_elapsed_ms:
      calls.every(c => Number.isFinite(c.elapsed_ms))
        ? calls.reduce((n, c) => n + c.elapsed_ms, 0)
        : null,
  };
}

export function summarizeTimelineCosts(report) {
  const actual = report.calls.filter(c => c.status !== 'planned');
  return {
    actual_batch: callTotals(actual),
    monetary_cost: null,
    accounting:
      'Provider-reported usage across multi-episode timelines; C0 reuses paired C idle artifacts without duplicate API calls.',
    conditions: report.results.map(row => {
      const own = actual.filter(c => row.call_ids?.includes(c.id));
      const shared =
        row.shared_idle_from === 'C'
          ? actual.filter(c => c.timeline_id === row.timeline_id && c.condition === 'C' && c.phase === 'idle')
          : [];
      const ownIdle = own.filter(c => c.phase === 'idle');
      const ownReply = own.filter(c => c.phase === 'reply');
      const standalone = [...shared, ...own];
      const standaloneTotals = callTotals(standalone);
      const idleTotals = callTotals(row.shared_idle_from === 'C' ? shared : ownIdle);
      return {
        timeline_id: row.timeline_id,
        condition: row.condition,
        new_actual: callTotals(own),
        idle: callTotals(ownIdle),
        reply: callTotals(ownReply),
        shared_idle_attributed: callTotals(shared),
        standalone_attributed: standaloneTotals,
        idle_token_share:
          standaloneTotals.total_tokens && idleTotals.total_tokens !== null
            ? Number((idleTotals.total_tokens / standaloneTotals.total_tokens).toFixed(4))
            : 0,
        condition_wall_ms: row.elapsed_ms,
      };
    }),
  };
}

function previewTimelineDecision(condition, step, input) {
  const memories = input.memories;
  const selected = condition === 'C' && step > 1 ? memories[memories.length - 1] : memories[0];
  const anchor = selected.text.slice(0, 36);
  if (condition === 'C' && step === 1) {
    return {
      action: 'linger',
      memoryId: selected.ref,
      anchor,
      thought: 'dry-run 阶段1表层线索暂定联想，准备进入阶段2深层桥接。',
    };
  }
  return {
    action: 'express',
    memoryId: selected.ref,
    anchor,
    expression: 'dry-run 脚本化候选，不会外发。',
    ...(['C', 'B+T'].includes(condition)
      ? {thought: `dry-run 暂定关联(${selected.originalId ?? selected.ref.slice(0, 8)})，非事实依据。`}
      : {}),
  };
}

function fenced(value, language = 'json') {
  const body = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const longest = Math.max(2, ...(body.match(/`+/g) ?? []).map(s => s.length));
  const fence = '`'.repeat(longest + 1);
  return fence + language + '\n' + body + '\n' + fence;
}

export function renderTimelineReport(report) {
  const lines = [
    '# Long-Horizon Multi-Session Timeline Evaluation Report (Timeline-v2)',
    '',
    fenced({
      mode: report.mode,
      host_version: report.host_version,
      model: report.model,
      timelines: report.timelines.length,
      condition_runs: report.results.length,
      external_model_calls: report.external_model_calls,
      failed_calls: report.failed_calls,
      failed_conditions: report.failed_conditions,
      tokens: report.tokens,
      messages_sent: 0,
    }),
    '',
    '| Timeline | Condition | Idle Calls (Attr) | Reply Calls | New Tokens | Standalone Tokens | Idle Token Share | Ep1 Idle / Ep2 Idle / Ep3 Idle |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of report.results) {
    const cost = report.costs?.conditions.find(
      c => c.timeline_id === row.timeline_id && c.condition === row.condition,
    );
    const epStatuses = (row.episodes ?? [])
      .map(e => `E${e.episode_index}:${e.idle_outcome?.status ?? 'err'}(${e.idle_outcome?.reason ?? e.idle_calls})`)
      .join(' / ');
    lines.push(
      `| ${row.timeline_id} | ${row.condition} | ${row.idle_calls ?? 0} (${row.attributed_idle_calls ?? 0}) | ${row.reply_calls ?? 0} | ${cost?.new_actual.total_tokens ?? 'n/a'} | ${cost?.standalone_attributed.total_tokens ?? 'n/a'} | ${cost?.idle_token_share ?? 0} | ${epStatuses} |`,
    );
  }

  for (const row of report.results) {
    lines.push('', `## ${row.timeline_id} / ${row.condition}`);
    for (const ep of row.episodes ?? []) {
      lines.push(
        '',
        `### Episode ${ep.episode_index} (gap=${ep.idle_gap_minutes}m, pool=${ep.visible_pool_size}, idle=${ep.idle_outcome?.status}, bridge=${ep.idle_bridge_id})`,
      );
      if (ep.candidate) {
        lines.push(`- **Idle Candidate (not_sent)**: ${ep.candidate.text}`);
      }
      if (ep.thoughts_after_idle?.length) {
        lines.push(
          `- **Active Private Thoughts (${ep.thoughts_after_idle.length})**: ${ep.thoughts_after_idle.map(t => `[ep${t.episodeIndex}:${t.originalId}] ${t.text}`).join(' | ')}`,
        );
      }
      for (const t of ep.turns ?? []) {
        const replyText = (t.reply?.content ?? 'dry-run: no live output').replace(/\s+/g, ' ');
        lines.push(
          `- **Turn ${t.turn_index}** (Passive Top-K: \`${t.passive_top_k_ids.join(', ')}\` | Consumed thoughts: ${t.consumed_thoughts_count}):`,
          `  - User: ${t.user_message.text}`,
          `  - Assistant: ${replyText}`,
        );
      }
    }
  }
  return lines.join('\n') + '\n';
}

export async function runTimelineBatch({
  mode,
  env = process.env,
  fetchImpl = globalThis.fetch,
  outputDir = reportDirectory,
  timelines = timelineScenarios(),
  topK = 5,
  proactiveOpen = false,
} = {}) {
  if (!['dry-run', 'live'].includes(mode)) throw new Error('Choose --dry-run or --live');
  if (!Array.isArray(timelines) || !timelines.length) throw new Error('No timelines supplied');
  if (timelines.some(t => t.data_origin !== 'synthetic')) {
    throw new Error('Public live/dry-run runner accepts synthetic timelines only');
  }
  const config = mode === 'live' ? readLiveConfig(env) : null;
  const client = config ? createOpenAIClient(config, {fetchImpl}) : null;
  const runId =
    'timeline-' +
    mode +
    '-' +
    new Date().toISOString().replace(/[:.]/g, '-') +
    '-' +
    crypto.randomBytes(3).toString('hex');
  const runDirectory = path.join(outputDir, 'runs', runId);
  fs.mkdirSync(runDirectory, {recursive: true});

  const report = {
    schema_version: 3,
    run_id: runId,
    mode,
    runner_version: TIMELINE_RUNNER_VERSION,
    host_version: TIMELINE_HOST_VERSION,
    transport: {max_output_tokens: TIMELINE_API_MAX_TOKENS, automatic_retries: 0},
    implementation_hashes: Object.fromEntries(
      ['./run-timeline.mjs', './run-batch.mjs', './timeline-host.mjs', './timeline-scenarios.mjs', '../src/global-core.mjs', '../src/policy.mjs']
        .map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(new URL(name, import.meta.url))).digest('hex')]),
    ),
    model: config?.model ?? env.EVAL_MODEL ?? null,
    endpoint: config?.endpoint ?? null,
    top_k: topK,
    proactive_open: proactiveOpen,
    timeline_snapshots: structuredClone(timelines),
    timelines: timelines.map(t => ({
      timeline_id: t.timeline_id,
      origin: t.data_origin,
      audience: t.audience,
      materials_count: t.materials.length,
      episodes_count: t.episodes.length,
      turns_count: t.episodes.reduce((n, e) => n + e.dialogue_turns.length, 0),
      timeline_hash: hash(t),
    })),
    calls: [],
    results: [],
    external_model_calls: 0,
    failed_calls: 0,
    failed_conditions: 0,
    tokens: null,
    messages_sent: 0,
  };

  const persist = () => {
    report.costs = summarizeTimelineCosts(report);
    const actual = report.costs.actual_batch;
    report.tokens = actual.calls && actual.total_tokens !== null
      ? {total_tokens: actual.total_tokens, prompt_tokens: actual.prompt_tokens, completion_tokens: actual.completion_tokens}
      : null;
    const json = redact(JSON.stringify(report, null, 2) + '\n', config?.apiKey);
    fs.writeFileSync(path.join(runDirectory, 'report.json'), json);
    fs.writeFileSync(path.join(outputDir, 'latest-timeline-report.json'), json);
    fs.writeFileSync(
      path.join(outputDir, 'latest-timeline-report.md'),
      redact(renderTimelineReport(report), config?.apiKey),
    );
  };
  persist();

  for (const timeline of timelines) {
    const executeCondition = async (condition, paired = null) => {
      const callIds = [];
      const started = performance.now();
      const invoke = async ({phase, episodeIndex, turnIndex = null, step, messages, request}) => {
        const call = {
          id: 'call-' + (report.calls.length + 1),
          timeline_id: timeline.timeline_id,
          condition,
          phase,
          episode_index: episodeIndex,
          turn_index: turnIndex,
          step,
          model: report.model,
          requested_max_tokens: request.maxTokens,
          max_tokens: Math.max(request.maxTokens ?? 500, TIMELINE_API_MAX_TOKENS),
          messages: structuredClone(messages),
          prompt_hash: hash(messages),
          status: 'planned',
          content: null,
          usage: null,
          elapsed_ms: null,
        };
        report.calls.push(call);
        callIds.push(call.id);
        if (mode === 'dry-run') {
          return phase === 'idle'
            ? {value: previewTimelineDecision(condition, step, request.input)}
            : {content: null, elapsed_ms: null, usage: null, dry_run: true};
        }
        report.external_model_calls++;
        call.status = 'inflight';
        persist();
        const callStart = performance.now();
        try {
          Object.assign(
            call,
            await client({messages, maxTokens: call.max_tokens, signal: request.signal}),
            {status: 'ok'},
          );
          return phase === 'idle'
            ? {value: parseDecision(call.content)}
            : {content: call.content, elapsed_ms: call.elapsed_ms, usage: call.usage};
        } catch (error) {
          call.status = 'failed';
          call.error = redact(error.message, config.apiKey);
          call.elapsed_ms ??= Math.round(performance.now() - callStart);
          report.failed_calls++;
          throw new Error(call.error);
        } finally {
          persist();
        }
      };

      try {
        const row = await runModelTimelineCondition(
          timeline,
          condition,
          path.join(runDirectory, timeline.timeline_id, condition.replace('+', '-plus-')),
          {invoke, replay: paired, topK, proactiveOpen},
        );
        const conditionCalls = report.calls.filter(c => callIds.includes(c.id));
        const failed =
          row.episodes.some(e => ['failed', 'interrupted'].includes(e.idle_outcome?.status)) ||
          conditionCalls.some(c => c.status === 'failed');
        if (failed) report.failed_conditions++;
        return {
          ...row,
          call_ids: callIds,
          external_model_calls: mode === 'live' ? conditionCalls.length : 0,
          elapsed_ms: Math.round(performance.now() - started),
          failed,
        };
      } catch (error) {
        report.failed_conditions++;
        return {
          timeline_id: timeline.timeline_id,
          condition,
          call_ids: callIds,
          external_model_calls: mode === 'live' ? callIds.length : 0,
          elapsed_ms: Math.round(performance.now() - started),
          failed: true,
          error: redact(error.message, config?.apiKey),
          messages_sent: 0,
        };
      }
    };

    if (mode === 'live') {
      const resC = await executeCondition('C');
      const [resA, resC0] = await Promise.all([
        executeCondition('A'),
        executeCondition('C0', resC),
      ]);
      const [resB, resBT] = await Promise.all([
        executeCondition('B'),
        executeCondition('B+T'),
      ]);
      const byCond = {A: resA, B: resB, C: resC, C0: resC0, 'B+T': resBT};
      for (const cond of CONDITIONS) report.results.push(byCond[cond]);
    } else {
      let paired = null;
      for (const cond of CONDITIONS) {
        const res = await executeCondition(cond, paired);
        if (cond === 'C') paired = res;
        report.results.push(res);
      }
    }

    persist();
  }
  return {report, reportFile: path.join(outputDir, 'latest-timeline-report.md'), runDirectory};
}

export async function main(args = process.argv.slice(2)) {
  const modeArg = args.find(a => ['--dry-run', '--live'].includes(a));
  const proactiveOpen = args.includes('--proactive-open');
  if (!modeArg || args.some(a => !['--dry-run', '--live', '--proactive-open'].includes(a))) {
    throw new Error('Usage: node evaluation/run-timeline.mjs --dry-run|--live [--proactive-open]');
  }
  const {report, reportFile} = await runTimelineBatch({mode: modeArg.slice(2), proactiveOpen});
  console.log(
    JSON.stringify({
      mode: report.mode,
      timelines: report.timelines.length,
      conditions: report.results.length,
      planned_calls: report.calls.length,
      external_model_calls: report.external_model_calls,
      failed_calls: report.failed_calls,
      failed_conditions: report.failed_conditions,
      tokens: report.tokens,
      report: path.relative(process.cwd(), reportFile),
    }),
  );
  if (report.failed_conditions || report.failed_calls) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(redact(error.message, process.env.OPENAI_API_KEY));
    process.exitCode = 1;
  });
}
