import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {GlobalMemoryLibrary, GlobalRecollection, DEFAULTS} from '../index.mjs';
import {CONDITIONS, SINGLE_PROMPT} from './condition-host.mjs';

export {CONDITIONS};
export const TIMELINE_HOST_VERSION = 'llm-timeline-host-v2';
export const SCRIPTED_TIMELINE_HOST_VERSION = 'scripted-timeline-host-v2';

const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

export function extractTokens(raw) {
  const value = String(raw ?? '').toLowerCase();
  const result = new Set(value.match(/[a-z0-9]{2,}/g) || []);
  for (const run of value.match(/[\u3400-\u9fff]+/g) || []) {
    if (run.length === 1) result.add(run);
    for (let i = 0; i < run.length - 1; i++) result.add(run.slice(i, i + 2));
  }
  return result;
}

export function validateTimeline(value) {
  assert.equal(value.schema_version, 2);
  assert.ok(safeId(value.timeline_id));
  assert.ok(['development', 'heldout'].includes(value.split));
  assert.ok(typeof value.audience === 'string' && value.audience.trim());
  assert.ok(Array.isArray(value.materials) && value.materials.length >= 4);
  assert.ok(Array.isArray(value.episodes) && value.episodes.length >= 2);
  const ids = new Set();
  for (const item of value.materials) {
    assert.ok(safeId(item.id) && !ids.has(item.id));
    ids.add(item.id);
    assert.equal(item.scope, value.audience);
    assert.equal(item.status, 'active');
    assert.ok(['observed', 'reported', 'fictional', 'unknown'].includes(item.truth));
    assert.ok(Number.isSafeInteger(item.available_at) && Number.isSafeInteger(item.time));
    assert.ok(item.time <= item.available_at);
    assert.ok(typeof item.text === 'string' && item.text.trim());
  }
  let prevTime = 0;
  for (const ep of value.episodes) {
    assert.ok(safeId(ep.episode_id));
    assert.ok(Number.isSafeInteger(ep.opportunity_at) && ep.opportunity_at > prevTime);
    assert.ok(Array.isArray(ep.dialogue_turns) && ep.dialogue_turns.length >= 2);
    for (const ctx of ep.recent_context ?? []) {
      assert.ok(Number.isSafeInteger(ctx.at) && ctx.at <= ep.opportunity_at);
    }
    let turnTime = ep.opportunity_at;
    for (const turn of ep.dialogue_turns) {
      const msg = turn.user_message;
      assert.ok(msg && typeof msg.text === 'string' && msg.text.trim());
      assert.ok(Number.isSafeInteger(msg.at) && msg.at > ep.opportunity_at && msg.at >= turnTime);
      turnTime = msg.at;
    }
    prevTime = turnTime;
  }
  return value;
}

export function selectPassiveTopK(memories, queryText, {topK = 5, now = Date.now(), currentStoryId = null} = {}) {
  const queryTokens = extractTokens(queryText);
  const scored = memories.map(item => {
    const itemTokens = extractTokens(item.text);
    let overlap = 0;
    for (const tok of queryTokens) {
      if (itemTokens.has(tok)) overlap++;
    }
    const lexical = queryTokens.size ? overlap / Math.max(1, Math.min(queryTokens.size, 6)) : 0;
    const ageDays = Math.max(0, (now - (item.eventAt ?? item.time ?? now)) / 86400000);
    const recency = Math.pow(0.5, ageDays / 14);
    const sameStory = (item.storyId ?? null) === (currentStoryId ?? null) ? 0.05 : 0;
    const score = lexical * 0.78 + recency * 0.17 + sameStory;
    return {
      item,
      overlap,
      lexical: Number(lexical.toFixed(4)),
      recency: Number(recency.toFixed(4)),
      score: Number(score.toFixed(4)),
    };
  });
  scored.sort((a, b) => b.score - a.score || b.overlap - a.overlap || a.item.ref.localeCompare(b.item.ref));
  return scored.slice(0, topK).map(entry => ({
    ...entry.item,
    passive_score: entry.score,
    lexical_overlap: entry.overlap,
  }));
}

export function selectAssociativeIdlePool(
  memories,
  recentContext = [],
  {episode = null, usedRefs = new Set(), surfaceCount = DEFAULTS.memoriesPerStep} = {},
) {
  assert.ok(memories.length > 0, 'Idle pool requires visible memories');
  const byId = new Map(memories.map(m => [m.originalId, m]));
  if (episode?.idle_candidates?.surface_ids?.length >= surfaceCount && episode?.idle_candidates?.bridge_id) {
    const surface = episode.idle_candidates.surface_ids
      .slice(0, surfaceCount)
      .map(id => byId.get(id))
      .filter(Boolean);
    const bridge = byId.get(episode.idle_candidates.bridge_id);
    if (surface.length === surfaceCount && bridge && !surface.some(s => s.ref === bridge.ref)) {
      const activeFour = [...surface, bridge].sort((a, b) => a.ref.localeCompare(b.ref));
      const bridgeIdx = activeFour.findIndex(m => m.ref === bridge.ref);
      const startIdx = (bridgeIdx + 1) % activeFour.length;
      const ordered = [...activeFour.slice(startIdx), ...activeFour.slice(0, startIdx)];
      return {
        surface: ordered.slice(0, surfaceCount),
        bridge: ordered[surfaceCount],
        activeRefs: new Set(activeFour.map(m => m.ref)),
        rotationFraction: (startIdx + 0.1) / activeFour.length,
      };
    }
  }
  const cueText = recentContext.map(c => c.text).join(' ');
  const cueTokens = extractTokens(cueText);
  const scoredSurface = memories.map(item => {
    const mTokens = extractTokens(item.text);
    let overlap = 0;
    for (const tok of cueTokens) if (mTokens.has(tok)) overlap++;
    const freshBoost = usedRefs.has(item.ref) ? 0.35 : 1;
    const score = (overlap + 0.2) * freshBoost;
    return {item, score, overlap, tokens: mTokens};
  });
  scoredSurface.sort((a, b) => b.score - a.score || a.item.ref.localeCompare(b.item.ref));
  const surfaceRaw = scoredSurface.slice(0, Math.min(surfaceCount, scoredSurface.length)).map(x => x.item);
  const surfaceRefs = new Set(surfaceRaw.map(m => m.ref));
  const surfaceUnionTokens = new Set();
  for (const m of surfaceRaw) {
    for (const tok of extractTokens(m.text)) surfaceUnionTokens.add(tok);
  }
  const remaining = memories.filter(m => !surfaceRefs.has(m.ref));
  if (!remaining.length) {
    return {
      surface: surfaceRaw,
      bridge: null,
      activeRefs: new Set(surfaceRaw.map(m => m.ref)),
      rotationFraction: 0,
    };
  }
  const scoredBridge = remaining.map(item => {
    const mTokens = extractTokens(item.text);
    let bridgeOverlap = 0;
    for (const tok of surfaceUnionTokens) if (mTokens.has(tok)) bridgeOverlap++;
    let directOverlap = 0;
    for (const tok of cueTokens) if (mTokens.has(tok)) directOverlap++;
    const freshBoost = usedRefs.has(item.ref) ? 0.25 : 1;
    // Prefer memories that share secondary associative tokens with surface memories but were not #1 literal hits
    const assocScore = (bridgeOverlap * 1.4 - directOverlap * 0.2 + 0.5) * freshBoost;
    return {item, assocScore};
  });
  scoredBridge.sort((a, b) => b.assocScore - a.assocScore || a.item.ref.localeCompare(b.item.ref));
  const bridge = scoredBridge[0].item;
  const activeFour = [...surfaceRaw, bridge].sort((a, b) => a.ref.localeCompare(b.ref));
  const bridgeIdx = activeFour.findIndex(m => m.ref === bridge.ref);
  const startIdx = (bridgeIdx + 1) % activeFour.length;
  const ordered = [...activeFour.slice(startIdx), ...activeFour.slice(0, startIdx)];
  return {
    surface: ordered.slice(0, surfaceRaw.length),
    bridge: ordered[surfaceRaw.length],
    activeRefs: new Set(activeFour.map(m => m.ref)),
    rotationFraction: (startIdx + 0.1) / activeFour.length,
  };
}

export function buildTimelineMessages(
  timeline,
  condition,
  {
    phase,
    input,
    system,
    episodeIndex = 1,
    turnIndex = 1,
    step = 1,
    currentTurn,
    conversationHistory = [],
    passiveMemories = [],
    thoughts = [],
    proactiveCandidate = null,
  },
) {
  validateTimeline(timeline);
  assert.ok(CONDITIONS.includes(condition));
  if (phase === 'idle') {
    assert.ok(condition !== 'A' && condition !== 'C0');
    const single = condition === 'B' || condition === 'B+T';
    const groundingRule =
      'Temporal & modal grounding: past memories (episodic) happened earlier, never narrate them as physical actions happening right now. '
      + 'Planned memories (planned) are unfulfilled future intentions, never state them as completed past events. '
      + 'If visible memories are trivial logistics, already repeated, or have no natural emotional link, choose silence/leave. '
      + (single
        ? 'Return only valid JSON.'
        : 'In multi-step solitude, every non-silent action ("follow", "linger", "keep", "express") MUST include both "memoryId" (exact supplied ref) and "anchor" (an exact verbatim substring copied from that memory\'s text field); only "silence" or "leave" may omit them. '
          + (step === 1
            ? 'Current wander_step is 1 of 2: if the supplied memories are surface cues that could connect to deeper shared history, prefer action "follow" (with memoryId, exact anchor substring, and optional thought, WITHOUT expression/shareText) so step 2 can surface the bridged memory; if the memories are trivial or irrelevant, choose "silence" or "leave". '
            : 'Current wander_step is 2 of 2 (final step): if the bridged memory is meaningful, choose "keep" (with memoryId, exact anchor substring, and thought) or "express" (with memoryId, exact anchor substring, thought, and expression); otherwise choose "silence" or "leave". ')
          + 'Return only valid JSON.');
    const contract = condition === 'B'
      ? 'Return only JSON: {"action":"silence|express","memoryId":"supplied ref for express","anchor":"exact visible substring for express","expression":"optional expression, at most 160 characters"}. Do not produce a private thought.'
      : 'Return only JSON: {"action":"silence|keep|express","memoryId":"supplied ref for keep/express","anchor":"exact visible substring for keep/express","thought":"optional tentative association, at most 400 characters","expression":"optional expression, at most 160 characters"}. Silence may omit other fields.';
    const userInput = single ? input : {...input, wander_step: step, max_wander_steps: DEFAULTS.maxWanderSteps};
    return [
      {role: 'system', content: (single ? SINGLE_PROMPT + '\n' + contract : system) + '\n' + groundingRule},
      {role: 'user', content: JSON.stringify(userInput, null, 2)},
    ];
  }
  assert.equal(phase, 'reply');
  const visibleThoughts = ['C', 'B+T'].includes(condition)
    ? thoughts.map(t => ({
      text: t.text,
      anchor: t.anchor ?? null,
      anchoredMemoryText: t.anchoredMemoryText ?? null,
      memoryTruth: t.memoryTruth ?? 'reported',
      status: 'tentative_character_thought',
      usableAsEvidence: false,
    }))
    : [];
  return [
    {
      role: 'system',
      content:
        'Reply in character to the current user message in one to three natural Chinese sentences. '
        + 'Use only the visible materials, rolling conversation history, and optional tentative character thoughts. '
        + 'TEMPORAL GROUNDING RULE: Memories describe past conversations or historical habits; NEVER narrate a past memory action (such as tapping a cup, folding paper, or past weather) as something happening physically right now in the current scene unless the user explicitly stated it in the current conversation history. '
        + 'PLANNED BOUNDARY RULE: Memories labeled as "planned" (尚未证实兑现的计划) are unfulfilled intentions; NEVER refer to them as already completed trips or past experiences. '
        + 'PROVENANCE RULE: Treat reported items as user statements (or rumors if stated as hearsay) and fictional items as story events. Other-story material is reference, never an event in the current story. Impression memories have no hidden details to reconstruct. '
        + 'RELEVANCE & WEAVING RULE: Unless the user explicitly asks about other-story or unrelated distractor memories, silently ignore them without meta-disclaimers. '
        + 'Tentative character thoughts (usableAsEvidence: false) are internal associations from quiet moments; when a tentative thought naturally fits the user\'s current mood or question, gently weave its anchored memory into your reply without repeating the exact same callback across multiple turns, and never treat the thought itself as a new objective fact. '
        + 'Do not mention memory IDs, evaluation conditions, or hidden thought machinery. Do not force a follow-up question.\n'
        + timeline.character.persona,
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          mode: timeline.mode ?? 'companion',
          storyId: timeline.storyId ?? null,
          episode_index: episodeIndex,
          turn_index: turnIndex,
          current_user_message: currentTurn.text,
          conversation_history: conversationHistory,
          passive_top_k_memories: passiveMemories.map(({ref, originalId, text, truth, storyId, detail}) => ({
            ref,
            id: originalId,
            text,
            truth,
            storyId,
            detail,
          })),
          tentative_thoughts: visibleThoughts,
          ...(proactiveCandidate ? {optional_idle_outreach_candidate: proactiveCandidate.text} : {}),
        },
        null,
        2,
      ),
    },
  ];
}

function validateSingleDecision(raw, memories, condition) {
  assert.ok(raw && typeof raw === 'object' && !Array.isArray(raw), 'Expected a JSON decision object');
  assert.ok(
    (condition === 'B' ? ['silence', 'express'] : ['silence', 'keep', 'express']).includes(raw.action),
    'Invalid single-pass action',
  );
  if (raw.action === 'silence') return {action: 'silence'};
  const memory = memories.find(item => item.ref === raw.memoryId);
  assert.ok(
    memory && typeof raw.anchor === 'string' && raw.anchor.trim() && memory.text.includes(raw.anchor),
    'Invalid source anchor',
  );
  const thought = condition === 'B+T' ? raw.thought ?? '' : '';
  const expression = raw.action === 'express' ? raw.expression ?? '' : '';
  assert.ok(typeof thought === 'string' && Array.from(thought).length <= 400, 'Invalid thought');
  assert.ok(typeof expression === 'string' && Array.from(expression).length <= 160, 'Invalid expression');
  assert.ok(raw.action === 'keep' ? thought.trim() : expression.trim(), 'Empty decision content');
  return {
    action: raw.action,
    thought,
    expression,
    memoryId: memory.ref,
    originalId: memory.originalId,
    memoryText: memory.text,
    memoryTruth: memory.truth,
    anchor: raw.anchor,
  };
}

export async function runModelTimelineCondition(
  input,
  condition,
  directory,
  {invoke, replay = null, topK = 5, proactiveOpen = false} = {},
) {
  const timeline = validateTimeline(input);
  assert.ok(CONDITIONS.includes(condition) && typeof invoke === 'function');
  assert.ok(!fs.existsSync(directory), 'Condition timeline state directory must be isolated');
  fs.mkdirSync(directory, {recursive: true});
  const sourceDirectory = path.join(directory, 'source');
  const stateDirectory = path.join(directory, 'state');
  fs.mkdirSync(sourceDirectory);
  fs.mkdirSync(stateDirectory);

  const file = path.join(sourceDirectory, 'materials.jsonl');
  fs.writeFileSync(file, timeline.materials.map(m => JSON.stringify(m)).join('\n') + '\n');
  const baselineHash = digest(fs.readFileSync(file));
  const access = Object.freeze({audience: timeline.audience});
  const availableMap = new Map(timeline.materials.map(m => [m.id, m.available_at]));
  let currentNow = timeline.episodes[0].opportunity_at;
  let idleActiveRefs = null;

  const library = new GlobalMemoryLibrary({
    sources: [
      {
        id: 'timeline-materials',
        file,
        format: 'jsonl',
        fields: {
          id: 'id',
          text: 'text',
          scope: 'scope',
          status: 'status',
          truth: 'truth',
          time: 'time',
          storyId: 'storyId',
        },
        timeUnit: 'milliseconds',
        statusMap: {active: 'active'},
        rp: {enabled: true, textField: 'text', detail: timeline.visibility ?? 'specific'},
      },
    ],
    authorize: ({context, material}) => {
      if (context !== access) return false;
      if (!material) return true;
      if (material.sourceScope !== timeline.audience) return false;
      if ((availableMap.get(material.originalId) ?? Infinity) > currentNow) return false;
      if (idleActiveRefs !== null && !idleActiveRefs.has(material.ref)) return false;
      return true;
    },
  });

  let rotationSample = 0;
  let runtime = null;
  const persistentThoughts = [];
  let pendingThoughts = [];
  const usedRefs = new Set();
  const expressedRefs = new Set();
  const rollingHistory = [];
  const episodeResults = [];
  let totalIdleCalls = 0;
  let totalReplyCalls = 0;

  if (condition === 'C') {
    currentNow = timeline.episodes[0].opportunity_at - DEFAULTS.solitudeIntervalHours[0] * 3600000;
    runtime = new GlobalRecollection(
      {
        characterId: timeline.character.id,
        mode: timeline.mode ?? 'companion',
        ...(timeline.storyId ? {storyId: timeline.storyId} : {}),
        persona: timeline.character.persona,
        stateDir: stateDirectory,
      },
      {
        library,
        contextKey: a => (a === access ? 'timeline:' + timeline.audience : null),
        now: () => currentNow,
        random: () => {
          const sample = rotationSample;
          rotationSample = 0;
          return sample;
        },
        wander: async request => {
          totalIdleCalls++;
          epIdleCalls++;
          const stepNum = epIdleCalls;
          const messages = buildTimelineMessages(timeline, condition, {
            phase: 'idle',
            episodeIndex: currentEpisodeIndex,
            step: stepNum,
            input: request.input,
            system: request.system,
          });
          const res = await invoke({
            phase: 'idle',
            episodeIndex: currentEpisodeIndex,
            step: stepNum,
            messages,
            request,
          });
          const d = res?.value;
          if (d?.memoryId) {
            usedRefs.add(d.memoryId);
            const matched = request.input.memories.find(m => m.ref === d.memoryId);
            if (d.thought && matched) {
              pendingThoughts.push({
                text: d.thought,
                memoryId: matched.ref,
                originalId: matched.originalId,
                anchor: d.anchor,
                anchoredMemoryText: matched.text,
                memoryTruth: matched.truth,
                episodeIndex: currentEpisodeIndex,
                at: currentNow,
                usableAsEvidence: false,
              });
            }
            if ((d.expression || d.shareText) && matched) {
              expressedRefs.add(matched.ref);
            }
          }
          return res;
        },
      },
    );
  }

  let currentEpisodeIndex = 1;
  let epIdleCalls = 0;

  try {
    for (let epIdx = 0; epIdx < timeline.episodes.length; epIdx++) {
      const ep = timeline.episodes[epIdx];
      currentEpisodeIndex = ep.episode_index ?? epIdx + 1;
      epIdleCalls = 0;
      currentNow = ep.opportunity_at;
      idleActiveRefs = null;

      const fullPageAtIdle = await library.query({purpose: 'rp', context: access, now: currentNow, limit: 500});
      const visibleAtIdle = fullPageAtIdle.items.map(
        ({ref, originalId, text, truth, storyId, detail, eventAt, revision}) => ({
          ref,
          originalId,
          text,
          truth,
          storyId,
          detail,
          eventAt,
          revision,
        }),
      );
      assert.ok(visibleAtIdle.length > 0, 'No visible memories at episode opportunity');
      const idleSelection = selectAssociativeIdlePool(
        visibleAtIdle,
        [...(ep.recent_context ?? []), ...rollingHistory.slice(-4)],
        {episode: ep, usedRefs, surfaceCount: DEFAULTS.memoriesPerStep},
      );

      let outcome = {status: 'passive', modelCalls: 0};
      let candidate = null;

      if (condition === 'C0') {
        assert.ok(
          replay &&
            replay.timeline_id === timeline.timeline_id &&
            replay.condition === 'C' &&
            replay.host_version === TIMELINE_HOST_VERSION,
          'C0 requires paired C timeline artifact',
        );
        const pairedEp = replay.episodes[epIdx];
        assert.ok(pairedEp, 'Missing paired C episode artifact');
        outcome = structuredClone(pairedEp.idle_outcome);
        candidate = structuredClone(pairedEp.candidate);
      } else if (condition === 'B' || condition === 'B+T') {
        totalIdleCalls++;
        epIdleCalls = 1;
        const suppliedSurface = idleSelection.surface.map(({ref, originalId, text, truth, storyId, detail}) => ({
          ref,
          originalId,
          text,
          truth,
          storyId,
          detail,
        }));
        const modelInput = {
          mode: timeline.mode ?? 'companion',
          storyId: timeline.storyId ?? null,
          episode_index: currentEpisodeIndex,
          persona: timeline.character.persona,
          recent_context: [...(ep.recent_context ?? []), ...rollingHistory.slice(-4)].slice(-6),
          memories: suppliedSurface,
          mayExpress: true,
        };
        const messages = buildTimelineMessages(timeline, condition, {
          phase: 'idle',
          episodeIndex: currentEpisodeIndex,
          input: modelInput,
        });
        const response = await invoke({
          phase: 'idle',
          episodeIndex: currentEpisodeIndex,
          step: 1,
          messages,
          request: {input: modelInput, maxTokens: DEFAULTS.maxOutputTokens},
        });
        const decision = validateSingleDecision(response.value, suppliedSurface, condition);
        if (decision.memoryId) usedRefs.add(decision.memoryId);
        if (decision.thought) {
          persistentThoughts.push({
            text: decision.thought,
            memoryId: decision.memoryId,
            originalId: decision.originalId,
            anchor: decision.anchor,
            anchoredMemoryText: decision.memoryText,
            memoryTruth: decision.memoryTruth,
            episodeIndex: currentEpisodeIndex,
            at: currentNow,
            usableAsEvidence: false,
          });
          while (persistentThoughts.length > DEFAULTS.maxThoughts) persistentThoughts.shift();
        }
        if (decision.expression) {
          expressedRefs.add(decision.memoryId);
          candidate = {
            text: decision.expression,
            anchor: decision.anchor,
            memoryId: decision.memoryId,
            originalId: decision.originalId,
            sent: false,
            status: 'not_sent',
          };
        }
        outcome = {
          status: candidate ? 'expression_proposed' : decision.thought ? 'kept' : 'silence',
          modelCalls: epIdleCalls,
        };
      } else if (condition === 'C') {
        pendingThoughts = [];
        const st = runtime.status();
        // If >24h elapsed since nextAt (multi-day gap in real timelines), simulate periodic host check 72h prior
        if (ep.opportunity_at >= st.nextAt + 86400000) {
          rotationSample = 0;
          currentNow = ep.opportunity_at - DEFAULTS.solitudeIntervalHours[0] * 3600000;
          await runtime.solitude(
            {
              mode: timeline.mode ?? 'companion',
              ...(timeline.storyId ? {storyId: timeline.storyId} : {}),
              allowExpression: true,
              lastInteractionAt: currentNow - DEFAULTS.inactivityMinutes * 60000,
            },
            {access},
          );
          currentNow = ep.opportunity_at;
        }
        idleActiveRefs = idleSelection.activeRefs;
        rotationSample = idleSelection.rotationFraction;
        const context = {
          mode: timeline.mode ?? 'companion',
          ...(timeline.storyId ? {storyId: timeline.storyId} : {}),
          allowExpression: true,
          lastInteractionAt: ep.last_recorded_interaction_at ?? currentNow - DEFAULTS.inactivityMinutes * 60000,
        };
        outcome = await runtime.solitude(context, {access});
        rotationSample = 0;
        idleActiveRefs = null;
        // Only export thoughts accepted by the core. The experimental ledger is
        // still distinct from privateThoughts(), which returns at most 3 texts.
        const accepted = await runtime.privateThoughts(context, {access});
        for (const thought of outcome.status === 'solitude_ended' ? pendingThoughts : []) {
          if (accepted.some(t => t.text === thought.text)) persistentThoughts.push(thought);
        }
        while (persistentThoughts.length > DEFAULTS.maxThoughts) persistentThoughts.shift();
        if (outcome.intentId) {
          const taken = await runtime.takeExpression(
            outcome.intentId,
            {...context, delivery: 'reply', replyToMessageId: `reply-ep-${currentEpisodeIndex}`},
            {access},
          );
          if (taken) {
            assert.equal(taken.sent, false);
            runtime.settleExpression(taken.id, {outcome: 'not_sent'}, {access});
            candidate = {...taken, status: 'not_sent'};
          }
        }
      }

      write(
        path.join(stateDirectory, `thought-ledger-ep${currentEpisodeIndex}.json`),
        persistentThoughts,
      );

      // Seed episode conversation history with episode recent_context and optional proactive candidate
      const epHistory = [
        ...rollingHistory.slice(-4),
        ...(ep.recent_context ?? []).map(c => ({role: c.role, text: c.text, at: c.at})),
      ];
      if (proactiveOpen && candidate?.text) {
        epHistory.push({role: 'assistant', text: candidate.text, at: ep.opportunity_at, origin: 'proactive_candidate'});
      }

      const turnOutputs = [];
      for (let tIdx = 0; tIdx < ep.dialogue_turns.length; tIdx++) {
        const turn = ep.dialogue_turns[tIdx];
        const turnNumber = turn.turn_index ?? tIdx + 1;
        const userMsg = turn.user_message;
        currentNow = userMsg.at;
        idleActiveRefs = null;

        const pageAtTurn = await library.query({purpose: 'rp', context: access, now: currentNow, limit: 500});
        const allVisibleAtTurn = pageAtTurn.items.map(
          ({ref, originalId, text, truth, storyId, detail, eventAt}) => ({
            ref,
            originalId,
            text,
            truth,
            storyId,
            detail,
            eventAt,
          }),
        );
        const passiveTopK = selectPassiveTopK(allVisibleAtTurn, userMsg.text, {
          topK,
          now: currentNow,
          currentStoryId: timeline.storyId ?? null,
        });
        assert.ok(passiveTopK.length <= topK, 'Passive retrieval exceeded topK limit');

        const activeThoughts = ['C', 'B+T'].includes(condition)
          ? structuredClone(persistentThoughts.filter(t => allVisibleAtTurn.some(m =>
            m.ref === t.memoryId && m.text === t.anchoredMemoryText && m.text.includes(t.anchor))))
          : [];
        if (condition === 'C0') assert.equal(activeThoughts.length, 0);

        const replyMessages = buildTimelineMessages(timeline, condition, {
          phase: 'reply',
          episodeIndex: currentEpisodeIndex,
          turnIndex: turnNumber,
          currentTurn: userMsg,
          conversationHistory: epHistory.slice(-8),
          passiveMemories: passiveTopK,
          thoughts: activeThoughts,
          proactiveCandidate: tIdx === 0 && proactiveOpen ? candidate : null,
        });
        totalReplyCalls++;
        const reply = await invoke({
          phase: 'reply',
          episodeIndex: currentEpisodeIndex,
          turnIndex: turnNumber,
          step: tIdx + 1,
          messages: replyMessages,
          request: {maxTokens: DEFAULTS.maxOutputTokens},
        });
        const replyText = reply?.content ?? '';
        epHistory.push({role: 'user', text: userMsg.text, at: userMsg.at});
        if (replyText) {
          epHistory.push({role: 'assistant', text: replyText, at: userMsg.at});
        }
        turnOutputs.push({
          turn_index: turnNumber,
          user_message: userMsg,
          passive_top_k_ids: passiveTopK.map(m => m.originalId),
          consumed_thoughts_count: activeThoughts.length,
          consumed_thoughts: activeThoughts,
          reply,
        });
      }

      rollingHistory.push(...epHistory.slice(-6));
      episodeResults.push({
        episode_id: ep.episode_id,
        episode_index: currentEpisodeIndex,
        opportunity_at: ep.opportunity_at,
        idle_gap_minutes: ep.idle_gap_minutes,
        visible_pool_size: visibleAtIdle.length,
        idle_surface_ids: idleSelection.surface.map(m => m.originalId),
        idle_bridge_id: idleSelection.bridge?.originalId ?? null,
        idle_outcome: outcome,
        idle_calls: condition === 'C0' ? 0 : epIdleCalls,
        attributed_idle_calls:
          condition === 'C0' ? replay.episodes[epIdx].idle_calls : epIdleCalls,
        thoughts_after_idle:
          condition === 'C0'
            ? structuredClone(replay.episodes[epIdx].thoughts_after_idle)
            : structuredClone(persistentThoughts),
        consumed_thoughts_in_replies: ['C', 'B+T'].includes(condition) ? persistentThoughts.length : 0,
        candidate,
        turns: turnOutputs,
      });
    }

    assert.equal(digest(fs.readFileSync(file)), baselineHash, 'Source file was mutated');
    const result = {
      timeline_id: timeline.timeline_id,
      split: timeline.split,
      audience: timeline.audience,
      scope_kind: timeline.scope_kind ?? 'companion',
      condition,
      host_version: TIMELINE_HOST_VERSION,
      top_k: topK,
      shared_idle_from: condition === 'C0' ? 'C' : null,
      idle_calls: totalIdleCalls,
      attributed_idle_calls:
        condition === 'C0'
          ? replay.idle_calls
          : totalIdleCalls,
      reply_calls: totalReplyCalls,
      episodes: episodeResults,
      messages_sent: 0,
    };
    write(path.join(directory, 'timeline-artifact.json'), result);
    return result;
  } finally {
    if (runtime) await runtime.close();
  }
}

export async function runScriptedTimeline(timeline, directory, {topK = 5} = {}) {
  validateTimeline(timeline);
  const results = [];
  let paired = null;
  for (const condition of CONDITIONS) {
    const condDir = path.join(directory, condition.replace('+', '-plus-'));
    const invoke = async ({phase, episodeIndex, step, request, messages}) => {
      if (phase === 'idle') {
        const memories = request.input.memories;
        const selected = condition === 'C' && step > 1 ? memories[memories.length - 1] : memories[0];
        const anchor = selected.text.slice(0, 36);
        if (condition === 'C' && step === 1) {
          return {
            value: {
              action: 'linger',
              memoryId: selected.ref,
              anchor,
              thought: `scripted-ep${episodeIndex}-step1:${selected.originalId ?? selected.ref.slice(0, 8)}`,
            },
          };
        }
        return {
          value: {
            action: 'express',
            memoryId: selected.ref,
            anchor,
            expression: `脚本化候选(ep${episodeIndex})：` + anchor.slice(0, 24),
            ...(['C', 'B+T'].includes(condition)
              ? {thought: `scripted-ep${episodeIndex}-step${step}:${selected.originalId ?? selected.ref.slice(0, 8)}`}
              : {}),
          },
        };
      }
      const parsedUser = JSON.parse(messages[1].content);
      return {
        content: `脚本化回复[cond=${condition},ep=${episodeIndex},turn=${parsedUser.turn_index},topK=${parsedUser.passive_top_k_memories.length},thoughts=${parsedUser.tentative_thoughts.length}]`,
        elapsed_ms: 0,
        usage: null,
      };
    };
    const res = await runModelTimelineCondition(timeline, condition, condDir, {
      invoke,
      replay: paired,
      topK,
    });
    if (condition === 'C') paired = res;
    results.push(res);
  }
  return results;
}
