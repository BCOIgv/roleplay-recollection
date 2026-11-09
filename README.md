# 朝花夕拾 · Roleplay Recollection

**AI 角色的独处回忆与主动表达**

朝花夕拾是**已有记忆之上的 AI 角色回忆行为层**。宿主在对话间隙调用它，让角色从可见经历中回想、停留或继续取材；结果可以是安静结束、暂定想法或一句表达候选。宿主控制时机、打断、后续回复上下文和消息投递。

“朝花夕拾”取重新拾起过往片段之意。本项目提供 Node.js ESM 核心库、TypeScript 声明和 DSH Bundle，面向已有角色与记忆系统的开发者。核心没有后台调度器，安装后不会自行调用模型或发送消息。

[![CI](https://github.com/BCOIgv/roleplay-recollection/actions/workflows/ci.yml/badge.svg)](https://github.com/BCOIgv/roleplay-recollection/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22.16-3c873a)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[English](README.en.md) · [快速开始](#快速开始) · [评估结果](evaluation/results/README.md) · [API](docs/api.md) · [文档索引](docs/README.md)

> 开发预览：当前 `main` 包含未发布的全局来源接口和修复；仓库包版本仍为 `0.3.0`。历史 [v0.3.0 Release](https://github.com/BCOIgv/roleplay-recollection/releases/tag/v0.3.0) 的内容较早，不能用它复现当前全部功能。

## 核心特性

- **独处机会与有限漫游**：检查空闲状态、活动窗口、机会和预算。无需指定产出任务，允许零想法、零表达结束。
- **想法与投递分离**：暂定想法和表达候选分别保存。想法不会自动进入后续漫游或回复；宿主须显式取用。候选不代表已经发送。
- **来源约束**：局部经历保留证据身份与 revision，支持修订、撤回和淡化视图；全局来源按授权、来源版本和可见投影复核。引用存在不保证模型整句话正确。
- **对话优先**：调用时的 busy、等待回复、待办状态阻止回想；进行中的取消由宿主传递。全局新一次 busy 调用不会自动取消旧调用。
- **可核算的资源边界**：默认一次独处最多 2 步，与线索回想共享每日 2 次模型调用预算；默认单次调用超时 30 秒。所有参数见 [API](docs/api.md#行为参数)。

| 路径 | 材料与选择方式 |
| --- | --- |
| `CompanionMemory` | 保存一个角色/范围的结构化经历；支持词面、标签与淡化投影。follow 以词面/标签重叠辅助取材 |
| `GlobalMemoryLibrary` + `GlobalRecollection` | 只读接入原生状态、JSON、JSONL、SQLite；全局 follow 从剩余材料继续采样，没有局部的关联加权 |

两条路径都依赖宿主提供模型执行器、可信受众和投递回执。核心无运行时第三方依赖。

## 与其他记忆插件的区别

本项目解决的是：已有经历在没有用户问题时，如何进入受控的回忆流程，以及回忆结果如何交给宿主使用。

| 组件 | 关注点及关系 |
| --- | --- |
| 常规 RAG / 向量检索 | 按查询提供材料，可作为输入。朝花夕拾没有内置向量库，也不替代检索系统 |
| [Mem0 Dream](https://docs.mem0.ai/platform/features/dream) | 在后台归纳模式、处理过时事实与重复记忆；与本项目有后台记忆处理的重叠。本项目主要组织角色回忆和候选表达，不负责维护外部库的事实 |
| [Letta dreaming](https://docs.letta.com/configuration/memory) | 后台回顾会话、整理经验并更新记忆；后台回顾不是本项目独有能力 |
| [Extension-Idle](https://github.com/SillyTavern/Extension-Idle) / [EchoText](https://github.com/mattjaybe/SillyTavern-EchoText) | 提供空闲提示或角色主动聊天。本项目提供可嵌入的回忆状态与候选结算流程，不包含聊天界面或 SillyTavern 适配器 |

比较按上述项目公开说明核对，不是效果排名。本项目适合希望试验回忆策略的宿主开发者；相对简单定时提示的体验增益尚未建立。

## 已运行的验证与实验

| 范围 | 已记录结果 | 能说明什么 |
| --- | --- | --- |
| 自动化检查 | 当前检查命令与结果见[验证说明](docs/verification.md) | 接口、状态和指定异常输入下的行为 |
| 6 个合成单轮场景 | 5 条件，50 次模型请求，35,990 tokens | 原生 fetch 运行器能生成并记录对比输出；也暴露了时间叙述错误 |
| 3 条合成时间线，DS4.1 路由 | 5 条件，每条件共 27 轮回复；167 次请求，245,064 tokens，记录的调用/条件失败均为 0 | 多轮流程可运行 |
| 同 3 条时间线，WorkBuddy DS4.1 路由 | 167 次请求，249,316 tokens，记录的调用/条件失败均为 0 | 该路由在本批次能完成同类流程 |

长周期实验使用模拟时间和固定用户台词，没有真实消息投递。第二步的桥接材料部分由场景预设，C 另有继续探索提示；C/B+T 的回复还使用实验宿主的想法台账。两轮期间注入方式和 API 输出上限有调整，不能当作严格的渠道稳定性对照。

**这些结果没有证明自然度、用户保留意愿或独特价值。** WorkBuddy 批次中，C 找到预设旧事，但最终三轮回复均未明确提到“桂花乌龙”；候选命中与回复体验应分别判断。C 的 tokens 约为 B+T 的 1.15 倍、A 的 1.62 倍，只是该批次的用量比例。完整成本、失败记录、复核方法与限制见[实验摘要](evaluation/results/README.md)。

## 快速开始

准备 Node.js ≥ 22.16 和 Git：

```bash
git clone https://github.com/BCOIgv/roleplay-recollection.git
cd roleplay-recollection
node examples/basic.mjs
node examples/solitude.mjs
node examples/global.mjs
```

示例使用合成材料、脚本化模型和模拟时间，无需 API Key。独处示例展示候选形成、等待回复时禁止取用及随后取用；候选仍为 `sent:false`。

在仓库根目录保存以下内容为 `quickstart.mjs`，运行 `node quickstart.mjs`：

```js
import {CompanionMemory} from './index.mjs';

const memory = new CompanionMemory({
  characterId: 'reading-companion', scopeId: 'private:demo', mode: 'companion',
});
try {
  memory.capture({
    id: 'rainy-reading', truth: 'observed', occurredAt: Date.now() - 3600000,
    gist: '雨天一起读了《小王子》', tags: ['阅读'],
    evidence: [{id: 'message-001', kind: 'shared_event', text: '我们一起读了《小王子》。'}],
  }, {mode: 'companion'});
  console.log(memory.visible({mode: 'companion', trigger: 'cue', cue: '小王子'}));
} finally {
  await memory.close();
}
```

这段代码只记录和检索，不调用模型。真实独处需提供 `wander` 钩子并调用 `solitude()`；普通回复需由宿主把可见材料和仍有效的想法交给回复模型。跨重启保存可设置 `stateDir`，不同角色/受众使用独立身份和目录。完整契约见 [API](docs/api.md#3-模型钩子)。

## 版本选择与安装

当前源码直接使用上述克隆方式；工程检查先运行 `npm ci`。需要安装到另一个 Node.js/DSH 环境时，按 [DSH 文档](dsh/README.md#current-source) 本地打包并安装匹配的核心和 Bundle。

历史固定版本可从 [v0.3.0 Release](https://github.com/BCOIgv/roleplay-recollection/releases/tag/v0.3.0) 下载 tarball。它不包含当前全局 API 和后续修复，详见[历史记录](docs/archive/verification-2026-11-07.md#公开-v030-的历史验证)。本项目文档不提供按包名从 npm registry 安装的保证。

## 宿主接入

已有 JSON、JSONL 或 SQLite 资料可按[只读来源指南](docs/read-only-sources.md)登记映射。读取有大小/条数上限，当前不是大型库的流式或语义索引。

DSH 局部模式暴露 11 个经历工具，没有独处入口或模型执行器；当前源码的全局模式暴露 9 个工具，依赖可信宿主服务提供权限和模型。测试中的想法注入没有自动成为 DSH 默认回复流程。接入步骤见 [dsh/README.md](dsh/README.md)。

## 开发与项目结构

```bash
npm ci
npm run verify
npm run check:types
npm run release:check
npm run verify:consumer
node evaluation/run-batch.mjs --dry-run
node evaluation/run-timeline.mjs --dry-run
```

| 目录 | 内容 |
| --- | --- |
| `src/`、`index.mjs`、`index.d.ts` | 核心实现与公开导出 |
| `dsh/`、`examples/` | 宿主适配与可运行合成示例 |
| `test/`、`typecheck/`、`scripts/` | 回归、类型、打包与安装检查 |
| `evaluation/`、`evaluation/templates/` | 评估运行器、合成场景与空白记录模板 |
| `evaluation/results/` | 经过审查的合成实验汇总；不含聊天原文或凭据 |
| `evaluation/reports/` | 本地生成的完整报告与运行状态，Git/npm 均排除 |
| `docs/`、`docs/archive/` | 当前接口文档与历史诊断/验证记录 |

真实记忆、身份映射和私有报告应保存在仓库外。动态预算等候选设计见[漫游边界研究](docs/wandering-boundaries.md)，未来验证方案见[测试计划](docs/evaluation-plan.md)，均不代表已经实施。

[贡献指南](CONTRIBUTING.md) · [安全边界](SECURITY.md) · [变更记录](CHANGELOG.md) · [MIT](LICENSE)
