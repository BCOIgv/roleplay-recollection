import crypto from 'node:crypto';
import {DAY, text, fraction, tags} from './policy.mjs';

export const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const key = (s, name) => text(s, 100, name);

export function episode(input, cfg, now) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('A structured experience is required');
  const id = key(input.id, 'episode ID');
  if (!['observed', 'reported', 'fictional'].includes(input.truth)) throw new Error('Episode truth must be observed, reported or fictional');
  if (cfg.mode === 'companion' && input.truth === 'fictional' ||
      cfg.mode === 'roleplay' && (input.truth !== 'fictional' || input.storyId !== cfg.storyId)) {
    throw new Error('Keep real companion experiences and story events in their own contexts');
  }
  if ((input.storyId ?? null) !== cfg.storyId) throw new Error('Episode belongs to another story');
  if (!Number.isSafeInteger(input.occurredAt) || input.occurredAt < 0 || input.occurredAt > now) {
    throw new Error('Invalid or future episode time');
  }
  if (!Array.isArray(input.evidence) || input.evidence.length < 1 || input.evidence.length > 3) {
    throw new Error('Provide one to three original evidence excerpts');
  }
  const allowed = cfg.mode === 'roleplay' ? ['story_event']
    : input.truth === 'reported' ? ['user_message']
      : ['shared_event', 'media_observation'];
  const evidence = input.evidence.map(item => {
    if (!item || !allowed.includes(item.kind)) {
      throw new Error('Private thoughts and generated recollections are not source experiences');
    }
    return {id: key(item.id, 'evidence ID'), kind: item.kind, text: text(item.text, 800, 'evidence excerpt')};
  });
  const importance = fraction(input.importance ?? 0.5, 'importance');
  const emotionalWeight = fraction(input.emotionalWeight ?? 0, 'emotionalWeight');
  const item = {
    id,
    truth: input.truth,
    storyId: cfg.storyId,
    occurredAt: input.occurredAt,
    sourceIds: evidence.map(entry => hash(JSON.stringify([entry.kind, entry.id]))).sort(),
    sourceKey: hash(JSON.stringify(
      evidence
        .map(entry => [entry.kind, entry.id, entry.text])
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    )),
    gist: text(input.gist, 300, 'episode gist'),
    evidence,
    tags: tags(input.tags),
    importance,
    emotionalWeight,
    // Caller-supplied salience is a character setting, not inferred human emotion.
    retention: input.retention ?? 'ordinary',
  };
  if (!['ordinary', 'explicitly_retained'].includes(item.retention)) throw new Error('Invalid retention');
  if (item.retention === 'explicitly_retained') {
    item.retentionReason = text(input.retentionReason, 200, 'explicit retention reason');
  }
  item.revision = hash(JSON.stringify(item));
  return item;
}

export function memoryView(record, cfg, now) {
  if (record.status !== 'active') return null;
  const ageDays = Math.max(0, now - record.occurredAt) / DAY;
  const initial = 0.45 + 0.4 * record.importance + 0.15 * record.emotionalWeight;
  const halfLifeDays = 7 + 21 * record.importance + 14 * record.emotionalWeight;
  const base = initial * Math.pow(0.5, ageDays / halfLifeDays);
  const lastRecalled = record.lastRecalledAt;
  const reinforcement = record.rehearsalBoost * Math.pow(0.5, Math.max(0, now - (lastRecalled ?? now)) / DAY / halfLifeDays);
  const activation = record.retention === 'explicitly_retained' ? initial : Math.min(initial, base + reinforcement);
  if (activation < cfg.dormantThreshold) return null;
  const detail = record.detailFaded
    || (record.retention !== 'explicitly_retained' && activation < cfg.detailThreshold)
    ? 'impression'
    : 'specific';
  return {
    id: record.id, revision: record.revision, truth: record.truth, storyId: record.storyId,
    gist: record.gist, detail, activation: Number(activation.toFixed(4)),
    evidence: detail === 'specific' ? record.evidence.map(e => ({...e})) : [],
    ...(detail === 'specific' ? {occurredAt: record.occurredAt} : {}),
    timeSense: ageDays < 2 ? 'recently' : ageDays < 14 ? 'a_while_ago' : 'some_time_ago',
    tags: record.tags,
  };
}

function tokens(raw) {
  const value = String(raw).toLowerCase();
  const result = new Set(value.match(/[a-z0-9]{2,}/g) || []);
  for (const run of value.match(/[\u3400-\u9fff]+/g) || []) {
    if (run.length === 1) result.add(run);
    for (let i = 0; i < run.length - 1; i++) result.add(run.slice(i, i + 2));
  }
  return result;
}

export function candidates(records, context, cfg, now) {
  const cueTokens = tokens(context.cue);
  return records.flatMap(record => {
    const memory = memoryView(record, cfg, now);
    if (!memory) return [];
    const material = tokens(memory.gist + ' ' + memory.tags.join(' ') + ' ' + memory.evidence.map(e => e.text).join(' '));
    let matches = 0;
    for (const token of cueTokens) if (material.has(token)) matches++;
    const cueMatch = cueTokens.size ? Math.min(1, matches / Math.max(1, Math.min(cueTokens.size, 4))) : 0;
    if (context.trigger === 'cue' && cueMatch === 0) return [];
    const recent = record.lastRecalledAt !== null && now - record.lastRecalledAt < 7 * DAY;
    const sameMood = context.moodTags.some(tag => memory.tags.includes(tag)) ? 1 : 0;
    const score = context.trigger === 'cue'
      ? cueMatch * 0.65 + memory.activation * 0.25 + sameMood * 0.1
      : memory.activation * 0.55 + record.importance * 0.2 + record.emotionalWeight * 0.1 + sameMood * 0.15;
    return [{...memory, salienceScore: Number((score * (recent ? 0.55 : 1)).toFixed(4)),
      reason: {cueMatch, moodAssociation: sameMood === 1, recentlyRecalled: recent}}];
  }).sort((a, b) => b.salienceScore - a.salienceScore || a.id.localeCompare(b.id))
    .slice(0, cfg.maxCandidates);
}

export function rehearse(record, cfg, now) {
  const view = memoryView(record, cfg, now);
  if (!view) return;
  if (view.detail === 'impression') record.detailFaded = true;
  if (record.lastRecalledAt === null || now - record.lastRecalledAt >= DAY) {
    record.rehearsalBoost = Math.min(0.1, record.rehearsalBoost + 0.02);
  }
  record.lastRecalledAt = now;
  record.recallCount++;
}

export function wanderMemories(records, cfg, now, random, {focus = null, visited = [], direction = 'switch'} = {}) {
  const eligible = records.flatMap(record => {
    const view = memoryView(record, cfg, now);
    return view ? [{record, view}] : [];
  });
  if (direction === 'linger' && focus) {
    const current = eligible.find(x => x.view.id === focus.id && x.view.revision === focus.revision);
    return current ? [current.view] : [];
  }
  const pool = eligible.filter(x => !visited.includes(x.view.id));
  const focusTokens = tokens(focus ? focus.gist + ' ' + focus.tags.join(' ') : '');
  const weighted = pool.map(({record, view}) => {
    const words = tokens(view.gist + ' ' + view.tags.join(' '));
    const overlaps = [...focusTokens].filter(t => words.has(t)).length;
    const recent = record.lastWanderSeenAt != null && now - record.lastWanderSeenAt < 7 * DAY;
    return {view, weight: (0.8 + record.importance * 0.2) * (recent ? 0.25 : 1) *
      (direction === 'follow' ? 1 + Math.min(3, overlaps) : 1)};
  });
  const chosen = [];
  while (chosen.length < cfg.memoriesPerStep && weighted.length) {
    const draw = random();
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Invalid random sample');
    let position = draw * weighted.reduce((n, x) => n + x.weight, 0), index = 0;
    while (index < weighted.length - 1 && position >= weighted[index].weight) position -= weighted[index++].weight;
    chosen.push(weighted.splice(index, 1)[0].view);
  }
  return chosen;
}
