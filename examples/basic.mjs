import {CompanionMemory} from '../index.mjs';
import {DAY} from '../src/policy.mjs';

const now = Date.parse('2026-11-03T15:00:00+08:00');
const memory = new CompanionMemory({
  characterId: 'demo-character',
  scopeId: 'demo-owner',
  mode: 'companion',
}, {now: () => now});

const saved = memory.capture({
  id: 'first-rain',
  truth: 'observed',
  occurredAt: now - DAY,
  gist: '第一次一起听雨',
  tags: ['雨', '安静'],
  importance: 0.6,
  emotionalWeight: 0.2,
  evidence: [{id: 'demo-source-1', kind: 'shared_event', text: '那天窗外下着雨，我们都没说话。'}],
}, {mode: 'companion'});

const visible = memory.visible({mode: 'companion', trigger: 'cue', cue: '下雨'});
console.log(JSON.stringify({
  saved,
  visible: visible.map(({gist, detail, evidence}) => ({gist, detail, evidence})),
  modelCalls: 0,
}, null, 2));
await memory.close();
