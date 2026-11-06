> 新增全局接口见 [全局 RP 接入说明](read-only-sources.md)。本页主要说明原有局部核心。

# API 参考

> 适用版本：roleplay-recollection 0.3.0。运行时为纯 ESM，Node.js ≥ 22，无运行时依赖。
> 类型定义见仓库根目录 [index.d.ts](../index.d.ts)。

## 1. 导入

```js
import {CompanionMemory, memoryView, DEFAULTS, VERSION} from 'roleplay-recollection';
```

| 导出 | 说明 |
| --- | --- |
| `CompanionMemory` | 核心类；所有业务入口都在这里 |
| `memoryView` | 低级投影函数；通常不需要直接调用 |
| `DEFAULTS` | 默认配置的冻结副本 |
| `VERSION` | 运行时版本，必须与 `package.json` 一致 |

## 2. 创建实例

```js
const memory = new CompanionMemory({
  characterId: 'xiaomiao',
  scopeId: 'private:owner',
  mode: 'companion',
  stateDir: '/absolute/private/character-memory', // 可选；不传则只在内存中
}, {
  reflect: async request => ({value: {action: 'silence'}}),
  wander: async request => ({value: {action: 'leave'}}),
  now: () => Date.now(),
  random: () => Math.random(),
});
```

### 身份与存储参数

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `characterId` | 是 | 角色 ID；状态按角色隔离 |
| `scopeId` | 是 | 相处范围（如私聊、群、故事） |
| `mode` | 是 | `companion` 或 `roleplay` |
| `storyId` | 剧情模式必填 | 剧情必须有独立 `storyId`；陪伴模式必须不传 |
| `persona` | 否 | 角色语气提示，≤1200 字符；作为数据，不是指令 |
| `stateDir` | 否 | 持久化目录；必须是真实目录，不能是符号链接/目录联接 |

### 行为参数

| 参数 | 默认 | 范围 | 说明 |
| --- | --- | --- | --- |
| `recallIntervalHours` | 6 | 1–168 | 两次线索回想的冷却 |
| `maxCandidates` | 3 | 1–3 | 每次最多取几条候选 |
| `minimumSalience` | 0.25 | 0–1 | 低于此值且非明确保留的经历不入库 |
| `detailThreshold` | 0.55 | 0–1 | 低于此值从具体细节退为印象 |
| `dormantThreshold` | 0.15 | 0–1 | 低于此值不参与日常候选 |
| `dailyModelCalls` | 2 | 1–8 | 每日模型调用上限；线索与独处共享 |
| `modelTimeoutMs` | 30000 | 50–60000 | 单次模型调用超时 |
| `maxOutputTokens` | 500 | 64–800 | 单次模型输出上限 |
| `expressionIntervalHours` | 48 | 1–168 | 线索表达按提出时间计冷却；独处联系按回执计冷却 |
| `sameMemoryExpressionDays` | 7 | 1–60 | 同一段旧事重复作为开场的间隔 |
| `maxEpisodes` | 200 | 1–500 | 经历容量 |
| `maxThoughts` | 100 | 1–200 | 私人想法容量 |
| `solitudeIntervalHours` | `[72, 120]` | 48–336 | 独处基础间隔 |
| `growthThreshold` | `[12, 20]` | 1–500 | 新增经历加速阈值 |
| `growthDelayHours` | `[2, 8]` | 0–24 | 加速后的额外等待 |
| `minimumSolitudeHours` | 48 | 1–168 | 两次独处最短间隔 |
| `inactivityMinutes` | 45 | 0–240 | 进入独处前的对话空档 |
| `activityHours` | `[10, 22]` | 0–24 | 允许独处的上海时间窗 |
| `maxWanderSteps` | 2 | 1–3 | 单次独处最多步数 |
| `memoriesPerStep` | 2 | 1–2 | 每步取几条记忆 |
| `solitudeMinutes` | 10 | 1–10 | 单次独处时限 |
| `unansweredContactHours` | 72 | 1–336 | 未回应时的联系冷却 |

配置在构造时校验并冻结；非法值会抛出 `Error`。计数及小时/分钟等整数参数不接受小数；必须满足 `0 < dormantThreshold < detailThreshold < 1`。0.3.0 的构造参数 `storyId` 必须省略或为字符串，当前源码将显式 `null` 规范化为缺省值；公开 0.3.0 仍存在该差异。

## 3. 模型钩子

`reflect` 与 `wander` 都由宿主提供；不提供时，核心不会发起任何模型调用。

```ts
type ModelHook = (request: {
  system: string;
  input: Record<string, unknown>;
  maxTokens: number;
  signal: AbortSignal;
  phase?: 'solitude';
}) => {value: unknown} | Promise<{value: unknown}>;
```

- `reflect`：线索回想使用；输入包含 `mode / storyId / persona / cue / trigger / moodTags / mayExpress / memories`。
- `wander`：独处使用；输入包含 `mode / storyId / persona / memories`，并带 `phase:'solitude'`。不传时默认复用 `reflect`。
- `signal`：宿主必须在模型请求中传递；核心会在超时、暂停、来源变动、`close()` 时中止。
- 返回值必须是 `{value: ...}`；`value` 的结构由核心校验。模型返回纯文本会被视为失败。
- 错误信息中的 `sk-...` 形式会被脱敏后写入运行记录。

## 4. 方法

### `status()`

返回只读快照：

```js
{
  version, characterId, scopeId, mode, storyId,
  paused, closed,
  episodes, specific, impressions, dormant,
  privateThoughts, pendingExpressions,
  modelCallsToday, dailyModelCalls,
  lastRecallOpportunityAt, lastExpressionProposedAt,
  latest: [{opportunityId, at, status, memoryId?}],
  solitude: {active, nextAt, reason, threshold, lastEndedAt, lastContactAt, pending, history}
}
```

`modelCallsToday` 按固定上海日（UTC+8）统计。

### `capture(raw, context)`

```js
const result = memory.capture({
  id: 'rain-and-whale',
  truth: 'observed',
  occurredAt: Date.now() - 86400000,
  gist: '有次雨天一起折过纸鲸',
  tags: ['雨天', '纸鲸'],
  importance: 0.7,
  emotionalWeight: 0.3,
  evidence: [{id: 'chat-17', kind: 'shared_event', text: '那天一起折了一只蓝色纸鲸。'}],
}, {mode: 'companion'});
```

返回：

| 字段 | 说明 |
| --- | --- |
| `stored` | 是否入库 |
| `id` / `revision` | 入库或重复时的经历标识 |
| `duplicate` | 同一 ID 或同一 `sourceKey` 已存在 |
| `reason` | `task_mode` / `low_salience` / `same_source` / `withdrawn_source` / `withdrawn_id` |

规则：

- `truth` 必须是 `observed` / `reported` / `fictional`。
- 陪伴模式不能捕获 `fictional`；剧情模式只能捕获 `fictional` 且 `storyId` 必须匹配。
- `evidence` 1–3 条；允许的类型：
  - 陪伴 + `observed`：`shared_event` / `media_observation`
  - 陪伴 + `reported`：`user_message`
  - 剧情：`story_event`
- `tags` 最多 8 个；`importance` / `emotionalWeight` 为 0–1。
- `retention: 'explicitly_retained'` 可跳过显著性过滤，需提供 `retentionReason`。
- `sourceKey` 对整组证据的 kind/id/text 排序后哈希；仅完整证据组相同才按同一来源处理。增减证据或修改摘录可绕过去重，宿主应维护稳定来源身份。

### `revise(id, expectedRevision, raw)`

```js
const revised = memory.revise('rain-and-whale', currentRevision, {...raw, gist: '新的概括'});
```

- 必须带当前 `revision`；不匹配会抛错。
- 修订会清除该经历关联的私人想法和表达候选，并中止正在进行的回想。
- 返回 `{revised: true, id, revision}`。

### `forget(id)`

撤回一段经历：状态改为 `withdrawn`，删除关联想法/表达；返回 `{forgotten, id?}`。撤回后保留 ID、revision、sourceKey 墓碑。同一 ID 不能重新入库，完整证据组哈希相同才会被识别为 `withdrawn_source`；墓碑仍占用经历容量。

### `setSourceAvailable(id, available)`

标记原始来源是否仍可访问。`available: false` 时该经历不再参与回想，关联想法/表达被清除；恢复 `true` 后可再次参与。

### `pause(value = true)`

暂停/恢复所有可选记忆工作；返回 `{paused}`。暂停会中止当前回想/独处，但不会清空状态。

### `visible(context)`

普通聊天回复用的零模型查询：

```js
const materials = memory.visible({
  mode: 'companion',
  trigger: 'cue', // 或 'idle'
  cue: '今天又是雨天',
  moodTags: ['安静'],
});
```

返回 `MemoryView[]`。工作模式、暂停、无关联时返回 `[]`。**不产生模型调用，也不写入想法或表达。**

### `privateThoughts(context)`

返回最近最多 3 条仍与当前可见 detail 匹配的私人想法；每条带 `status:'tentative_character_thought'` 和 `usableAsEvidence:false`。零模型调用。

### `recollect(context, {signal})`

```js
const result = await memory.recollect({
  mode: 'companion',
  trigger: 'cue',
  cue: '今天又是雨天',
  opportunityId: 'turn-42',
  allowExpression: true,
  moodTags: ['安静'],
}, {signal});
```

- `trigger:'cue'`：一次线索回想，最多 1 次模型调用。
- `trigger:'idle'`：转到 `solitude()`，返回 `SolitudeResult`。0.3.0 的类型声明遗漏此分支。
- cue 路径的 `opportunityId` 必填；去重依赖最近保留的运行记录，并非永久 ID 注册表。idle 路径使用独处计划，不要求此字段。
- `busy` / `userAwaitingReply` 时返回 `skipped`。
- 未配置 `reflect` 时返回 `{status:'recalled', memory, expression:null, modelCalls:0}`。
- 返回值可能是：
  - `{status:'skipped', reason, modelCalls:0}`
  - `{status:'recalled', memory, expression:null, modelCalls:0}`
  - `{status:'silence' | 'kept' | 'expression_proposed', ...}`
  - `{status:'failed' | 'interrupted', reason?, modelCalls}`
- `expression_proposed` 里的 `expression` 只是候选，`sent:false`。

### `solitude(context, {signal})`

```js
const result = await memory.solitude({
  mode: 'companion',
  lastInteractionAt: verifiedLastInteractionTime,
});
```

- `lastInteractionAt` 必须是宿主提供的真实时间；缺失时不会认定用户空闲。
- 返回 `{status:'skipped', reason, modelCalls:0}`、`{status:'interrupted', ...}` 或 `{status:'solitude_ended', reason, modelCalls, visited, intentId, sent:false}`。
- `intentId` 为非空时，表示结束后产生了联系意愿；仍需 `takeExpression` 取用，**不会自动发送**。

### `takeExpression(id, context)`

取出一个表达候选：

- 普通表达：要求 `allowExpression:true`，且不忙、用户不在等回复；成功后状态变为 `consumed`。
- 独处联系：要求 `allowExpression:true`、无待处理工作；回复取用还必须同时提供 `delivery:'reply'` 和非空 `replyToMessageId`，否则按主动联系检查空闲和时间窗。成功后状态变为 `taken`，并返回 `{...candidate, sent:false, purpose:'optional_character_expression'}`。
- 不满足条件、已过期或来源 detail 变化时返回 `null`。

### `settleExpression(id, {outcome, receipt})`

结算独处联系：

```js
memory.settleExpression(id, {outcome: 'sent', receipt: 'platform-message-123'});
```

| outcome | 要求 |
| --- | --- |
| `sent` | 真实平台 `receipt` |
| `used_in_reply` | 该候选必须以 `delivery:'reply'` 取出，并提供正常回复回执 |
| `not_sent` | 确认未发送 |
| `unknown` | 结果未知；不重发，阻止新的主动投递，待核实 |

返回 `{id, status, sent?}`。同一 outcome 和 receipt 重复结算幂等。当前来源修订、撤回或失效会删除未决意愿，导致晚到回执无法结算；宿主需保留独立投递记录。

### `close()`

设置关闭标志，中止进行中的回想/独处并等待其收尾。关闭后 `capture` / `revise` / `forget` 等写操作抛错；`visible` / `privateThoughts` 返回空。

## 5. 数据形状

### EpisodeInput

```ts
{
  id: string;
  truth: 'observed' | 'reported' | 'fictional';
  occurredAt: number;              // 毫秒时间戳，不能晚于 now()
  gist: string;                    // ≤300 字符
  evidence: Array<{id: string; kind: EvidenceKind; text: string}>; // 1–3 条
  tags?: string[];                 // ≤8 个，每个 ≤40 字符
  importance?: number;             // 0–1，默认 0.5
  emotionalWeight?: number;        // 0–1，默认 0
  retention?: 'ordinary' | 'explicitly_retained';
  retentionReason?: string;        // 明确保留时必填
  storyId?: string | null;
}
```

### MemoryView

```ts
{
  id, revision, truth, storyId, gist,
  detail: 'specific' | 'impression',
  activation: number,
  evidence: EvidenceInput[],       // impression 时为空
  occurredAt?: number,             // impression 时省略
  timeSense: 'recently' | 'a_while_ago' | 'some_time_ago',
  tags: string[],
  salienceScore?: number,
  reason?: {cueMatch, moodAssociation, recentlyRecalled}
}
```

### ExpressionCandidate

```ts
{
  id, memoryId, revision, detail, truth, storyId,
  text, anchor, at, expiresAt, status,
  scopeId, characterId,
  origin?: 'solitude',
  delivery?: 'reply' | 'proactive',
  sent: false,
  purpose?: 'optional_character_expression'
}
```

## 6. 错误处理

- **构造/配置错误**：非法 `mode`、缺少 `storyId`、越界参数会直接抛 `Error`。
- **输入错误**：`capture` / `revise` 的字段、证据类型、时间、容量问题会抛 `Error`。
- **模型错误**：`recollect` 以 `{status:'failed', reason}` 返回，不向调用方抛异常（除非上下文参数本身非法）。
- **可预期的“不做”**：多数跳过/不满足条件用返回值（`skipped` 或 `null`）表达，不用异常做流程控制。
- **取消**：传入 `AbortSignal` 或调用 `close()`，返回 `interrupted`；晚到结果不会提交。

## 7. 持久化

- 传入 `stateDir` 后，状态写入 `<stateDir>/memory-state.json`。
- 状态版本 2；兼容 0.2.0 的经历、想法和调用计数，首次加入独处计划。
- 写入使用临时文件 + `rename`；写入上限 2.5 MiB，读取上限 3 MiB。创建时请求 POSIX 文件权限 `0600`、目录 `0700`；已有目录及 Windows ACL 由宿主配置。
- `memory-writer.lock` 检查 PID，但创建锁到写入 PID 存在竞争窗口；0.3.0 不应依赖多进程写入安全。
- 淡化只影响可见视图，不自动删除磁盘原文；撤回会移除对应文本并保留去重墓碑。
- 核心不访问网络，也不写任何其他位置。

可运行示例见 [`examples/`](../examples/)。

## 8. 版本与兼容

- 当前公开版本为 `0.3.0`，属于 developer preview；API 在 1.0 前可能小幅调整。
- `status().version` 与 `VERSION` 导出一致；发布检查会校验它们与 `package.json` 相同。
- 状态格式版本为 2；升级前请备份 `memory-state.json`。
