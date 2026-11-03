import {CompanionMemory} from '../index.mjs';

let now = Date.parse('2026-11-03T15:00:00+08:00'), scriptedCalls = 0;
const core = new CompanionMemory({characterId: 'xiaomiao', scopeId: 'demo-owner', mode: 'companion',
  solitudeIntervalHours: [72, 72], memoriesPerStep: 1,
}, {now: () => now, random: () => 0, wander: async ({input}) => {
  scriptedCalls++;
  const memory = input.memories[0];
  return {value: scriptedCalls === 1
    ? {action: 'follow', memoryId: memory.id, anchor: memory.gist, thought: '雨天和那个小玩笑，好像有一点联系。'}
    : {action: 'leave', memoryId: memory.id, anchor: memory.gist, shareText: '突然又想起你给纸鲸起的那个名字，还是觉得好笑'}};
}});
try {
  for (const [id, gist] of [['rain', '聊过窗外的雨'], ['whale', '给纸鲸起过一个好笑的名字'], ['music', '曾聊过一首轻快的歌']]) {
    core.capture({id, gist, occurredAt: now, truth: 'observed', importance: 0.6, tags: ['一起聊天'],
      evidence: [{id: 'synthetic-' + id, kind: 'shared_event', text: gist}]}, {mode: 'companion'});
  }
  const before = await core.solitude({mode: 'companion', lastInteractionAt: now - 3600000});
  now = core.status().solitude.nextAt;
  const result = await core.solitude({mode: 'companion', lastInteractionAt: now - 3600000});
  const wait = core.takeExpression(result.intentId, {mode: 'companion', allowExpression: true,
    userAwaitingReply: true, lastInteractionAt: now});
  const candidate = core.takeExpression(result.intentId, {mode: 'companion', allowExpression: true,
    lastInteractionAt: now - 3600000});
  console.log(JSON.stringify({synthetic: true, before, result, activeAfterEnd: core.status().solitude.active,
    whileUserWaiting: wait, laterCandidate: candidate, lastConfirmedContact: core.status().solitude.lastContactAt,
    scriptedCalls, externalModelCalls: 0, qqMessagesSent: 0}, null, 2));
} finally {await core.close();}
