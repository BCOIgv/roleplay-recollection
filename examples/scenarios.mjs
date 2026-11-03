import {CompanionMemory} from '../index.mjs';
import {DAY} from '../src/policy.mjs';

export async function scenarios() {
  let now = Date.parse('2026-11-02T15:00:00+08:00'), calls = 0;
  const core = new CompanionMemory({characterId: 'xiaomiao', scopeId: 'demo-owner', mode: 'companion',
    persona: '小喵，话少一点，亲近、俏皮，偶尔想起一起经历的小事。'}, {
    now: () => now, random: () => 0,
    // Scripted decisions demonstrate the core contract, not live LLM quality.
    reflect: async ({input}) => {
      calls++;
      const memory = input.memories[0];
      return {value: {
        action: input.mayExpress ? 'express' : 'keep', memoryId: memory.id, anchor: memory.gist,
        thought: '纸鲸和雨天好像在这个角色心里连到了一起。这个联系只是刚刚的想法。',
        expression: memory.detail === 'specific'
          ? '又下雨了，想起咱们上次折的那只蓝色纸鲸，尾巴还歪着呢'
          : '下雨就有点想起以前一起折纸鲸那次，细节有些模糊了',
      }};
    },
  });
  const saved = core.capture({id: 'rain-and-whale', truth: 'observed', occurredAt: now - DAY,
    gist: '有次雨天一起折过纸鲸', tags: ['雨天', '纸鲸'], importance: 0.7, emotionalWeight: 0.3,
    evidence: [{id: 'synthetic-shared-17', kind: 'shared_event', text: '那天一起折了一只蓝色纸鲸，尾巴歪了。'}],
  }, {mode: 'companion'});
  const context = {mode: 'companion', trigger: 'cue', cue: '今天又是雨天', allowExpression: true};
  const task = await core.recollect({mode: 'task'}), taskCalls = calls;
  const first = await core.recollect({...context, opportunityId: 'shared-rain-1'});
  now += 35 * DAY;
  const faded = core.visible(context)[0];
  const privateMoment = await core.recollect({...context, opportunityId: 'rain-later', allowExpression: false});
  const privateThoughts = core.privateThoughts(context);
  now += 365 * DAY;
  const dormant = await core.recollect({...context, opportunityId: 'much-later'});
  const report = {
    purpose: '角色陪伴场景中的少量拟人化记忆与回忆',
    evidence: '合成经历和脚本化判断，仅验证核心行为，不代表真实用户数据或真人聊天效果',
    capture: saved,
    taskMode: {...task, actualModelCalls: taskCalls},
    relatedCue: {status: first.status, expression: first.expression?.text, sent: first.sent},
    after35Days: {detail: faded.detail, visibleGist: faded.gist, visibleEvidence: faded.evidence},
    privateRecollection: {status: privateMoment.status, expression: privateMoment.expression, thoughts: privateThoughts},
    after400Days: {status: dormant.status, reason: dormant.reason},
    externalModelCalls: 0, scriptedReflectionCalls: calls, messagesSent: 0,
  };
  await core.close();
  return report;
}

console.log(JSON.stringify(await scenarios(), null, 2));
