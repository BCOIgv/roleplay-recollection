# 命名与展示文案

更新日期：2026-11-07。以下为当前规范；历史版本名称、许可证署名和版权记录保留原文，不作为当前展示标题。

| 用途 | 名称 |
| --- | --- |
| 英文标题 | Roleplay Recollection |
| 核心包与仓库 | `roleplay-recollection` |
| DSH 包 | `roleplay-recollection-dsh` |
| 中文显示名 | 朝花夕拾 |
| 中文功能副标题 | AI 角色的独处回忆与主动表达 |
| 英文功能副标题 | Idle recollection, mind-wandering, and optional outreach for AI characters |
| 英文短称 | Roleplay Recollection |

Roleplay 表明使用场景，Recollection 表示回忆与回想。中文名借用鲁迅散文集书名，呼应在后来重新拾起相处片段的意象。文学名承担品牌识别，功能副标题解释独处、回忆与表达。

中文 README 使用“朝花夕拾 · Roleplay Recollection”；英文入口使用“Roleplay Recollection · 朝花夕拾”。保留现有仓库名和包名，避免因文案定位调整引入迁移成本。

对外定位为已有记忆之上的角色回忆行为层。简介保留 AI roleplay、AI companion、memory、Node.js 等类别词，同时以 recollection / mind-wandering / optional outreach 说明行为方向。长期记忆是输入与基础能力，不作为首要卖点。

## GitHub About Description

```text
Idle recollection and optional outreach for AI roleplay characters and companions. A Node.js behavior layer over stored memories: bounded mind-wandering, tentative thoughts, and host-controlled delivery.
```

## GitHub Topics

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

这是相关检索意图建议，不是经过搜索量验证的高频标签。本轮更新本地文档与包元数据，不自动更改 GitHub About/Topics。没有原生适配前，不加入 SillyTavern 或 MCP Server 兼容性标签。

## 展示资产与包元数据

[横幅](assets/banner.svg)、[分享图](assets/social-preview.svg)、[图标标题](assets/mark.svg)、中英文 README、DSH locale 与包描述遵循同一定位。可编辑 SVG 是展示源文件，[PNG 分享图](assets/social-preview-recollection.png)随之重新导出；历史发布包不会被本地改动追溯修改。

中文短描述可用“已有记忆之上的 AI 角色回忆行为层”；英文短描述可用“a character recollection behavior layer over existing memories”。需要交代动作时使用“宿主控制时机、打断和投递”，避免写成安装即自动发消息。

“独处”“私人想法”“想说的话”描述角色行为模拟；真实模型执行、空闲状态与消息投递由宿主提供。避免将这些表述扩展为已证实的主观体验或独立意识。命名与产品边界的完整评估见[产品定位诊断](archive/product-positioning-2026-11-07.md)。

仓库位于 [BCOIgv/roleplay-recollection](https://github.com/BCOIgv/roleplay-recollection)。包的实际发布状态见 [发布清单](releasing.md)；历史名称搜索结果不能作为名称权利或商标结论。
