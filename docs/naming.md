# 命名：AI Roleplay Recollection

> 结论：**GitHub 标题 / 仓库 / npm 包名：`AI Roleplay Recollection` / `roleplay-recollection`；中文名：朝花夕拾。**
> DSH 子包：`roleplay-recollection-dsh`。

## 1. 最终命名

| 用途 | 名称 |
| --- | --- |
| GitHub 标题 | **AI Roleplay Recollection** |
| GitHub 仓库 / npm 包名 | **`roleplay-recollection`** |
| DSH 子包 | **`roleplay-recollection-dsh`** |
| 中文名 | **朝花夕拾** |
| 产品描述 | A recollection engine for AI roleplay and companion characters |
| 英文短称 | Roleplay Recollection |

## 2. 为什么是 Recollection

- **Recollection 是“回忆/回想”这个行为**，不是 Memory 那种“存储”概念；插件做的是经历淡化、线索触发、独处时想起，正好对应 Recollection。
- **Roleplay 标明使用场景**：不是通用聊天记忆、不是 RAG、不是知识库。
- **AI 区分真人角色扮演/桌游**：标题里直接说明是给 AI 角色扮演用的。
- 不再使用 `Memory Core` 这种到处都有的泛词，避免和大量“AI 记忆/RAG 插件”混在一起。
- 与中文名「朝花夕拾」意思对应：朝花夕拾本身就是“回忆”。

## 3. 不再采用

| 方案 | 判断 |
| --- | --- |
| **AI Roleplay Memory Core** | `Memory Core` 太泛，容易和通用记忆/RAG 插件混在一起；已放弃。 |
| **AI Roleplay Character Memory** | 清楚但偏长，且 Memory 仍偏“存储”；已放弃。 |
| **Character Recollection for AI Roleplay** | 语义最完整，但作为标题/包名太长；只适合做副标题。 |
| **Roleplay Recollection** | 更短，但没有 AI 指向；作为短称可以，正式标题保留 AI。 |
| **在中文名前加 dsh 前缀** | npm 不接受中文包名；`dsh-...` 会把框架无关的核心提前绑定到 DSH。 |
| **把朝花夕拾直接做 npm 包名** | 中文不能做 npm 包名；即使转拼音，也会失去直白性。中文名保留，但包名用英文。 |

## 4. 占用检查

2026-11-03 检查：

| 名称 | npm | GitHub 同名仓库 | 结论 |
| --- | --- | --- | --- |
| `roleplay-recollection` | 可用 | 0 个 | **采用** |
| `roleplay-recollection-dsh` | 可用 | 0 个 | **采用**（DSH 子包） |
| `ai-roleplay-recollection` | 可用 | 0 个 | 可作更长备选 |
| `roleplay-recall` | 可用 | 0 个 | 更短，但 recall 偏技术 |
| `character-recollection` | 可用 | 0 个 | 清楚，但缺少 roleplay 场景 |

发布前请再复核 npm 与 GitHub；名称占用会随时间变化。

## 5. 使用方式

- README 首屏：`AI Roleplay Recollection · 朝花夕拾`
- 中文对话：**朝花夕拾**
- 英文短称：**Roleplay Recollection**
- 产品描述：`A recollection engine for AI roleplay and companion characters`
- 不在中文名后追加副句；需要解释时用产品描述即可。

## 6. 商标说明

- 「朝花夕拾」是鲁迅散文集的固定书名，此处作为文化引用和中文显示名使用；如果商业发行或注册商标，建议再查中国商标网（第 9/42 类）。
- `roleplay-recollection` 是描述性组合，商标风险相对低；发布前复核 `https://registry.npmjs.org/roleplay-recollection` 与 GitHub `roleplay-recollection in:name`。
