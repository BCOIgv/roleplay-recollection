> 历史归档：保留当时的诊断与验证边界，不描述当前源码。当前接口见[API](../api.md)，当前检查与实验见[验证说明](../verification.md)。

# GitHub 文档与可发现性诊断

2026-11-07 更新：定位与展示名以[命名规范](../naming.md)为准。新增[漫游边界研究](../wandering-boundaries.md)及[分阶段测试计划](../evaluation-plan.md)，均明确区分已实现能力、未实施设计与待验证假设。以下线上元数据观察保留原检查日期。

诊断日期：2026-11-06（Asia/Shanghai）。基线：`65ef240`。检查范围包括公开仓库元数据、中英文 README、DSH 接入、安装入口、示例与当前代码契约。本文已按“角色回忆行为层”修正定位；方向、需求与生态重叠的完整论证见[产品定位诊断](product-positioning-2026-11-07.md)。

## 主要结论

先把回忆行为与已有记忆系统的关系讲清，再补齐仓库简介与 Topics，用真实可验证的首次体验承接访问。上一轮将“长期记忆”放在标题和首句，弱化了独处、漫游与表达的主线，现已修正。公开仓库在本次检查时的 `description` 为 `null`，`topics` 为 `[]`；这些字段不会因为改了 README 或 `package.json` 就自动更新。

本次没有获取仓库管理员可见的访问量、来源或克隆数据，不能将曝光低全部归因于文案。下面的关键词建议依据实际功能与同类项目用语，不是搜索量统计或排名保证。

## 一、第一印象：让读者在五秒内知道用途

| 位置 | 原有问题 | 修改方案 |
| --- | --- | --- |
| 标题与首句 | 原始版本术语较重；上一轮“AI 角色长期记忆”又将类别放得过宽 | 使用 `朝花夕拾 · Roleplay Recollection`，配上独处回忆与主动表达的功能副标题 |
| 一句话简介 | 没有优先呈现独处、思绪漫游与表达行为 | 直接说“为 AI 角色提供独处回忆、思绪漫游与主动表达的行为模块” |
| 开头段落 | 记录、检索与淡化抢占主线，读者难以看出与常规记忆组件的关系 | 先描述对话间隙重拾往事、允许沉默、形成表达意愿，再说明宿主控制与已有记忆的分工 |
| 顶部大横幅 | 在不同屏幕上占据首屏空间，进一步推迟用途与运行入口 | 以文字标题和简介开场，视觉资产留在仓库中供分享或后续设计使用 |
| 功能措辞 | “基于凭据”容易与认证混淆；“零额外开销”容易被理解为整体零成本 | 使用“带原始引文的经历”；准确描述为“常规检索额外模型调用为 0” |

可直接替换的首屏：

```markdown
# 朝花夕拾 · Roleplay Recollection

**为 AI 角色提供独处回忆、思绪漫游与主动表达的行为模块。**

相处时留下的经历，可以在对话停下来之后，被角色重新拾起：在一段往事上停留，顺着一点关联想起别的事，或者什么也不说，安静结束。如果形成了想分享的内容，再交给宿主择机表达。

Idle recollection, mind-wandering, and optional outreach for AI characters.
```

保持现有仓库名和包名即可。当前更需要补齐类别词与接入入口；无需为这次文档优化引入仓库迁移。

## 二、GitHub 搜索优化

### 默认搜索首先依赖仓库元数据

GitHub 官方文档说明，仓库搜索省略 `in:` 时只搜索名称、简介和 Topics；需要 `in:readme` 才会查询 README。因此 README 的重写改善阅读与显式全文检索，但不能代替 About 字段。

来源：[GitHub 仓库搜索说明](https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories)。

### 关键词缺口与使用位置

| 搜索意图 | 建议用语 | 原文情况与处理 |
| --- | --- | --- |
| 为角色增加回忆行为 | `recollection`、`idle reflection`、`mind-wandering`、`proactive agents` | 放入功能简介与行为说明，准确交代无指定产出任务的漫游及宿主边界 |
| 寻找记忆组件 | `AI memory`、`LLM memory`、`长期记忆`、`long-term memory` | 作为相关类别与基础能力，在关系说明中覆盖，避免代替回忆行为的主定位 |
| 保存角色经历 | `episodic memory`、`character memory`、`角色记忆`、`情景记忆` | 原文解释了机制，却缺少这些常用类别词；在英文简介和中英文机制段落中自然使用 |
| 开发 AI 伴侣与聊天机器人 | `AI companion`、`companion chatbot`、`chatbot memory`、`AI 伴侣` | 已有 companion/对话伴侣，但 chatbot 和对应应用场景不足；放入开头和使用场景 |
| 为角色扮演增加连续性 | `AI roleplay`、`roleplay memory`、`RP memory` | roleplay 已有覆盖；补足与 memory 的关系即可 |
| 寻找特定记忆机制 | `memory fading`、`memory decay`、`cue-based recall`、`记忆淡化` | 这些是支持能力，且生态中有相近实现，不作为独有卖点 |
| 判断工程接入成本 | `Node.js`、`JavaScript`、`TypeScript types`、`DSH plugin` | Node 与 DSH 已有；补充 JavaScript 核心和 TypeScript 类型支持，说明两个包的关系 |

`long-term` 描述跨会话保存用途，实际容量与持久化配置仍须明确：局部核心默认最多 200 条、可配置到 500 条，且省略 `stateDir` 时只驻留内存。

这些是高相关的通用检索词候选。本次没有 GitHub 或第三方的关键词月搜索量数据，不将它们标记为已证实的“高频词”。参考同类项目的实际类别表达：[Mem0 的 memory layer](https://github.com/mem0ai/mem0/blob/main/mem0-ts/README.md)、[CharMemory 的角色记忆场景](https://github.com/bal-spec/sillytavern-character-memory)。它们用于核对用语，不作为功能兼容性或性能对比证据。

### 推荐 About Description

在仓库主页 About 右侧齿轮中粘贴：

```text
Idle recollection and optional outreach for AI roleplay characters and companions. A Node.js behavior layer over stored memories: bounded mind-wandering, tentative thoughts, and host-controlled delivery.
```

这段先说明回忆与表达行为，再交代已有记忆之上的层次与 Node.js 技术栈。它不承诺模型自然度或独立发送。

### 推荐 Topics

逐个添加以下 14 个标签：

```text
ai-roleplay
ai-companion
character-memory
episodic-memory
recollection
mind-wandering
proactive-agents
llm
nodejs
javascript
dsh
memory
long-term-memory
chatbot
```

GitHub 要求 Topics 使用小写字母、数字与连字符，每个不超过 50 个字符，每仓库最多 20 个。这里保留容量给以后实际完成的平台适配。

来源：[GitHub Topics 官方说明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)。

当前不建议将 `sillytavern`、`mcp-server`、`langchain`、`vector-database` 或 `semantic-search` 作为兼容性标签：仓库尚未提供相应平台适配或检索实现。已有包元数据中的 `mcp` 也不等于具备独立 MCP Server。TypeScript 支持可写在简介中，但应说明核心实现为 JavaScript。

### 检索验收方式

元数据更新并被索引后，在 GitHub 的 Repositories 搜索中分开检查：

```text
user:BCOIgv recollection in:description
user:BCOIgv topic:character-memory
user:BCOIgv mind-wandering in:readme
```

这些查询用于检查字段是否能匹配，不代表竞争词排名。随后用面向目标用户的 `roleplay memory`、`companion memory` 等查询观察相关性；不要将某次结果位置当作稳定排名。

## 三、结构与上手门槛

| 原有障碍 | 为什么会中断体验 | 已采用的修改 |
| --- | --- | --- |
| 发布包与当前源码能力混在一起 | 装 v0.3.0 后尝试全局来源接口，会找不到导出 | 明确当前 `main` 与 v0.3.0 的入口、能力和已知限制 |
| 根示例只赋值，不显示结果 | 新用户无法判断是否成功，也不清楚数据如何进入回复 | 提供完整脚本、运行位置、命令、预期 JSON 和回复上下文接入说明 |
| 原有 `examples/basic.mjs` 用“下雨”查询“听雨/下着雨” | 当前中文词面匹配不能保证同义改写命中，初次演示返回空数组 | 将演示线索改成“听雨”，实际检查返回非空，明确检索方式 |
| `.mjs`、导入路径与持久化没有形成连续步骤 | 读者容易混淆克隆源码、包名导入与重启保存 | 区分源码相对导入和已安装包导入，说明 `stateDir` 与实例隔离 |
| DSH 同时存在 11 工具与 9 工具说法 | 用户无法判断自己安装了哪个模式，需要哪些宿主服务 | 用模式表区分局部与全局；补充两包安装、源码打包与可信服务契约 |
| 按包名安装尚不可用 | 只有 Bundle tarball 时，核心依赖仍无法从 registry 解析 | 给出实际 Release URL 与同时安装两个包的命令 |
| 英文入口仍保留 56 项测试的旧信息 | 版本与验证范围不同步，削弱可信度 | 同步中英文结构，验证数字集中在已有验证文档中维护 |
| 贡献指南仍写 Node ≥22、无需安装开发工具 | 当前源码最低版本和 TypeScript 检查不符 | 修正为 Node ≥22.16，完整检查流程先运行 `npm ci` |

调整后的阅读顺序是：独处回忆的用途 → 核心行为与公平对照 → 独处离线演示 → 材料输入与宿主接入 → 安装版本 → 机制与成本 → 外部来源和 DSH → FAQ → 开发与参考文档。

## 交付与验证范围

完整可替换文档位于 [中文 README](../../README.md) 和 [English README](../../README.en.md)。支持入口同步更新了 [DSH README](../../dsh/README.md)、[贡献指南](../../CONTRIBUTING.md) 和 [API 环境说明](../api.md)。

本次修改包含离线示例线索修正，不改变检索算法。文档中的模型生成、投递、权限及平台适配均按当前代码边界描述。

| 本次检查 | 结果 |
| --- | --- |
| 中英文完整示例 | 分别运行，实际 JSON 与 README 预期逐项一致，额外模型调用为 0 |
| 基础离线示例 | 修改线索后返回非空记忆，记录成功，额外模型调用为 0 |
| 当前源码打包 | 核心与 DSH Bundle 打包成功；核心 prepack 中的 `npm run verify` 通过 |
| 当前源码消费端 | 两个 tarball 在临时项目中同时离线安装成功；中英文示例改为包名导入后均通过，核心和 Bundle 可导入 |
| 文档链接 | 检查 71 个本地路径与标题锚点，无缺失 |
| 发布元数据与差异格式 | `npm run release:check`、`git diff --check` 通过 |
| 推荐元数据 | 按回忆行为层定位修订后的简介为 203 字符；14 个 Topics 的字符集、长度与数量校验通过 |

公开元数据检查发现简介与 Topics 为空；Release API 确认当前最新公开版本是 v0.3.0，并提供核心、Bundle 与 SHA-256 文件。本次查询两个公共 npm 包入口均返回 404，安装说明使用 Release tarball。

本次尝试通过直接下载和 GitHub 资产 API 获取公开 v0.3.0 文件，均在下载链路遇到 TLS 握手错误，未完成旧发布包的重新下载、哈希校验及端到端安装复验。这一限制不等于发布资产损坏；上述双包消费端验证针对本次从当前源码生成的产物。

仓库 About 和 Topics 属于 GitHub 站点设置，未随本地文件修改而自动应用。本次交付提供上述可粘贴内容。

## 后续增长优先级

1. **验证回忆行为的收益，再扩大传播**：与被动记忆、简单定时提示比较自然度、保留意愿、打扰与成本。用回忆行为定位补齐 About 和 Topics，让访问者能先看懂差异并完成演示。
2. **安排包含当前修复的新版本**：使用新的版本号区分当前源码与公开 v0.3.0；若准备发布 npm，应先验证可用包名、两包依赖与真实安装流程。
3. **完成一个真实宿主的接入示例**：记录实际 DSH 版本、身份来源、模型桥接和最小配置，用一次真实安装验证降低信任门槛。
4. **提供短演示与场景教程**：展示一次“保存经历 → 话题命中 → 返回材料”的终端过程，再介绍淡化与独处。将演示嵌在快速开始附近，并准确注明模拟模型的覆盖范围。
5. **用访问数据决定下一步**：在管理员可见的 GitHub Traffic 中观察访问、来源与克隆；结合安装问题和用户复现记录判断损失发生在哪一步。Release 下载次数只能作为下载信号，不能等同于成功安装或活跃用户。

文档能改善理解、匹配与上手。持续曝光还取决于可用发行版、真实接入案例和目标社区中有帮助的内容；本次没有发送推广消息，也没有更改发布状态。
