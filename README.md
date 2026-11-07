# 朝花夕拾 · Roleplay Recollection

**AI 角色的独处回忆与主动表达**

朝花夕拾是**已有记忆之上的 AI 角色回忆行为层**。

相处时留下的经历，可以在对话停下来之后，被角色重新拾起：在一段往事上停留，顺着一点关联想起别的事，或者什么也不说，安静结束。如果形成了想分享的内容，再交给宿主择机表达。

「朝花夕拾」借拾起旧日片段的意象，描述这种发生在对话间隙的回忆。项目面向 AI 伴侣与角色扮演开发者，在已有记忆之上组织**何时回想、如何漫游、是否表达**；长期保存与按问题检索可以继续由原记忆系统承担。

Idle recollection, mind-wandering, and optional outreach for AI characters. Node.js / JavaScript，提供 TypeScript 类型声明；包名：`roleplay-recollection`。

[![CI](https://github.com/BCOIgv/roleplay-recollection/actions/workflows/ci.yml/badge.svg)](https://github.com/BCOIgv/roleplay-recollection/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22.16-3c873a)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[English](README.en.md) · [核心特性](#核心特性) · [与其他记忆插件的区别](#与其他记忆插件的区别) · [快速开始](#快速开始) · [已有记忆库接入](docs/read-only-sources.md)

> **开发预览**：当前 `main` 包含尚未发布的功能与修复。公开 **v0.3.0** 是较早的快照，不包含全局来源接入；安装方式与功能范围见[版本选择](#版本选择与安装)。

核心提供回忆策略与状态管理。宿主提供空闲状态、调用时机和模型执行器，并决定实际投递；独立安装核心不会自动启动后台进程或发送消息。这里的“独处”与“想法”指角色行为模拟。

## 核心特性

- **对话之外的回忆机会**：宿主报告空闲状态后，模块按持久化机会、活动时间窗与预算判断能否进入独处。漫游无需围绕当前问题展开，也没有必须总结、解决任务或发消息的要求。
- **可以停留、联想、换念头，也可以离开**：通过 `linger / follow / switch / leave` 组织有限步数的漫游。局部核心以词面和标签重叠辅助关联选取。
- **回想与表达分开**：一次回想可以留下暂定私人想法，也可以没有任何内容产出。想法不会自动成为新的经历或事实；宿主可在后续对话中取用仍有效的想法。
- **从旧事形成表达意愿**：出现想分享的内容时，生成一条短表达候选。宿主可以将它融入正常回复，或在允许的窗口主动联系；独处联系通过实际回执结算，未知投递结果不会自动重发。
- **旧事有来源，也有可见边界**：回想使用当前可见材料，保留亲历、转述与剧情标签；局部经历可以从引文淡成印象。来源修订、撤回或失效会影响相应派生内容。
- **节奏受控，对话优先**：默认单次漫游最多 2 步，与线索回想共享每日 2 次模型调用预算。宿主传入忙碌、等待回复或待办状态时，会阻止进入独处；进行中的工作需由宿主传递取消或更新状态。

行为链：**已有经历 → 空闲机会 → 有界漫游 → 安静结束 / 暂定想法 / 表达候选 → 宿主择机取用与投递**。

局部核心自带轻量经历记录；当前源码另支持只读接入 JSON、JSONL、SQLite。无需为了试用回忆策略迁移全部资料。核心为纯 ESM，无运行时第三方依赖。

## 与其他记忆插件的区别

长期记忆关心哪些信息值得保存、如何更新与找回。朝花夕拾聚焦一条角色行为路径：**当前没有问题要回答时，旧事能否被重新想起，又是否形成一句想说的话。**

| 组件或机制 | 公开能力与主要关注点 | 与朝花夕拾的关系 |
| --- | --- | --- |
| 常规 RAG / 向量检索 | 围绕查询找到相关材料，为回答提供上下文；可由上层应用扩展触发策略 | 可作为材料来源。朝花夕拾组织独处机会、漫游和表达候选，不替代检索基础设施 |
| [Mem0](https://docs.mem0.ai/core-concepts/how-it-works) | 记忆抽取与检索；其 [Platform Dream](https://docs.mem0.ai/platform/features/dream) 还提供后台模式归纳、旧事实处理与去重 | 有记忆处理能力的重叠。朝花夕拾侧重角色回忆过程与表达意愿，而非以整理用户事实为目标；具体接入仍需来源映射或适配 |
| [Letta dreaming](https://docs.letta.com/configuration/memory) | 后台回顾对话、提炼经验并更新持久记忆 | 后台处理不属于本项目独有。朝花夕拾将允许无产出的角色漫游、暂定想法和可选表达作为独立策略模块 |
| [空闲提示](https://github.com/SillyTavern/Extension-Idle) / [主动聊天扩展](https://github.com/mattjaybe/SillyTavern-EchoText) | 已有空闲续聊、主动联系以及旧事触发等能力 | “主动说话”也有现成实现。本项目聚焦可复用的回忆—想法—表达候选流程及投递结算，而非提供完整聊天界面 |

以上比较说明侧重点，不表示其他系统无法实现同类策略。朝花夕拾适合已有角色、记忆与宿主，希望尝试**对话间隙的往事回想与偶尔分享**的开发者。只需要事实记忆、知识问答或定时问候时，优先使用对应组件即可。真实模型自然度及相对简单定时提示的体验收益仍待验证。

## 能力与研究状态

| 状态 | 内容 |
| --- | --- |
| 当前已实现 | 有界回忆、暂定想法存取、表达候选与投递结算；想法需由宿主显式取用，不自动进入后续漫游或回复 |
| 建议调整，尚未实施 | 统一结束语义、硬上界内的自愿收束、动态预算与短会话状态，见[漫游边界研究](docs/wandering-boundaries.md)；当前默认值保留 |
| 仍待验证 | 相比简单定时提示的自然度、经历贴合与保留意愿，以及增益能否抵消成本和集成负担，见[分阶段测试计划](docs/evaluation-plan.md) |

## 快速开始

### 1. 先看一段独处回忆

准备 **Node.js ≥ 22.16** 和 Git，然后运行当前源码中的示例：

```bash
git clone https://github.com/BCOIgv/roleplay-recollection.git
cd roleplay-recollection
node examples/solitude.mjs
```

示例先记录几段共同经历，再通过可控时钟进入回忆机会：从雨天联想到曾经给纸鲸起名的玩笑，形成一句想分享的话；用户等待回复时取用返回 `null`，之后在允许的空闲状态下返回表达候选。

输出中可检查 `result.reason: "wants_contact"`、`whileUserWaiting: null`、`laterCandidate.sent: false`。示例使用**脚本化模型与模拟时间**，无需 API Key，不会发送消息，也不能作为真实模型自然度的证据。想先了解记录和检索接口，可另运行 `node examples/basic.mjs`。

### 2. 理解输入：一段有来源的经历

在克隆后的仓库根目录新建 `quickstart.mjs`，粘贴以下完整代码：

```js
import {CompanionMemory} from './index.mjs';

const memory = new CompanionMemory({
  characterId: 'reading-companion',
  scopeId: 'private:demo-user',
  mode: 'companion',
});

try {
  const saved = memory.capture({
    id: 'rainy-reading',
    truth: 'observed',
    occurredAt: Date.now() - 3600000,
    gist: '雨天一起读了《小王子》',
    tags: ['雨天', '阅读'],
    evidence: [{
      id: 'message-001',
      kind: 'shared_event',
      text: '窗外下着雨，我们一起读了《小王子》。',
    }],
  }, {mode: 'companion'});

  const memories = memory.visible({
    mode: 'companion',
    trigger: 'cue',
    cue: '小王子',
  });

  console.log(JSON.stringify({
    stored: saved.stored,
    memories: memories.map(({gist, detail}) => ({gist, detail})),
    modelCalls: memory.status().modelCallsToday,
  }, null, 2));
} finally {
  await memory.close();
}
```

运行 `node quickstart.mjs`，预期输出：

```json
{
  "stored": true,
  "memories": [
    {
      "gist": "雨天一起读了《小王子》",
      "detail": "specific"
    }
  ],
  "modelCalls": 0
}
```

### 3. 接入真实角色宿主

启用真实独处回忆需要宿主提供三部分：可见经历、`wander` 模型钩子，以及带真实空闲状态的 `solitude()` 调用。宿主还需接收表达候选，并在实际使用后通过 `settleExpression()` 结算。无交互时的调度持续运行在宿主中；本模块自身不轮询聊天平台。模型钩子见 [API](docs/api.md#3-模型钩子)，完整生命周期见[独处设计](docs/solitude.md)。

在生成回复前，以当前消息作为 `cue` 调用 `visible()`，将返回的 `memories` 作为参考数据交给回复模型，保留 `truth` 与 `detail`；只有实际返回的 `evidence` 才能用作原文引述。对话结束后，由应用整理值得保留的经历并调用 `capture()`。

需要跨重启保存时，在构造参数中添加 `stateDir: './data/reading-companion'`。不同角色、私聊、群聊或剧情应分配独立实例和目录。省略 `stateDir` 时数据仅驻留内存，适合运行示例。

`capture()` 接受带证据的结构化经历，聊天记录的采集和摘要由宿主提供。完整参数见 [API 参考](docs/api.md)。

## 版本选择与安装

| 入口 | 适合用途 | 功能范围 |
| --- | --- | --- |
| 当前 `main` 源码 | 体验最新实现、开发集成 | 局部核心、只读来源、全局 RP，以及未发布修复 |
| [GitHub Release v0.3.0](https://github.com/BCOIgv/roleplay-recollection/releases/tag/v0.3.0) | 固定版本复现、评估旧接口 | 局部核心与旧 DSH Bundle；已知问题见[历史验证记录](docs/verification.md#公开-v030-的历史验证) |

**当前源码**：按快速开始克隆仓库，示例通过相对路径导入。工程检查与 TypeScript 开发需要先运行 `npm ci`。

**公开 v0.3.0 核心包**：在你的 Node.js 项目目录执行：

```bash
npm install https://github.com/BCOIgv/roleplay-recollection/releases/download/v0.3.0/roleplay-recollection-0.3.0.tgz
```

然后将示例中的导入改为：

```js
import {CompanionMemory} from 'roleplay-recollection';
```

公开包以 Release tarball 提供。按包名执行 `npm install roleplay-recollection` 尚未作为可用安装入口提供；最新发布信息以 [Releases](https://github.com/BCOIgv/roleplay-recollection/releases) 为准。v0.3.0 不导出当前源码新增的 `GlobalMemoryLibrary`、`GlobalRecollection` 和来源初始化接口。

## 回忆材料与支持接口

局部核心以**经历**为单位保存回忆材料：每段经历包含概要、时间、标签及 1–3 条原始引文。这部分提供轻量的长期记忆（long-term memory）与情景记忆（episodic memory）能力，供回想使用，也可以单独调用：

1. **记录**：宿主整理亲历、转述或剧情事件，核心校验结构化输入后保存。
2. **召回**：当前话题通过词面与标签匹配，选出相关且仍可见的经历。
3. **淡化**：普通经历随时间从具体细节变成印象，最终退出日常召回；明确保留的经历按保留策略处理。
4. **可选回想**：宿主注入模型钩子后，可生成暂定想法或表达候选；来源修订、撤回和失效会影响派生内容。

淡化调整的是提供给模型的可见内容，原始证据仍可能保存在本地状态中。删除和撤回请使用相应接口，详见 [API](docs/api.md) 与[安全说明](SECURITY.md)。

### API 与模型调用成本

下表对应局部核心 `CompanionMemory`：

| API | 用途 | 额外模型调用 |
| --- | --- | --- |
| `capture` / `revise` / `forget` | 记录、修订、撤回经历 | 0 |
| `visible` / `privateThoughts` | 获取可见记忆或仍有效的暂定想法 | 0 |
| `recollect({trigger: 'cue'})` | 按线索回想，可选生成想法或表达候选 | 0 或 1 |
| `solitude` / `recollect({trigger: 'idle'})` | 到期且空闲时进行低步数漫游 | 默认每次最多 2，受每日预算约束 |
| `takeExpression` / `settleExpression` | 取用表达候选，结算独处联系回执 | 0 |

每日模型调用预算默认是 **2 次**，线索回想与独处共享。未提供 `reflect` / `wander` 时，不会调用模型。核心不保存供应商 API Key；宿主实现模型请求并处理取消信号，见[模型钩子](docs/api.md#3-模型钩子)。

### 独处与表达候选

独处由宿主调度：默认基础机会间隔为 72–120 小时，并检查空闲时长和活动时间窗；新增经历可以加速机会。模型可以继续联想，也可以直接结束。

表达先作为候选交给宿主，由宿主决定是否用于回复或主动联系。独处联系需通过真实投递回执结算。[独处示例](examples/solitude.mjs) 使用脚本化模型，不会请求真实模型或发送消息；完整规则见[独处设计](docs/solitude.md)。

## 接入已有记忆库与 DSH

### 已有 JSON、JSONL 或 SQLite 资料

**仅当前源码提供**：登记只读外部来源，验证字段映射，再经宿主授权进行全局检索与角色回想。外部资料由原系统维护，映射和运行状态保存到本插件自己的目录。

宿主需要提供可信身份、受众权限及模型服务。当前读取采用有大小与条数上限的快照，查询采用文字包含匹配。接入步骤与限制见[只读来源与全局 RP 指南](docs/read-only-sources.md)；离线流程可运行：

```bash
node examples/global.mjs
```

### DSH 插件

仓库同时提供 `roleplay-recollection-dsh` Bundle：

| 模式 | 入口与能力 |
| --- | --- |
| 局部模式 | 11 个工具，操作一个配置好的角色与范围；公开 v0.3.0 提供此模式 |
| 全局模式 | 当前源码新增 9 个工具，支持外部来源查询、回想与独处；需要可信宿主服务桥接 |

旧局部 Bundle 提供记录与检索工具，未注入模型执行器，也未暴露独处工具。全局模式通过宿主服务接入模型与权限。安装两包、配置范围及服务要求见 [DSH 接入说明](dsh/README.md)。

## 常见问题

**需要向量数据库、embedding 或模型 API Key 吗？** 记录和常规检索可直接在本地运行。开启模型回想或独处生成时，才需要宿主提供模型钩子；本地还是远程模型由宿主决定。

**能直接装到 SillyTavern，或者作为 MCP Server 使用吗？** 本仓库提供 Node.js 核心库和 DSH Bundle。SillyTavern 扩展、独立 MCP Server 及其他平台适配器需要另行实现。

**为什么查不到刚保存的经历？** 先检查 `capture()` 返回的 `stored` 和 `reason`，再确认 `mode`、`storyId` 与配置一致，线索能匹配概要、标签或当前可见引文。重复来源、显著性不足、暂停、来源失效或已休眠也会影响结果。局部核心默认最多保存 200 条经历，可配置到 500 条。

**生产接入需要完成什么？** 宿主负责会话路由、权限、经历提取、回复上下文、可选任务调度、模型调用和消息投递。状态文件未加密，目录权限需按宿主环境配置。真实 DSH 服务桥接、真实模型自然度和长期运行仍需单独验收；已验证范围见[验证说明](docs/verification.md)。

## 开发与贡献

在仓库根目录执行：

```bash
npm ci
npm run verify
npm run check:types
npm run release:check
npm run verify:consumer
```

验证包含离线测试、合成示例、类型检查和实际打包安装检查。通过 [Issues](https://github.com/BCOIgv/roleplay-recollection/issues) 提交复现步骤、来源格式或宿主接入需求，贡献前阅读[贡献指南](CONTRIBUTING.md)。

## 进一步阅读

| 文档 | 内容 |
| --- | --- |
| [API 参考](docs/api.md) | 局部核心配置、方法、模型钩子与返回值 |
| [只读来源与全局 RP](docs/read-only-sources.md) | 来源映射、授权、全局运行与 DSH 服务契约 |
| [架构设计](docs/architecture.md) | 数据与宿主的职责边界 |
| [独处设计](docs/solitude.md) | 机会调度、漫游与投递结算 |
| [漫游边界研究](docs/wandering-boundaries.md) | 当前限制、候选优化与待讨论参数 |
| [独立价值测试计划](docs/evaluation-plan.md) | 对照、消融、评分、成本与阶段判据 |
| [命名与展示规范](docs/naming.md) | 品牌、副标题、GitHub 简介与 Topics |
| [验证说明](docs/verification.md) | 当前源码与公开 v0.3.0 的验证范围 |
| [变更记录](CHANGELOG.md) | 已发布版本与未发布改动 |

[MIT](LICENSE) © 2026 AI Roleplay Recollection contributors
